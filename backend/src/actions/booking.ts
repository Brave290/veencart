'use server';

import { cookies, headers } from 'next/headers';
import { bookingInputSchema, type BookingInput } from '@backend/lib/booking-schema';
import {
  createBooking,
  quoteReasonMessage,
  type QuoteReason,
} from '@backend/lib/booking-service';
import {
  fieldErrorsFromIssues,
  formDataToBookingInput,
} from '@backend/lib/booking-form-mapping';

/**
 * The database engine is loaded on demand, inside the action.
 *
 * A top-level `import { getDb } from '@backend/lib/db'` makes the bundler follow
 * PGlite into the client module graph and EMIT its assets — a 10.5MB wasm, a
 * 6.2MB data file and three extension tarballs, about 19MB in total — into
 * `.next/static/media/`, which Next serves publicly.
 *
 * Verified, not assumed: with the static import the build emits 19.2MB of
 * PostgreSQL into a browser-reachable directory. No client chunk references any
 * of it, so nothing executes and no secret leaks — but it is dead weight
 * uploaded on every single deploy, and an entire database engine sitting in a
 * public directory is not a thing to leave lying around on purpose.
 *
 * The dynamic import keeps that engine on the server, loaded only when a
 * booking is actually submitted. `server-only` already guards the module from
 * being imported by a client component directly; this stops the bundler from
 * shipping it there by accident.
 */
async function loadDb() {
  const { getDb } = await import('@backend/lib/db');
  return getDb();
}

/**
 * Booking submission.
 *
 * WHY A SERVER ACTION, NOT AN API ROUTE
 * This endpoint creates a real consignment and mints a capability token that
 * grants access to it. A POST-only server action is CSRF-protected by Next and
 * cannot be turned into a link someone can paste into a chat — the same
 * reasoning that governs the tracking lookup.
 *
 * WHAT THIS ACTION DELIBERATELY DOES NOT DO
 * It does not quote a price. `createBooking` decides whether the route has a
 * configured tariff and, if not, records a quote request. This layer only
 * relays that verdict. A price shown here would be a price nobody authorised.
 *
 * THE GUEST TOKEN
 * `createBooking` returns the raw token exactly once. It is handed straight to
 * an httpOnly cookie and never logged, never returned in the response body and
 * never included in an error. Logging it would put a live capability for a real
 * consignment into whatever ships logs.
 */

/**
 * Fixed-window limiter keyed by client IP.
 *
 * HONEST SCOPE: on a single process this stops casual form spam and naive
 * bots. It does NOT survive multiple instances and is not a substitute for
 * Upstash or a WAF rule. What it does buy today is that an unattended form
 * cannot be used to flood the bookings table. See docs/SECURITY-NOTES.md.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export interface BookingActionState {
  status: 'idle' | 'created' | 'invalid' | 'error' | 'rate-limited';
  /** Field-keyed messages, e.g. `sender.phone`. Drives per-field rendering. */
  fieldErrors?: Record<string, string>;
  /** Top-level message. Never an exception, never an internal detail. */
  message?: string;
  /** Present only on success. */
  bookingReference?: string;
  /**
   * Which of the two genuinely different outcomes happened. The customer is
   * told which, because "we will email you a price" and "we will confirm
   * availability" are different promises and conflating them is how support
   * conversations start.
   */
  outcome?: 'quote_requested' | 'awaiting_price';
  /** Why a quote is needed. Never accompanied by an amount. */
  quoteReason?: QuoteReason;
}

const IDLE: BookingActionState = { status: 'idle' };


export async function submitBooking(
  _prev: BookingActionState,
  formData: FormData
): Promise<BookingActionState> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';

  if (rateLimited(ip)) {
    return {
      status: 'rate-limited',
      message: 'Too many booking attempts from this connection. Wait a minute and try again.',
    };
  }

  const raw = formDataToBookingInput(formData);

  const parsed = bookingInputSchema.safeParse(raw);

  if (!parsed.success) {
    // Collapsed to one message per field. A screen-reader user does not need to
    // hear that a string is not a string three times over.
    return {
      status: 'invalid',
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
      message: 'Some details need fixing before we can take this booking.',
    };
  }

  try {
    const result = await createBooking(await loadDb(), parsed.data as BookingInput);

    // `createBooking` also reports a field-level failure. Narrowing on `ok` is
    // not optional here — reading `result.bookingReference` without it is the
    // kind of thing TypeScript exists to stop, and it would have been a
    // reference of `undefined` shown to a customer as their booking number.
    if (!result.ok) {
      const fieldErrors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        if (messages[0]) fieldErrors[key] = messages[0];
      }
      return {
        status: 'invalid',
        fieldErrors,
        message: 'Some details need fixing before we can take this booking.',
      };
    }

    // Hand the capability to the browser as an httpOnly cookie. Not in the
    // action state, because action state is serialised into the RSC payload
    // that travels to the client — anything in it is readable from the page.
    // The token's whole purpose is to be a secret the user never has to handle.
    const jar = await cookies();
    jar.set('veencart_guest_token', result.guestToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    // Two genuinely different outcomes and the customer is told which, because
    // "we will price this for you" and "we will confirm the price" are
    // different promises.
    //
    // Note neither message contains an amount. Pricing happens after the
    // booking exists — see the pricing engine step — and showing a number here
    // would be inventing one.
    const outcome =
      result.status === 'quote_requested' ? 'quote_requested' : 'awaiting_price';

    const quoteReason =
      result.coverage.kind === 'needs_quote' ? result.coverage.reason : undefined;

    const message =
      outcome === 'quote_requested' && quoteReason
        ? quoteReasonMessage(quoteReason)
        : 'Booking received. We will confirm the price and arrange collection with you.';

    return {
      status: 'created',
      bookingReference: result.bookingReference,
      outcome,
      quoteReason,
      message,
    };
  } catch (err) {
    // The real error goes to the log, never to the response. A database error
    // string can carry table names, column names and constraint definitions.
    // Never log `result.guestToken` — it does not exist yet on this path, and
    // it must not exist in any log on any path.
    console.error('booking creation failed', err);

    return {
      status: 'error',
      message:
        'We could not save that booking just now. Nothing has been charged and no reference was created — please try again.',
    };
  }
}

export { IDLE as BOOKING_IDLE_STATE };
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Db, Transaction } from "./types";
import { toBookingRow, type BookingInput, type BookingRow } from "./booking-schema";

/**
 * Booking service — the first WRITE path in the system.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ─────────────────────────────────────────
 * When a route is not covered by a configured tariff, the system must NOT
 * invent a price. It creates a quote request and tells the customer plainly
 * that a person will price it.
 *
 * This is the single most important business rule in the product. A fabricated
 * price is not a small lie: the customer pays against it, the business is
 * legally on the hook, and the delivery either happens at a loss or does not
 * happen at all. "Nigeria-wide" is an ambition, not a published rate card.
 *
 * The second rule: an unsupported route is a NORMAL outcome, not an error.
 * Returning a clean "needs a quote" is the feature working, not failing.
 */

export type CoverageResult =
  | { kind: 'covered'; origin_area_id: string; destination_area_id: string }
  | { kind: 'needs_quote'; reason: 'no_origin' | 'no_destination' | 'no_route' | 'excluded' | 'too_heavy' };

/**
 * Is this route covered by a configured, currently-valid tariff?
 *
 * Reads `service_areas` then `route_rules`. Returns a discriminated union
 * rather than a boolean so the caller can explain WHY, and so adding a new
 * un-covered reason is a compile error rather than a silent `false`.
 */
export async function checkCoverage(
  db: Db,
  input: Pick<BookingInput, 'serviceType' | 'sender' | 'recipient' | 'parcel'>
): Promise<CoverageResult> {
  // Areas are matched on `state` plus the `localities` ARRAY. service_areas
  // models coverage as a list of localities, not a single city column — which is
  // the right shape for "we cover these areas of Lagos".
  //
  // The match is deliberately lenient about locality and strict about state: a
  // wrong "we do not cover you" costs a customer, a right "we do" costs nothing.
  const areas = await rows<{ id: string }>(
    await db.query(
      `select id
         from public.service_areas
        where is_active
          and lower(state) = lower($1)
          and $2 = any (service_types)
        order by (lower($3) = any (select lower(l) from unnest(localities) as l)) desc
        limit 1`,
      [input.sender.state, input.serviceType, input.sender.city]
    )
  );

  if (areas.length === 0) return { kind: 'needs_quote', reason: 'no_origin' };

  const dest = await rows<{ id: string }>(
    await db.query(
      `select id
         from public.service_areas
        where is_active
          and lower(state) = lower($1)
          and $2 = any (service_types)
        order by (lower($3) = any (select lower(l) from unnest(localities) as l)) desc
        limit 1`,
      [input.recipient.state, input.serviceType, input.recipient.city]
    )
  );

  if (dest.length === 0) return { kind: 'needs_quote', reason: 'no_destination' };

  const originId = areas[0]?.id as string;
  const destId = dest[0]?.id as string;

  const rule = await db.query(
    `select id, max_weight_kg, is_excluded, is_active, valid_from, valid_to
       from public.route_rules
      where origin_area_id = $1
        and destination_area_id = $2
        and service_type = $3
        and is_active
        and (valid_from is null or valid_from <= now())
        and (valid_to   is null or valid_to   >= now())
      limit 1`,
    [originId, destId, input.serviceType]
  );

  if (rule.rows.length === 0) return { kind: 'needs_quote', reason: 'no_route' };

  const row = rule.rows[0] as Record<string, unknown>;

  // An excluded route is a deliberate business decision — for example a
  // direction that is currently not operated. It must not fall through to a
  // price just because a rule row happens to exist.
  if (row.is_excluded === true) return { kind: 'needs_quote', reason: 'excluded' };

  const maxWeight = row.max_weight_kg === null ? null : Number(row.max_weight_kg);
  if (maxWeight !== null && input.parcel.weightKg > maxWeight) {
    return { kind: 'needs_quote', reason: 'too_heavy' };
  }

  return { kind: 'covered', origin_area_id: originId, destination_area_id: destId };
}

/** The reasons a route can fall through to a manual quote. */
export type QuoteReason = 'no_origin' | 'no_destination' | 'no_route' | 'excluded' | 'too_heavy';

/** Human explanation for a quote request. Never a price. */
export function quoteReasonMessage(reason: QuoteReason): string {
  switch (reason) {
    case 'no_origin':
      return 'We do not currently collect from that area. Our team will review it and come back to you.';
    case 'no_destination':
      return 'We do not currently deliver to that area yet. Our team will review it and come back to you.';
    case 'no_route':
      return 'That specific route is not on our current rate card. Our team will price it for you.';
    case 'excluded':
      return 'That route is not currently being operated. Our team will confirm the options with you.';
    case 'too_heavy':
      return 'This consignment is heavier than our standard parcel limit, so it needs a freight quote.';
  }
}

/**
 * Public booking reference.
 *
 * `VCB-` prefix plus 10 Crockford base32 characters (no I, L, O, U), which
 * removes the 1/I/L and 0/O confusions that make people mistype a reference
 * over the phone. Roughly 50 bits of entropy — enough that guessing another
 * customer's reference is not feasible, which matters because the reference is
 * what a guest uses to reach their booking.
 */
function rows<T>(r: { rows: unknown[] }): T[] {
  return r.rows as T[];
}

function generateBookingReference(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[(bytes[i] as number) % alphabet.length];
  }
  return `VCB-${out}`;
}

/**
 * Guest access token — the raw value goes to the customer, only the hash is
 * stored.
 *
 * 32 random bytes, base64url encoded: 256 bits. The SHA-256 is computed over
 * the token WITH a pepper-free plain hash because the token is already 256 bits
 * of entropy, so there is nothing to brute force and no need for a slow KDF —
 * this is not a password, it is a bearer capability.
 *
 * The raw token MUST NOT be logged, stored, or included in any error message.
 */
function generateGuestToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export type CreateBookingResult =
  | {
      ok: true;
      bookingReference: string;
      /** Raw token, returned ONCE to hand to the guest. Never persisted. */
      guestToken: string;
      status: 'draft' | 'quote_requested';
      coverage: CoverageResult;
    }
  | { ok: false; fieldErrors: Record<string, string[]> };

/**
 * Create a booking.
 *
 * Single transaction: booking + items + guest token, or nothing. A booking row
 * without its parcel items would be a support ticket waiting to happen.
 */
export async function createBooking(
  db: Db,
  input: BookingInput,
  options: { customerUserId?: string | null } = {}
): Promise<CreateBookingResult> {
  const coverage = await checkCoverage(db, input);

  // No configured tariff means a quote request — NOT an error and NOT a price.
  // A covered route starts as `draft`: the booking exists, but nothing has been
  // priced yet. Step 3 (the pricing engine) is what moves it to `quoted`. Do
  // NOT invent a price here to skip that step.
  const status: BookingRow['status'] =
    coverage.kind === 'covered' ? 'draft' : 'quote_requested';

  const reference = generateBookingReference();
  const { raw: guestToken, hash: tokenHash } = generateGuestToken();
  const customerUserId = options.customerUserId ?? null;
  const row = toBookingRow(input);

  await db.transaction(async (tx: Transaction) => {
    const inserted = await tx.query(
      `insert into public.bookings (
         booking_reference, customer_user_id, guest_booking_reference,
         service_type, status,
         sender_name, sender_phone, sender_email, sender_street, sender_locality,
         sender_city, sender_state, sender_country,
         recipient_name, recipient_phone, recipient_email, recipient_street,
         recipient_street_detail, recipient_locality, recipient_city,
         recipient_state, recipient_country,
         item_count, total_weight_kg, contents_description, is_fragile,
         special_instructions,
         origin_area_id, destination_area_id
       ) values (
         $1, $2, $3, $4, $5,
         $6,$7,$8,$9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,$22,
         $23,$24,$25,$26,$27,
         $28, $29
       )
       returning id`,
      [
        reference,
        customerUserId,
        // guest_booking_reference satisfies the ownership CHECK when there is
        // no signed-in customer. For a signed-in customer it is null and the
        // customer_user_id carries ownership.
        customerUserId ? null : reference,
        row.service_type,
        status,
        row.sender_name, row.sender_phone, row.sender_email, row.sender_street,
        row.sender_locality, row.sender_city, row.sender_state, row.sender_country,
        row.recipient_name, row.recipient_phone, row.recipient_email,
        row.recipient_street, row.recipient_street_detail, row.recipient_locality,
        row.recipient_city, row.recipient_state, row.recipient_country,
        row.item_count, row.total_weight_kg, row.contents_description,
        row.is_fragile, row.special_instructions,
        coverage.kind === 'covered' ? coverage.origin_area_id : null,
        coverage.kind === 'covered' ? coverage.destination_area_id : null,
      ]
    );

    const bookingId = (inserted.rows[0] as { id: string } | undefined)?.id as string;

    await tx.query(
      `insert into public.booking_items
         (booking_id, description, quantity, weight_kg, length_cm, width_cm, height_cm)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        bookingId,
        input.parcel.description,
        input.parcel.quantity,
        input.parcel.weightKg.toFixed(3),
        input.parcel.lengthCm ?? null,
        input.parcel.widthCm ?? null,
        input.parcel.heightCm ?? null,
      ]
    );

    if (!customerUserId) {
      await tx.query(
        `insert into public.guest_access_tokens (token_hash, purpose, booking_id, expires_at)
         values ($1, 'guest_booking', $2, now() + interval '30 days')`,
        [tokenHash, bookingId]
      );
    }
  });

  return {
    ok: true,
    bookingReference: reference,
    guestToken,
    status,
    coverage,
  };
}
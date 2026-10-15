'use server';

import { headers } from 'next/headers';
import { lookupTracking } from '@/lib/tracking';
import type { PublicTrackingResult } from '@/lib/types';

/**
 * Server action for public tracking lookup.
 *
 * WHY A SERVER ACTION RATHER THAN A ROUTE HANDLER THE BROWSER CALLS
 * The browser must never hold a database connection. Pasting a URL like
 * /api/tracking/VCTR-0001 into a shared chat is the easiest possible way to leak
 * a customer's delivery history. A server action is POST-only, CSRF-protected
 * by Next, and cannot be turned into a link someone can share.
 */

/**
 * Fixed-window limiter, keyed by client IP.
 *
 * WHAT THIS ACTUALLY BUYS, HONESTLY: on a single-process deployment it stops
 * casual reference-guessing and naive scrapers. It does NOT survive multiple
 * instances, and it is not a substitute for a shared store (Upstash) or a WAF
 * rule. Tracking is public and rate-limited data, so a determined attacker
 * rotating IPs will still get through. That is an accepted, documented risk —
 * not an oversight — and the real protection is that the projection contains
 * nothing sensitive to steal.
 *
 * Replace with Upstash (already in .env.example) before a multi-instance deploy.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
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

export interface TrackActionState {
  status: 'idle' | 'found' | 'not-found' | 'error' | 'rate-limited';
  result: PublicTrackingResult | null;
  message?: string;
}

export async function trackShipment(
  _prev: TrackActionState,
  formData: FormData
): Promise<TrackActionState> {
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) {
    return {
      status: 'rate-limited',
      result: null,
      message: 'Too many lookups from this connection. Wait a minute and try again.',
    };
  }

  const reference = String(formData.get('reference') ?? '');

  if (!reference.trim()) {
    return {
      status: 'error',
      result: null,
      message: 'Enter your tracking reference to continue.',
    };
  }

  try {
    const result = await lookupTracking(reference);
    if (!result.found) {
      // Deliberately identical wording for a malformed reference and a real one
      // that does not exist. Distinguishing them is an enumeration oracle.
      return {
        status: 'not-found',
        result: null,
        message:
          'We could not find a shipment for that reference. Check it against your booking confirmation.',
      };
    }
    return { status: 'found', result };
  } catch (err) {
    // The real error goes to the log, never to the response. An error string
    // from a database layer can contain table names and SQL.
    console.error('tracking lookup failed', err);
    return {
      status: 'error',
      result: null,
      message: 'We could not complete that lookup just now. Please try again.',
    };
  }
}
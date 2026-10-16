import "server-only";

import type { PublicTrackingEvent, PublicTrackingResult } from "@backend/lib/types";

/**
 * The database engine is loaded on demand rather than at module load.
 *
 * See the equivalent note in `actions/booking.ts` for the full reasoning: a
 * static import of `db.ts` makes the bundler emit ~19MB of PGlite wasm and data
 * files into `.next/static/media/`, which Next serves publicly. Verified by
 * building with and without the static import.
 */
async function loadDb() {
  const { getDb } = await import("@backend/lib/db");
  return getDb();
}

/**
 * Public shipment tracking.
 *
 * THE PRIVACY CONTRACT — read this before changing the query
 * ---------------------------------------------------------------
 * A tracking reference is shown to whoever holds it, including a recipient who
 * has no relationship with the sender. So this lookup may return ONLY:
 *
 *   the coarse route (state to state), the status, the timestamps, and
 *   customer-safe messages that staff already wrote for public display.
 *
 * It must NEVER return: sender or recipient name, phone, email, street or
 * locality, declared value, amount charged, internal notes, driver identity,
 * or coordinates.
 *
 * The projection below does that by SELECTING those columns explicitly. It
 * deliberately does NOT `select * from shipments and delete the private fields`
 * in application code — field-stripping after the fact is how one forgotten
 * column escapes, and it is exactly the mistake that turns a tracking page into
 * a data breach.
 *
 * ENUMERATION: `shipment_events.is_customer_visible` and the
 * `shipment_events_customer_timeline_idx` partial index mean the timeline query
 * can only ever touch publicly-displayable rows, so RLS is not the only thing
 * standing between a guessed reference and someone's home address. It is
 * defence in depth, not the primary control.
 */

/** Reference format enforced by the database CHECK on shipment_reference. */
const REFERENCE_PATTERN = /^VCTR-[A-Z0-9-]{4,32}$/;

/**
 * Normalise whatever the user typed into a canonical reference.
 *
 * People paste these from email and SMS, so they arrive lowercase, with
 * spaces, or with the prefix missing. Rejecting those as "invalid" would be
 * technically correct and practically useless — so we normalise generously at
 * the boundary and validate the shape once, here.
 */
export function normaliseReference(input: string): string | null {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("VCTR-") ? trimmed : `VCTR-${trimmed}`;
  return REFERENCE_PATTERN.test(withPrefix) ? withPrefix : null;
}

/**
 * Look up a shipment for public display.
 *
 * @param rawReference whatever the customer typed
 * @returns a public-safe projection; `found: false` when nothing matched
 */
export async function lookupTracking(rawReference: string): Promise<PublicTrackingResult> {
  const reference = normaliseReference(rawReference);

  // Returning the same shape for "malformed" and "does not exist" stops a
  // caller from distinguishing a real reference with a bad prefix from one that
  // was invented, which is a free enumeration oracle.
  if (!reference) return notFound();

  const db = await loadDb();

  const shipment = await db.query(
    `select s.tracking_reference,
            s.status::text        as current_status,
            s.service_type::text  as service_type,
            s.sender_state        as origin_state,
            s.recipient_state     as destination_state,
            s.estimated_delivery_at,
            s.delivered_at
       from public.shipments s
      where s.tracking_reference = $1`,
    [reference]
  );

  if (shipment.rows.length === 0) return notFound();

  const raw = shipment.rows[0] as Record<string, unknown>;
const s = {
  trackingReference: raw.tracking_reference as string | null,
  currentStatus: raw.current_status as string | null,
  serviceType: raw.service_type as string | null,
  originState: raw.origin_state as string | null,
  destinationState: raw.destination_state as string | null,
  estimatedDeliveryAt: raw.estimated_delivery_at as string | null,
  deliveredAt: raw.delivered_at as string | null,
};

  const events = await db.query(
    `select e.new_status::text   as status,
            e.public_message      as message,
            e.occurred_at         as occurred_at,
            e.location_name       as location_name
       from public.shipment_events e
      where e.shipment_id = (select id from public.shipments where tracking_reference = $1)
        and e.is_customer_visible = true
      order by e.occurred_at desc
      limit 50`,
    [reference]
  );

  const timeline: PublicTrackingEvent[] = events.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      status: (row.status as string | null) ?? 'unknown',
      message: (row.message as string | null) ?? null,
      occurredAt: (row.occurred_at as string | null) ?? new Date(0).toISOString(),
      locationName: (row.location_name as string | null) ?? null,
    };
  });

  return {
    trackingReference: s.trackingReference ?? reference,
    // State to state only. Never the street, locality or recipient.
    route:
      s.originState && s.destinationState
        ? `${s.originState} → ${s.destinationState}`
        : 'Route not stated',
    currentStatus: s.currentStatus ?? 'unknown',
    serviceType: s.serviceType ?? 'standard',
    estimatedDeliveryAt: s.estimatedDeliveryAt,
    deliveredAt: s.deliveredAt,
    events: timeline,
    found: true,
  };
}

/**
 * The not-found result.
 *
 * Carries no diagnostic detail. An error message like "reference format
 * invalid" versus "no such shipment" is an oracle: it tells an attacker which
 * of their guesses hit a real format. Both cases return exactly this.
 */
function notFound(): PublicTrackingResult {
  return {
    trackingReference: "",
    route: "",
    currentStatus: "unknown",
    serviceType: "standard",
    estimatedDeliveryAt: null,
    deliveredAt: null,
    events: [],
    found: false,
  };
}
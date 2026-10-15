import type { PGlite } from "@electric-sql/pglite";

/**
 * Shared database types.
 *
 * `Db` is deliberately narrow: the application depends on the four operations
 * it actually uses, not on every method PGlite exposes. That keeps the surface
 * a Supabase/Postgres adapter has to satisfy small, and it means swapping the
 * backing store is a compile error rather than a silent behavioural drift.
 */
export type Db = Pick<PGlite, "query" | "exec" | "close" | "transaction">;

export type Row = Record<string, unknown>;

/**
 * The PUBLIC tracking projection.
 *
 * This is the single most important type in the codebase for privacy.
 *
 * A public tracking page shows a stranger where a parcel is. It must NEVER
 * reveal: a phone number, an email address, a street address, an internal staff
 * note, or a declared value. The shape below is what may cross that boundary,
 * and the query that builds it selects these columns explicitly rather than
 * returning a shipment row and deleting fields afterwards — deleting after the
 * fact is how one forgotten field leaks.
 */
export interface PublicTrackingEvent {
  /** Machine status key. The UI maps it to a human label. */
  status: string;
  /** Already-redacted, customer-safe sentence. Never an internal note. */
  message: string | null;
  occurredAt: string;
  /** Coarse place name only, when the business has approved showing it. */
  locationName: string | null;
}

export interface PublicTrackingResult {
  trackingReference: string;
  /** Coarse route label, e.g. "Lagos → Oyo". Never the full address. */
  route: string;
  currentStatus: string;
  serviceType: string;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: PublicTrackingEvent[];
  /**
   * True when the lookup matched nothing. Deliberately indistinguishable from
   * "not found" for a wrong reference — see the lookup implementation.
   */
  found: boolean;
}
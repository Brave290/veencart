/**
 * Service definitions.
 *
 * Content rule for this file: describe what Veencart DOES, never what it
 * guarantees. No prices, no delivery-time promises, no coverage claims. Those
 * are business facts that are still being confirmed, and a marketing page is
 * the worst possible place to guess one — a customer reads it as a commitment.
 *
 * Anything route-specific ("we deliver Lagos to Ibadan for N2,500") comes from
 * the tariff tables at runtime, never from this file.
 */

export type ServiceSlug =
  | 'daily'
  | 'scheduled'
  | 'bulk'
  | 'interstate'
  | 'ecommerce';

export interface Service {
  slug: ServiceSlug;
  name: string;
  /** One sentence, factual, no promise. */
  summary: string;
  /** What the customer gets. Concrete and checkable. */
  included: string[];
  /** What we deliberately do not claim, stated up front. */
  notPromised: string;
}

export const SERVICES: Record<ServiceSlug, Service> = {
  daily: {
    slug: 'daily',
    name: 'Daily delivery',
    summary:
      'Movement within a covered city, collected and delivered on the same operating day or the next, depending on the service window booked.',
    included: [
      'Collection from your chosen address',
      'Delivery within the covered city area',
      'A tracking reference from the moment your booking is confirmed',
      'Delivery evidence captured at handover',
    ],
    notPromised:
      'Same-day delivery depends on the booking window and route capacity. If a same-day slot is not available, the booking flow tells you before you pay.',
  },
  scheduled: {
    slug: 'scheduled',
    name: 'Scheduled delivery',
    summary:
      'Book the collection day and time window that suits you, rather than being handed a fixed slot.',
    included: [
      'A chosen pickup date and window',
      'A chosen delivery window where the route allows one',
      'Rescheduling by our team if the window needs to change',
      'Notification at each stage of the movement',
    ],
    notPromised:
      'Scheduled windows are capacity-limited per route. Your booking is only confirmed once the window has been allocated.',
  },
  bulk: {
    slug: 'bulk',
    name: 'Bulk and freight',
    summary:
      'Palletised, multi-parcel and high-volume consignments, quoted individually by our operations team.',
    included: [
      'A quote request reviewed by staff before any commitment',
      'Itemised charges so you can see what you are paying for',
      'Declared value recorded for customs and insurance purposes',
      'Loading and handling agreed up front',
    ],
    notPromised:
      'Bulk movements are quoted, not instant-priced. We will not show you a figure before operations have reviewed the consignment.',
  },
  interstate: {
    slug: 'interstate',
    name: 'Interstate delivery',
    summary:
      'Movement between states, checked against live service areas before you commit to anything.',
    included: [
      'An availability check against active service areas',
      'A fixed tariff where one is configured, otherwise a staff quote',
      'In-transit status updates',
      'Proof of delivery with the recipient',
    ],
    notPromised:
      'Interstate coverage is confirmed per route, not per country. Unsupported routes go to a manual quote rather than receiving an invented price or an unkeepable delivery date.',
  },
  ecommerce: {
    slug: 'ecommerce',
    name: 'Ecommerce fulfilment',
    summary:
      'Order dispatch for online sellers, with stock, customer details and delivery tracked in one place.',
    included: [
      'Order records linked to the delivery they create',
      'Stock reserved at checkout so an order cannot be oversold',
      'Customer notifications at dispatch and delivery',
      'Delivery evidence retained against the order',
    ],
    notPromised:
      'Fulfilment capacity is set per route. If a delivery cannot be scheduled, the order stays visible to you rather than silently ageing as "processing".',
  },
};

export const SERVICE_SLUGS = Object.keys(SERVICES) as ServiceSlug[];

export function isServiceSlug(value: string): value is ServiceSlug {
  return Object.prototype.hasOwnProperty.call(SERVICES, value);
}
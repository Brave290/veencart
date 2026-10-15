import type { ReactElement } from 'react';
import { cn } from '@/lib/cn';
import { tokens } from '@/lib/design-tokens';


/**
 * StatusBadge — the one place a shipment, payment or order status becomes
 * something a human reads.
 *
 * WHY THIS IS A SINGLE MAPPING RATHER THAN A STYLE PER CALL SITE
 * The sixteen shipment statuses appear across the public tracking page, the
 * customer account, the admin queue and the driver workspace. If each of those
 * chose its own colour, "cancelled" would be red on one screen and grey on
 * another, and an operator scanning for failures would miss half of them. The
 * mapping lives here so that a status has ONE meaning everywhere.
 *
 * NEVER COLLAPSE A BADGE TO COLOUR ALONE
 * Every badge also carries a glyph and a text label. Around 1 in 12 men has a
 * red-green colour vision deficiency, and this UI is used in daylight, on
 * cheap phone screens, in warehouses. Colour is the third signal, never the
 * only one.
 *
 * The surface/text/edge pairs come from the measured token set; each pairing
 * clears WCAG 2.1 AA for its text (contrast ratios recorded in design-tokens).
 */

export type StatusFamily = keyof typeof tokens.status.families;


export const SHIPMENT_STATUSES = [
  'requested',
  'awaiting_quote',
  'quoted',
  'quote_accepted',
  'awaiting_payment',
  'confirmed',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'on_hold',
  'delivery_failed',
  'exception',
  'returned_to_sender',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PRODUCT_ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'dispatched',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type ProductOrderStatus = (typeof PRODUCT_ORDER_STATUSES)[number];

/**
 * Family per status. Grouped by what the status MEANS, so a screen reader and
 * an operator both get the same grouping:
 *   neutral — nothing has happened yet / just request intake
 *   info    — the ball is in someone else's court (waiting on a quote or payment)
 *   brand   — Veencart is actively working it
 *   success — done, and done well
 *   warning — paused, needs a human decision
 *   danger  — failed, cancelled or sent back
 */
const SHIPMENT_FAMILY: Record<ShipmentStatus, StatusFamily> = {
  requested: 'neutral',
  awaiting_quote: 'info',
  quoted: 'info',
  quote_accepted: 'brand',
  awaiting_payment: 'info',
  confirmed: 'brand',
  pickup_scheduled: 'brand',
  picked_up: 'brand',
  in_transit: 'brand',
  out_for_delivery: 'brand',
  delivered: 'success',
  cancelled: 'danger',
  on_hold: 'warning',
  delivery_failed: 'danger',
  exception: 'danger',
  returned_to_sender: 'danger',
};

const PAYMENT_FAMILY: Record<PaymentStatus, StatusFamily> = {
  pending: 'info',
  processing: 'info',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  partially_refunded: 'warning',
  refunded: 'neutral',
};

const ORDER_FAMILY: Record<ProductOrderStatus, StatusFamily> = {
  pending_payment: 'info',
  paid: 'success',
  processing: 'brand',
  dispatched: 'brand',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

/** Human labels. The raw enum value is never shown to a customer. */
const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  requested: 'Requested',
  awaiting_quote: 'Awaiting quote',
  quoted: 'Quote ready',
  quote_accepted: 'Quote accepted',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  pickup_scheduled: 'Pickup scheduled',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  on_hold: 'On hold',
  delivery_failed: 'Delivery failed',
  exception: 'Exception',
  returned_to_sender: 'Returned to sender',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  succeeded: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
};

const ORDER_LABEL: Record<ProductOrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  processing: 'Being prepared',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** Glyphs — the second, colour-independent signal. */
const SHIPMENT_GLYPH: Record<ShipmentStatus, string> = {
  requested: '•',
  awaiting_quote: '…',
  quoted: '…',
  quote_accepted: '✓',
  awaiting_payment: '₦',
  confirmed: '✓',
  pickup_scheduled: '◷',
  picked_up: '↑',
  in_transit: '→',
  out_for_delivery: '⇥',
  delivered: '✓',
  cancelled: '✕',
  on_hold: '⏸',
  delivery_failed: '!',
  exception: '!',
  returned_to_sender: '↩',
};

/**
 * Family → classes.
 *
 * THESE STRINGS MUST BE COMPLETE LITERALS IN THE SOURCE.
 * An earlier version built them by interpolation:
 *     `bg-[${c['status-success-surface']}] text-[${c['status-success-text']}]`
 * That silently produced UNSTYLED BADGES. Tailwind scans source TEXT for whole
 * class names; a class assembled at runtime never appears in the scan, so the
 * rule is never generated. Nothing errors — the badge simply renders with no
 * tint, which is exactly the failure this component exists to prevent.
 * Verified by grepping the compiled CSS for the oklch values: all absent.
 *
 * The same hazard applies to `transition-[${x}]` and any assembled variant. If a
 * class name is not a complete string literal somewhere in the source, it does
 * not exist.
 */
function familyClasses(family: StatusFamily): string {
  switch (family) {
    case 'neutral':
      return 'bg-surface-muted text-content-muted ring-line';
    case 'info':
      return 'bg-info-surface text-info-text ring-info-border';
    case 'brand':
      return 'bg-primary-subtle text-primary ring-primary-ring';
    case 'success':
      return 'bg-success-surface text-success-text ring-success-border';
    case 'warning':
      return 'bg-warning-surface text-warning-text ring-warning-border';
    case 'danger':
      return 'bg-danger-subtle text-danger-text ring-danger-strong/40';
  }
}

const BASE =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap';

export type StatusBadgeProps =
  | ({ kind: 'shipment'; status: ShipmentStatus } & CommonProps)
  | ({ kind: 'payment'; status: PaymentStatus } & CommonProps)
  | ({ kind: 'order'; status: ProductOrderStatus } & CommonProps);

type CommonProps = {
  className?: string;
  /** Render the status machine key under the label — useful in staff tools. */
  showKey?: boolean;
};

export function StatusBadge(props: StatusBadgeProps): ReactElement {
  const { className, showKey = false } = props;
  const { family, label, glyph } = resolve(props);

  return (
    <span
      // The status is announced, not merely coloured.
      role="status"
      data-status={props.status}
      data-status-family={family}
      className={cn(BASE, familyClasses(family), className)}
    >
      <span aria-hidden="true" className="leading-none">
        {glyph}
      </span>
      <span>{label}</span>
      {showKey ? (
        <span className="font-mono text-[0.65rem] opacity-70">{props.status}</span>
      ) : null}
    </span>
  );
}

function resolve(p: StatusBadgeProps): {
  family: StatusFamily;
  label: string;
  glyph: string;
} {
  if (p.kind === 'shipment') {
    return {
      family: SHIPMENT_FAMILY[p.status],
      label: SHIPMENT_LABEL[p.status],
      glyph: SHIPMENT_GLYPH[p.status],
    };
  }
  if (p.kind === 'payment') {
    return {
      family: PAYMENT_FAMILY[p.status],
      label: PAYMENT_LABEL[p.status],
      glyph: PAYMENT_FAMILY[p.status] === 'success' ? '✓' : PAYMENT_FAMILY[p.status] === 'danger' ? '✕' : '…',
    };
  }
  return {
    family: ORDER_FAMILY[p.status],
    label: ORDER_LABEL[p.status],
    glyph: ORDER_FAMILY[p.status] === 'success' ? '✓' : ORDER_FAMILY[p.status] === 'danger' ? '✕' : '•',
  };
}

export const statusFamilies = {
  shipment: SHIPMENT_FAMILY,
  payment: PAYMENT_FAMILY,
  order: ORDER_FAMILY,
} as const;
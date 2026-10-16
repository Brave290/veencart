import { z } from "zod";

/**
 * Booking input schema.
 *
 * WHY THIS IS VALIDATED AGAINST A HARDENED LIST OF NIGERIAN STATES
 * Nigeria has 36 states plus the FCT. Free-typing a state name produces
 * "Lagos state", "lagos", "Lagos State" and "LA" as four different values in
 * one column, and every downstream coverage check then fails to match. A
 * closed enum makes "is this route covered?" answerable at all.
 *
 * This is deliberately NOT a lookup of service areas. Coverage is a business
 * decision that changes; the country's geography does not.
 */

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const SERVICE_TYPES = [
  'same_day',
  'next_day',
  'express',
  'standard',
  'economy',
  'freight',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * Human-facing labels.
 *
 * The enum key is stored in the database; customers never see a raw enum value.
 * "next_day" on a booking confirmation looks like a database leak.
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  same_day: 'Same-day delivery',
  next_day: 'Next-day delivery',
  express: 'Express delivery',
  standard: 'Standard delivery',
  economy: 'Economy delivery',
  freight: 'Freight / bulk',
};

export const PAYER_ROLES = ['sender', 'recipient'] as const;
export type PayerRole = (typeof PAYER_ROLES)[number];

/**
 * Nigerian phone numbers.
 *
 * Accepts the formats people actually type and reach for: 0803…, +234803…,
 * 234803…. Rejects letters and absurd lengths. Deliberately NOT over-strict:
 * a booking form that rejects a valid phone number because someone typed a
 * space loses the customer, and an over-strict pattern is the usual cause.
 */
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ''))
  .refine((v) => /^(\+?234|0)[789]\d{9}$/.test(v), {
    message: 'Enter a valid Nigerian phone number, e.g. 0803 123 4567',
  });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

const name = z.string().trim().min(2, 'Enter a name').max(120);

const street = z.string().trim().min(3, 'Enter a street address').max(200);
const locality = z.string().trim().min(2, 'Enter a locality or area').max(120);
const city = z.string().trim().min(2, 'Enter a city').max(120);

const state = z.enum(NIGERIAN_STATES, {
  message: 'Choose a state',
});

/* ========================================================================== */
/* OPTIONAL FIELD COERCION — the rule a browser forces on us                    */
/* ========================================================================== */

/**
 * An optional text field that a browser can leave BLANK.
 *
 * WHY THIS EXISTS, AND THE BUG IT FIXES
 * `FormData.get('notes')` returns **`null`** when a field is left empty and the
 * browser therefore never submitted it. It does NOT return `''` and it does NOT
 * return `undefined`.
 *
 * So the obvious schema — `z.string().optional()` — rejects a customer who left
 * a genuinely optional field alone. `.optional()` permits `undefined`, never
 * `null`. The old workaround here was `.optional().or(z.literal(''))`, which
 * accepts a blank string but still rejects the `null` a real browser sends.
 *
 * That is not theoretical: it was found by a test asserting that a well-formed
 * submission survives the FormData round trip. Leaving the notes box empty —
 * the normal case for almost every customer — would have failed validation with
 * a message about a field they had deliberately left alone.
 *
 * `null` and `undefined` both become `''` here, and downstream code already
 * treats `''` as "not supplied" via `|| null`.
 */
const blankToEmpty = (v: unknown) => (v === null || v === undefined ? '' : v);

/** Optional single-line text: email, landmark, notes. */
/**
 * Optional email.
 *
 * Blank becomes `undefined`, NOT `''` — and this is the one field where the
 * difference matters. `''` is not a valid email address, so normalising a blank
 * input to `''` and then running `.email()` on it fails with "Enter a valid
 * email address" on a field the customer deliberately left empty. The `.email()`
 * check has to be skipped entirely, which only happens for `undefined`.
 */
const optionalEmail = z.preprocess(
  (v) => (v === null || v === undefined || v === '' ? undefined : v),
  email.optional()
);

const optionalText = (max: number) =>
  z.preprocess(blankToEmpty, z.string().trim().max(max));

/**
 * Optional NUMBER field, which fails differently and more confusingly.
 *
 * `z.coerce.number()` applied to `null` produces `0`, not an error. With
 * `.positive()` behind it, a customer who left the dimensions blank got
 * "Weight must be greater than zero" pointed at a box they never filled in —
 * on a field they had no reason to fill in, because dimensions are optional.
 *
 * Blank and `null` are normalised to `undefined` FIRST, so the field is
 * genuinely absent rather than coerced into a number the customer never gave.
 */
const optionalPositiveNumber = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    // `.optional()` goes INSIDE, on the coerced schema.
    //
    // Without it, `undefined` reaches `z.coerce.number()`, which does
    // `Number(undefined)` and yields `NaN` — so a genuinely absent field failed
    // with "expected number, received NaN". `ZodOptional` short-circuits
    // `undefined` before the coercion runs, which is the whole point of it.
    z.coerce.number().positive().max(max).optional()
  );

/** Parcel weight in kilograms, as a number in the wire format. */
const weightKg = z.coerce
  .number({ message: 'Enter a weight in kilograms' })
  .positive('Weight must be greater than zero')
  .max(1000, 'For a consignment this heavy, please contact us for freight pricing');

export const bookingInputSchema = z
  .object({
    serviceType: z.enum(SERVICE_TYPES, { message: 'Choose a delivery service' }),

    sender: z.object({
      name,
      phone,
      email: optionalEmail,
      street,
      locality,
      city,
      state,
    }),

    recipient: z.object({
      name,
      phone,
      email: optionalEmail,
      street,
      streetDetail: optionalText(200),
      locality,
      city,
      state,
    }),

    parcel: z.object({
      description: z.string().trim().min(2, 'Describe the contents').max(500),
      quantity: z.coerce
        .number()
        .int('Enter a whole number of items')
        .min(1, 'At least one item')
        .max(999, 'For more than 999 items please request a bulk quote'),
      weightKg,
      lengthCm: optionalPositiveNumber(500),
      widthCm: optionalPositiveNumber(500),
      heightCm: optionalPositiveNumber(500),
      isFragile: z.coerce.boolean().default(false),
    }),

    /** Who is expected to settle the bill. Snapshotted at booking time. */
    payerRole: z.enum(PAYER_ROLES, { message: 'Choose who is paying' }),

    /**
     * Recipient pays. When true the recipient's contact is required, because a
     * payment link will be sent to them. When false the payer is the sender and
     * the sender's details are used.
     */
    recipientPays: z.coerce.boolean().default(false),

    preferredPickupDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a pickup date')
      .refine((v) => {
        // Compare against today's date in Africa/Lagos, not UTC — otherwise a
        // booking made at 23:30 WAT can land on "yesterday" and be rejected.
        const now = new Date();
        const lagos = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Lagos',
          year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(now);
        return v >= lagos;
      }, 'Pickup date cannot be in the past')
      .refine(
        (v) => {
          const d = new Date(`${v}T00:00:00Z`);
          const max = new Date();
          max.setDate(max.getDate() + 90);
          return d <= max;
        },
        'Pickup date must be within the next 90 days'
      ),

    notes: optionalText(1000),

    /** Consent is explicit and recorded. Not pre-ticked, not implied by use. */
    consentToContact: z.literal(true, {
      message: 'We need your permission to contact you about this delivery',
    }),
  })
  .superRefine((data, ctx) => {
    // Same-city same-day is not physically always possible. Saying so here is
    // honest; quoting a price and a promise and failing later is not.
    if (data.serviceType === 'same_day') {
      const sameCity =
        data.sender.state === data.recipient.state &&
        data.sender.city.toLowerCase() === data.recipient.city.toLowerCase();
      if (!sameCity) {
        ctx.addIssue({
          code: 'custom',
          path: ['serviceType'],
          message:
            'Same-day delivery is only offered within one city. Choose next-day or another service.',
        });
      }
    }

    // Recipient pays means we must be able to reach the recipient.
    if (data.recipientPays && !data.recipient.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['recipient', 'email'],
        message:
          'A recipient email is required — the payment link is sent to them.',
      });
    }
  });

export type BookingInput = z.infer<typeof bookingInputSchema>;

/**
 * Flattened, DB-ready row shape.
 *
 * Kept separate from the input type on purpose: the input is what the customer
 * typed, this is what the database columns are. Merging them means a future
 * column rename silently changes what the form accepts.
 */
export type BookingRow = {
  service_type: ServiceType;
  /**
   * `draft` means "accepted and stored, price not yet attached" — the pricing
   * engine moves it to `quoted`. `requested` exists on `shipment_status`, NOT
   * on `booking_status`; using it here is a type error the database would
   * otherwise surface at runtime.
   */
  status: 'draft' | 'quote_requested';
  sender_name: string;
  sender_phone: string;
  sender_email: string | null;
  sender_street: string;
  sender_locality: string;
  sender_city: string;
  sender_state: NigerianState;
  sender_country: 'NG';
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string | null;
  recipient_street: string;
  recipient_street_detail: string | null;
  recipient_locality: string;
  recipient_city: string;
  recipient_state: NigerianState;
  recipient_country: 'NG';
  item_count: number;
  total_weight_kg: string;
  contents_description: string;
  is_fragile: boolean;
  special_instructions: string | null;
};

/** Map validated input onto booking columns. Pure — no database access. */
export function toBookingRow(input: BookingInput): BookingRow {
  return {
    service_type: input.serviceType,
    status: 'draft',
    sender_name: input.sender.name,
    sender_phone: input.sender.phone,
    sender_email: input.sender.email || null,
    sender_street: input.sender.street,
    sender_locality: input.sender.locality,
    sender_city: input.sender.city,
    sender_state: input.sender.state,
    sender_country: 'NG',
    recipient_name: input.recipient.name,
    recipient_phone: input.recipient.phone,
    recipient_email: input.recipient.email || null,
    recipient_street: input.recipient.street,
    recipient_street_detail: input.recipient.streetDetail || null,
    recipient_locality: input.recipient.locality,
    recipient_city: input.recipient.city,
    recipient_state: input.recipient.state,
    recipient_country: 'NG',
    item_count: input.parcel.quantity,
    // Numeric(10,3) in Postgres, so a STRING. Passing a JS number would go
    // through float64 and lose exactness on the boundary.
    total_weight_kg: input.parcel.weightKg.toFixed(3),
    contents_description: input.parcel.description,
    is_fragile: input.parcel.isFragile,
    special_instructions: input.notes || null,
  };
}
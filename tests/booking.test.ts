import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { bootDatabase, type Db } from "./helpers/db";
import { bookingInputSchema, toBookingRow } from "../backend/src/lib/booking-schema";
import { checkCoverage, createBooking, quoteReasonMessage, type QuoteReason } from "../backend/src/lib/booking-service";

/**
 * Booking write path — the first real INSERT in the system.
 *
 * The tests that matter most here are the ones asserting what the system does
 * NOT do: no invented price on an uncovered route, no booking without its
 * parcel items, no raw guest token in the database. A booking feature that
 * quietly fabricates a price is worse than no booking feature at all.
 */

let db: Db;

const TODAY = new Date();
const PICKUP = new Date(TODAY.getTime() + 3 * 86400_000).toISOString().slice(0, 10);

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    serviceType: 'next_day',
    sender: {
      name: 'Fatima Customer',
      phone: '08031234567',
      email: 'customer.a@veencart.test',
      street: '12 Demo Street',
      locality: 'Lagos Island',
      city: 'Lagos Island',
      state: 'Lagos',
    },
    recipient: {
      name: 'Ibrahim Recipient',
      phone: '08059876543',
      email: 'recipient@veencart.test',
      street: '45 Demo Road',
      streetDetail: 'Blue gate',
      locality: 'Ibadan North',
      city: 'Ibadan',
      state: 'Oyo',
    },
    parcel: {
      description: 'Books and stationery',
      quantity: 1,
      weightKg: 2.5,
      isFragile: false,
    },
    payerRole: 'sender',
    recipientPays: false,
    preferredPickupDate: PICKUP,
    notes: '',
    consentToContact: true,
    ...overrides,
  };
}

beforeAll(async () => {
  db = await bootDatabase();
}, 180_000);

afterAll(async () => {
  await db?.close();
});

describe("booking input validation", () => {
  it("accepts a well-formed booking", () => {
    const parsed = bookingInputSchema.safeParse(validInput());
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it("rejects a pickup date in the past", () => {
    const parsed = bookingInputSchema.safeParse(
      validInput({ preferredPickupDate: '2020-01-01' })
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown state", () => {
    const parsed = bookingInputSchema.safeParse(
      validInput({ sender: { ...validInput().sender, state: 'Wakanda' } })
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed Nigerian phone number", () => {
    for (const bad of ['12345', 'not-a-phone', '+1 555 0100']) {
      const parsed = bookingInputSchema.safeParse(
        validInput({ sender: { ...validInput().sender, phone: bad } })
      );
      expect(parsed.success, `${bad} should be rejected`).toBe(false);
    }
  });

  it("accepts the formats people actually type", () => {
    // Over-strict phone validation is a real cause of lost bookings.
    for (const good of ['08031234567', '+2348031234567', '0803 123 4567', '(0803) 123-4567']) {
      const parsed = bookingInputSchema.safeParse(
        validInput({ sender: { ...validInput().sender, phone: good } })
      );
      expect(parsed.success, `${good} should be accepted`).toBe(true);
    }
  });

  it("requires consent to be explicitly given", () => {
    const parsed = bookingInputSchema.safeParse(
      validInput({ consentToContact: false })
    );
    expect(parsed.success).toBe(false);
  });

  it("requires a recipient email when the recipient is paying", () => {
    const parsed = bookingInputSchema.safeParse(
      validInput({
        recipientPays: true,
        recipient: { ...validInput().recipient, email: '' },
      })
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects same-day delivery between different cities", () => {
    // Offering same-day Lagos→Ibadan would be a promise we cannot keep.
    const parsed = bookingInputSchema.safeParse(validInput({ serviceType: 'same_day' }));
    expect(parsed.success).toBe(false);
  });

  it("allows same-day delivery within one city", () => {
    const parsed = bookingInputSchema.safeParse(
      validInput({
        serviceType: 'same_day',
        recipient: { ...validInput().recipient, city: 'Lagos Island', state: 'Lagos' },
      })
    );
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it("coerces form strings into numbers", () => {
    // HTML form fields submit strings. Without coercion every quantity and
    // weight arrives as a string and silently poisons arithmetic downstream.
    const parsed = bookingInputSchema.safeParse(
      validInput({ parcel: { description: 'Books', quantity: '3', weightKg: '4.25', isFragile: 'on' } })
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.parcel.quantity).toBe(3);
      expect(parsed.data.parcel.weightKg).toBe(4.25);
      expect(parsed.data.parcel.isFragile).toBe(true);
    }
  });
});

describe("route coverage — the no-invented-price rule", () => {
  it("reports covered for a configured route", async () => {
    const input = bookingInputSchema.parse(validInput());
    const result = await checkCoverage(db, input);
    expect(result.kind).toBe('covered');
  });

  it("sends an uncovered destination to a quote request, not a price", async () => {
    const input = bookingInputSchema.parse(
      validInput({
        recipient: {
          ...validInput().recipient,
          city: 'Nowhere Central',
          state: 'Borno',
        },
      })
    );
    const result = await checkCoverage(db, input);
    expect(result.kind).toBe('needs_quote');
    // Whatever the reason, the message must never contain a price.
    const message = quoteReasonMessage((result as { reason: QuoteReason }).reason);
    expect(message).not.toMatch(/₦|naira|amount|cost|free/i);
  });

  it('treats an explicitly EXCLUDED route as unpriced', async () => {
    // The seed excludes Oyo → Lagos economy. An excluded route must never
    // fall through to a tariff just because a rule row exists.
    const input = bookingInputSchema.parse(
      validInput({
        serviceType: 'economy',
        sender: { ...validInput().sender, city: 'Ibadan', locality: 'Ibadan North', state: 'Oyo' },
        recipient: {
          ...validInput().recipient,
          city: 'Lagos Island',
          locality: 'Lagos Island',
          state: 'Lagos',
        },
      })
    );
    const result = await checkCoverage(db, input);
    expect(result.kind).toBe('needs_quote');
  });

  it("routes an overweight consignment to freight rather than pricing it", async () => {
    const input = bookingInputSchema.parse(
      validInput({ parcel: { ...validInput().parcel, weightKg: 200 } })
    );
    const result = await checkCoverage(db, input);
    expect(result.kind).toBe('needs_quote');
    expect((result as { reason: string }).reason).toBe('too_heavy');
  });
});

describe("createBooking", () => {
  it("persists the booking and its parcel items together", async () => {
    const input = bookingInputSchema.parse(validInput());
    const result = await createBooking(db, input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const booking = await rows<{ id: string; status: string; booking_reference: string }>(
      await db.query(
        `select id, status, booking_reference from public.bookings where booking_reference = $1`,
        [result.bookingReference]
      )
    );
    expect(booking).toHaveLength(1);

    const items = await rows<{ count: number }>(
      await db.query(
        `select count(*)::int as count from public.booking_items where booking_id = $1`,
        [booking[0]?.id]
      )
    );
    expect(items[0]?.count).toBe(1);
  });

  it("NEVER returns a price on an unpriced route", async () => {
    const input = bookingInputSchema.parse(
      validInput({
        recipient: { ...validInput().recipient, city: 'Nowhere Central', state: 'Borno' },
      })
    );
    const result = await createBooking(db, input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A quote request, not a confirmed priced booking.
    expect(result.status).toBe('quote_requested');

    // And no monetary column was written anywhere on this booking.
    const priced = await rows<{ n: number }>(
      await db.query(
        `select count(*)::int as n
           from public.bookings b
           left join public.quotes q on q.booking_id = b.id
          where b.booking_reference = $1 and q.total_minor is not null`,
        [result.bookingReference]
      )
    );
    expect(priced[0]?.n).toBe(0);
  });

  it("stores only the guest token HASH, never the raw token", async () => {
    const input = bookingInputSchema.parse(validInput());
    const result = await createBooking(db, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = await rows<{ token_hash: string }>(
      await db.query(`select token_hash from public.guest_access_tokens`)
    );

    // The raw token must not appear anywhere in the table.
    const raw = result.guestToken;
    for (const row of stored) {
      expect(row.token_hash).not.toBe(raw);
      expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(stored.length).toBeGreaterThan(0);
  });

  it("returns a high-entropy, unambiguous reference", async () => {
    const refs = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const result = await createBooking(db, bookingInputSchema.parse(validInput()));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.bookingReference).toMatch(/^VCB-[0-9A-HJKMNP-TV-Z]{10}$/);
      refs.add(result.bookingReference);
    }
    // 25 identical references would mean the generator is not random at all.
    expect(refs.size).toBe(25);
  });

  it("satisfies the ownership CHECK with a guest reference and no customer", async () => {
    const input = bookingInputSchema.parse(validInput());
    const result = await createBooking(db, input, { customerUserId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const booking = await rows<{ guest_booking_reference: string | null }>(
      await db.query(
        `select guest_booking_reference from public.bookings where booking_reference = $1`,
        [result.bookingReference]
      )
    );
    // Ownership CHECK: either a customer or a guest reference, never neither.
    expect(booking[0]?.guest_booking_reference).toBe(result.bookingReference);
  });

  it("uses customer_user_id and a null guest reference for a signed-in customer", async () => {
    // A real auth uid. This does not need the user to exist in `profiles` —
    // `customer_user_id` has no FK, it is the auth user's id carried over.
    const input = bookingInputSchema.parse(validInput());
    const result = await createBooking(db, input, { customerUserId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const booking = await rows<{ customer_user_id: string | null; guest_booking_reference: string | null }>(
      await db.query(
        `select customer_user_id, guest_booking_reference from public.bookings where booking_reference = $1`,
        [result.bookingReference]
      )
    );
    expect(booking[0]?.customer_user_id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    // A guest reference alongside a customer would be two competing keys to the
    // same booking — one of them is guaranteed to become wrong.
    expect(booking[0]?.guest_booking_reference).toBeNull();

    // And no guest token is minted for someone who can just log in.
    const tokens = await rows<{ n: number }>(
      await db.query(`select count(*)::int as n from public.guest_access_tokens where booking_id = (
        select id from public.bookings where booking_reference = $1)`, [result.bookingReference])
    );
    expect(tokens[0]?.n).toBe(0);
  });
});

describe("toBookingRow", () => {
  it("serialises weight as a string for numeric(10,3)", () => {
    const row = toBookingRow(bookingInputSchema.parse(validInput()));
    // Passing a JS number would route through float64 and lose exactness at
    // the boundary. Numeric must receive a string.
    expect(typeof row.total_weight_kg).toBe('string');
    expect(row.total_weight_kg).toBe('2.500');
  });

  it("defaults the country to NG rather than trusting the client", () => {
    const row = toBookingRow(bookingInputSchema.parse(validInput()));
    expect(row.sender_country).toBe('NG');
    expect(row.recipient_country).toBe('NG');
  });

  it("normalises empty optional strings to null", () => {
    const row = toBookingRow(bookingInputSchema.parse(validInput({ notes: '' })));
    expect(row.special_instructions).toBeNull();
  });
});

function rows<T>(r: { rows: unknown[] }): T[] {
  return r.rows as T[];
}
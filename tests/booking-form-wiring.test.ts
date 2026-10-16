import { describe, expect, it } from 'vitest';

import {
  fieldErrorsFromIssues,
  formDataToBookingInput,
} from '../backend/src/lib/booking-form-mapping';
import { bookingInputSchema } from '../backend/src/lib/booking-schema';

/**
 * THE FORM WIRING
 *
 * A booking form is twenty-eight inputs, each connected to the server by a `name`
 * attribute held in a different file from the code that reads it. Nothing about
 * that is type-checked, and a mistyped name is invisible until a customer hits
 * submit and a required field reports "Choose a state" for a state they filled
 * in perfectly.
 *
 * So this file asserts the WIRING, not the schema. The schema already has 23
 * tests in booking.test.ts and behaves. What is untested is whether the form's
 * field names match the mapping that reads them.
 *
 * IT ALREADY PAID FOR ITSELF: the round-trip test below caught a real bug where
 * leaving an optional field blank produced `null` from `FormData.get()`, which
 * the schema rejected. Almost every customer leaves the notes box empty.
 */

const PICKUP = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);

/** Every `name` the form renders, paired with where the mapper must put it. */
const EXPECTED_WIRING: Array<[formName: string, mappedPath: string]> = [
  ['serviceType', 'serviceType'],
  ['senderName', 'sender.name'],
  ['senderPhone', 'sender.phone'],
  ['senderEmail', 'sender.email'],
  ['senderStreet', 'sender.street'],
  ['senderLocality', 'sender.locality'],
  ['senderCity', 'sender.city'],
  ['senderState', 'sender.state'],
  ['recipientName', 'recipient.name'],
  ['recipientPhone', 'recipient.phone'],
  ['recipientEmail', 'recipient.email'],
  ['recipientStreet', 'recipient.street'],
  ['recipientStreetDetail', 'recipient.streetDetail'],
  ['recipientLocality', 'recipient.locality'],
  ['recipientCity', 'recipient.city'],
  ['recipientState', 'recipient.state'],
  ['parcelDescription', 'parcel.description'],
  ['parcelQuantity', 'parcel.quantity'],
  ['parcelWeightKg', 'parcel.weightKg'],
  ['parcelLengthCm', 'parcel.lengthCm'],
  ['parcelWidthCm', 'parcel.widthCm'],
  ['parcelHeightCm', 'parcel.heightCm'],
  ['parcelFragile', 'parcel.isFragile'],
  ['payerRole', 'payerRole'],
  ['recipientPays', 'recipientPays'],
  ['preferredPickupDate', 'preferredPickupDate'],
  ['notes', 'notes'],
  ['consentToContact', 'consentToContact'],
];

const COMPLETE: Record<string, string> = {
  serviceType: 'next_day',
  senderName: 'Fatima Customer',
  senderPhone: '08031234567',
  senderEmail: 'fatima@example.test',
  senderStreet: '12 Allen Avenue',
  senderLocality: 'Ikeja',
  senderCity: 'Lagos',
  senderState: 'Lagos',
  recipientName: 'Ibrahim Recipient',
  recipientPhone: '08059876543',
  recipientEmail: 'ibrahim@example.test',
  recipientStreet: '45 Demo Road',
  recipientStreetDetail: 'Blue gate',
  recipientLocality: 'Ibadan North',
  recipientCity: 'Ibadan',
  recipientState: 'Oyo',
  parcelDescription: 'Books and stationery',
  parcelQuantity: '2',
  parcelWeightKg: '3.5',
  payerRole: 'sender',
  preferredPickupDate: PICKUP,
  consentToContact: 'on',
};

function buildFormData(
  overrides: Record<string, string | null> = {},
  omit: string[] = []
): FormData {
  const fd = new FormData();
  const merged = { ...COMPLETE, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || omit.includes(key)) continue;
    fd.append(key, value);
  }
  return fd;
}

function readPath(root: unknown, path: string): { exists: boolean; value: unknown } {
  let node: unknown = root;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object') return { exists: false, value: undefined };
    if (!(key in (node as Record<string, unknown>))) {
      return { exists: false, value: undefined };
    }
    node = (node as Record<string, unknown>)[key];
  }
  return { exists: true, value: node };
}

describe('form wiring — every rendered field reaches the mapper', () => {
  it('maps all 28 form fields to a real key in the mapped object', () => {
    const raw = formDataToBookingInput(buildFormData()) as Record<string, unknown>;

    const unwired = EXPECTED_WIRING.filter(([, path]) => !readPath(raw, path).exists).map(
      ([name, path]) => `${name} -> ${path}`
    );

    expect(
      unwired,
      `form fields not wired to the mapper: ${unwired.join(', ')}`
    ).toEqual([]);
  });

  it('has no drift between the wiring table and reality', () => {
    // If someone adds a field to the form and forgets the table, this fails.
    // The count is the cheap canary.
    expect(EXPECTED_WIRING).toHaveLength(28);
  });
});

describe('form wiring — a real submission survives the round trip', () => {
  it('is accepted by the schema with values intact', () => {
    const parsed = bookingInputSchema.safeParse(formDataToBookingInput(buildFormData()));

    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(
      true
    );
    if (!parsed.success) return;

    expect(parsed.data.sender.phone).toBe('08031234567');
    expect(parsed.data.sender.state).toBe('Lagos');
    expect(parsed.data.recipient.streetDetail).toBe('Blue gate');
    expect(parsed.data.parcel.quantity).toBe(2);
    expect(parsed.data.parcel.weightKg).toBe(3.5);
    expect(parsed.data.consentToContact).toBe(true);
  });

  it('accepts the normal case — optional fields left BLANK', () => {
    // THE REGRESSION THIS FILE EXISTS FOR.
    //
    // A browser omits an empty input from FormData entirely, so `get()` returns
    // `null` — not `''`, not `undefined`. The schema rejected that, so the
    // ordinary act of not filling in "Landmark", "Notes" and the three
    // dimension boxes failed validation. Almost every customer leaves them empty.
    const fd = buildFormData({
      senderEmail: null,
      recipientEmail: null,
      recipientStreetDetail: null,
    });
    // Explicitly blank the rest, as a browser would.
    for (const name of ['notes', 'parcelLengthCm', 'parcelWidthCm', 'parcelHeightCm']) {
      // Not appended at all — this is what "blank" means on the wire.
      expect(fd.get(name)).toBeNull();
    }

    const parsed = bookingInputSchema.safeParse(formDataToBookingInput(fd));

    expect(
      parsed.success,
      `blank optional fields rejected: ${JSON.stringify(
        parsed.success ? [] : parsed.error.issues
      )}`
    ).toBe(true);
    if (!parsed.success) return;

    // Blank email is absent, not an empty string pretending to be an address.
    expect(parsed.data.sender.email ?? '').toBe('');
    expect(parsed.data.notes ?? '').toBe('');
    expect(parsed.data.parcel.lengthCm).toBeUndefined();
  });

  it('reads a ticked checkbox as true', () => {
    const fd = buildFormData({ parcelFragile: 'on', recipientPays: 'on' });
    const raw = formDataToBookingInput(fd) as Record<string, unknown>;

    // Browsers submit the literal string 'on'. Comparing against 'true' would
    // silently mark every checkbox in the form as unticked.
    expect((raw.parcel as Record<string, unknown>).isFragile).toBe(true);
    expect(raw.recipientPays).toBe(true);
    expect(bookingInputSchema.safeParse(raw).success).toBe(true);
  });

  it('reads an unticked checkbox as false, and absent consent as refused', () => {
    const fd = buildFormData(
      { consentToContact: null },
      ['parcelFragile', 'recipientPays']
    );
    const raw = formDataToBookingInput(fd) as Record<string, unknown>;

    expect((raw.parcel as Record<string, unknown>).isFragile).toBe(false);
    expect(raw.recipientPays).toBe(false);
    expect(raw.consentToContact).toBe(false);

    // Not a validation ERROR — consent was not ticked, so the booking is refused.
    const parsed = bookingInputSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const keys = fieldErrorsFromIssues(parsed.error.issues);
      expect(Object.keys(keys)).toContain('consentToContact');
    }
  });

  it('leaves phone formatting to the schema', () => {
    // Formatting belongs in one place. Stripping characters in the mapper would
    // duplicate the rule and let the two drift.
    const fd = buildFormData({ senderPhone: '(0803) 123-4567' });
    const raw = formDataToBookingInput(fd) as Record<string, unknown>;

    expect((raw.sender as Record<string, unknown>).phone).toBe('(0803) 123-4567');
    expect(bookingInputSchema.safeParse(raw).success).toBe(true);
  });

  it('reports an emptied required field against that field', () => {
    const fd = buildFormData({ senderState: '' });
    const parsed = bookingInputSchema.safeParse(formDataToBookingInput(fd));

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(Object.keys(fieldErrorsFromIssues(parsed.error.issues))).toContain(
      'sender.state'
    );
  });
});

describe('fieldErrorsFromIssues — one message per field', () => {
  it('collapses repeated issues on one field to the first message', () => {
    const errors = fieldErrorsFromIssues([
      { path: ['sender', 'phone'], message: 'Enter a valid Nigerian phone number' },
      { path: ['sender', 'phone'], message: 'Too short' },
    ]);

    expect(errors['sender.phone']).toBe('Enter a valid Nigerian phone number');
    // Not an array. Three stacked messages push the next field off screen, and a
    // screen reader reads all three for one mistake.
    expect(Array.isArray(errors['sender.phone'])).toBe(false);
  });

  it('routes a root-level issue to the form banner rather than dropping it', () => {
    // A `refine` on the whole object has an empty path. Losing that message
    // means the form failing with no visible reason at all.
    const errors = fieldErrorsFromIssues([
      { path: [], message: 'Same-day is only offered within one city' },
    ]);
    expect(errors.form).toBe('Same-day is only offered within one city');
  });

  it('keys deeply nested paths to the two levels the form renders', () => {
    const errors = fieldErrorsFromIssues([
      { path: ['parcel', 'weightKg'], message: 'Enter a weight in kilograms' },
    ]);
    // `parcel.weightKg` is the id booking-form.tsx renders; anything deeper
    // cannot be matched to a field on screen.
    expect(Object.keys(errors)).toEqual(['parcel.weightKg']);
  });

  it('returns an empty object when there is nothing wrong', () => {
    expect(fieldErrorsFromIssues([])).toEqual({});
  });
});
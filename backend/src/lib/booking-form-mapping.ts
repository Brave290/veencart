/**
 * Form-to-API mapping for the booking form.
 *
 * WHY THIS IS NOT IN `actions/booking.ts`
 * A `'use server'` module may only export ASYNC functions — Next treats every
 * export as a callable endpoint and the build fails otherwise. That rule is
 * correct: it stops a module quietly exposing a sync helper that looks like an
 * action but is not.
 *
 * But these two functions are deliberately pure and synchronous. They are the
 * most bug-prone code in the booking path — twenty-eight field names held in a
 * different file from the code that reads them — and a server action cannot be
 * unit-tested because it needs `headers()` and `cookies()`. Extracting them here
 * makes them directly testable and keeps the action as a thin shell.
 */

/* ========================================================================== */
/* PURE MAPPINGS — extracted so they can be tested without a request context  */
/* ========================================================================== */

/**
 * FormData -> the shape the schema expects.
 *
 * Everything the form sends is untrusted. Collected by name here so that a
 * missing field arrives as `null` and fails validation with a MESSAGE, rather
 * than `undefined` flowing deep into a query.
 *
 * WHY THIS IS A SEPARATE EXPORTED FUNCTION
 * It is the most bug-prone part of the action and the easiest to get subtly
 * wrong — a mistyped `name` attribute produces a validation error with no field
 * to attach it to, which looks to the customer like the form being broken. A
 * server action cannot be unit-tested (it needs `headers()` and `cookies()`), so
 * the logic lives here where it can be.
 *
 * CHECKBOXES
 * An unchecked box is absent from FormData entirely, so `get()` returns `null`.
 * Comparing to `'on'` is correct for both cases. `formData.get('x') === 'true'`
 * would silently treat every checkbox as unticked, because a browser submits the
 * literal string `'on'`.
 */
export function formDataToBookingInput(formData: FormData) {
  return {
    serviceType: formData.get('serviceType'),
    sender: {
      name: formData.get('senderName'),
      phone: formData.get('senderPhone'),
      email: formData.get('senderEmail'),
      street: formData.get('senderStreet'),
      locality: formData.get('senderLocality'),
      city: formData.get('senderCity'),
      state: formData.get('senderState'),
    },
    recipient: {
      name: formData.get('recipientName'),
      phone: formData.get('recipientPhone'),
      email: formData.get('recipientEmail'),
      street: formData.get('recipientStreet'),
      streetDetail: formData.get('recipientStreetDetail'),
      locality: formData.get('recipientLocality'),
      city: formData.get('recipientCity'),
      state: formData.get('recipientState'),
    },
    parcel: {
      description: formData.get('parcelDescription'),
      quantity: formData.get('parcelQuantity'),
      weightKg: formData.get('parcelWeightKg'),
      lengthCm: formData.get('parcelLengthCm'),
      widthCm: formData.get('parcelWidthCm'),
      heightCm: formData.get('parcelHeightCm'),
      isFragile: formData.get('parcelFragile') === 'on',
    },
    payerRole: formData.get('payerRole'),
    recipientPays: formData.get('recipientPays') === 'on',
    preferredPickupDate: formData.get('preferredPickupDate'),
    notes: formData.get('notes'),
    consentToContact: formData.get('consentToContact') === 'on',
  };
}

/**
 * Zod issues -> one message per field.
 *
 * Collapsed to a single message per field on purpose. A screen-reader user
 * does not need to be told three times that a string is not a string, and
 * stacking three messages under one input pushes the next field off screen.
 *
 * The FIRST issue per field wins rather than the last: with a union or a
 * `superRefine` on top of field rules, the first message is the most specific
 * one — "Choose a state" rather than a generic "Invalid input".
 */
export function fieldErrorsFromIssues(
  issues: readonly { path: PropertyKey[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = topLevelSegment(issue.path.map(String).join('.'));
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/**
 * `a.b.c` -> `a.b`, so a nested error lands on the field the form renders.
 *
 * A root-level Zod issue has an EMPTY path — a `refine` on the whole object, for
 * instance. There is no field to attach that to, so it falls back to `form`,
 * which the banner renders. Silently dropping those issues would mean a booking
 * failing validation with no visible explanation at all.
 */
export function topLevelSegment(path: string): string {
  const [head, second] = path.split('.');
  if (!head) return 'form';
  return second ? `${head}.${second}` : head;
}

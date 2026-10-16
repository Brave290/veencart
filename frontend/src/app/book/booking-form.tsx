'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { PackageCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  NIGERIAN_STATES,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from '@backend/lib/booking-schema';
import { submitBooking, type BookingActionState } from '@backend/actions/booking';

/**
 * Booking form.
 *
 * ONE LONG SCROLLING PAGE, NOT A JAVASCRIPT STEPPER
 * A booking is fourteen fields about two addresses and a parcel. Splitting it
 * across four wizard steps hides most of it behind a Next button, and the
 * customer cannot see what they are agreeing to until the end — which is the
 * wrong moment to discover the pickup address.
 *
 * It is also single-purpose markup that submits without JavaScript: real fields,
 * a real submit, real server-side validation. `useActionState` adds pending and
 * error handling on top; it is an enhancement, not a requirement. A booking form
 * that only works with JS is a booking form that silently drops customers on a
 * slow phone or a flaky network.
 */

const INITIAL: BookingActionState = { status: 'idle' };

const SERVICE_HINTS: Record<ServiceType, string> = {
  same_day: 'Within one city, booked before our same-day cutoff.',
  next_day: 'Collected today or tomorrow, delivered the following day.',
  express: 'The fastest option we run on that route.',
  standard: 'Our default service.',
  economy: 'Slower, for consignments that are not urgent.',
  freight: 'Pallets and bulk consignments. Priced individually.',
};

function SubmitButton() {
  // `useFormStatus` must live in a CHILD of the form. In the same component it
  // reads the parent's status from the previous render and never updates.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
      {pending ? 'Sending your booking…' : 'Request this delivery'}
    </Button>
  );
}

export function BookingForm() {
  const [state, formAction] = useActionState(submitBooking, INITIAL);
  const formId = useId();

  // Errors keyed the same way the action builds them: `sender.phone`,
  // `parcel.weightKg`, `serviceType`.
  const errors = state.fieldErrors ?? {};
  const err = (key: string) => errors[key];

  if (state.status === 'created' && state.bookingReference) {
    return <BookingConfirmation state={state} />;
  }

  const banner =
    state.status === 'error' ||
    state.status === 'rate-limited' ||
    state.status === 'invalid'
      ? state.message
      : null;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-10">
      {banner ? (
        <Alert variant={state.status === 'error' ? 'danger' : 'warning'} id={`${formId}-banner`}>
          {banner}
        </Alert>
      ) : null}

      {/* ── 1. Service ─────────────────────────────────────────────────── */}
      <Fieldset
        step="1"
        title="What kind of delivery?"
        hint="Not sure? Choose standard and we will confirm the options that fit your route."
      >
        <FormField
          id={`${formId}-service`}
          label="Delivery service"
          required
          error={err('serviceType')}
          hint="Coverage and price depend on the route, so this is a starting point rather than a commitment."
        >
          <Select
            id={`${formId}-service`}
            name="serviceType"
            defaultValue="standard"
            required
            invalid={Boolean(err('serviceType'))}
          >
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {SERVICE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </FormField>

        {/*
          Progressive disclosure of the service hint. A static table would be
          six more lines of noise for someone who already knows what they want,
          so the explanation travels with the choice instead.
        */}
        <ServiceHintLegend />
      </Fieldset>

      {/* ── 2. Sender ──────────────────────────────────────────────────── */}
      <Fieldset
        step="2"
        title="Who is sending it?"
        hint="This is the person handing the parcel over to our rider."
      >
        <Grid>
          <FormField
            id={`${formId}-sender-name`}
            label="Full name"
            required
            error={err('sender.name')}
          >
            <Input
              id={`${formId}-sender-name`}
              name="senderName"
              autoComplete="name"
              required
              invalid={Boolean(err('sender.name'))}
            />
          </FormField>

          <FormField
            id={`${formId}-sender-phone`}
            label="Phone number"
            required
            error={err('sender.phone')}
            hint="We call this number to arrange collection."
          >
            <Input
              id={`${formId}-sender-phone`}
              name="senderPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              required
              invalid={Boolean(err('sender.phone'))}
            />
          </FormField>

          <FormField
            id={`${formId}-sender-email`}
            label="Email"
            className="sm:col-span-2"
            optionalText="optional"
            error={err('sender.email')}
            hint="Where we send the booking confirmation."
          >
            <Input
              id={`${formId}-sender-email`}
              name="senderEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              invalid={Boolean(err('sender.email'))}
            />
          </FormField>
        </Grid>

        <AddressFields
          formId={formId}
          who="sender"
          err={err}
        />
      </Fieldset>

      {/* ── 3. Recipient ───────────────────────────────────────────────── */}
      <Fieldset
        step="3"
        title="Who is receiving it?"
        hint="They do not need an account, and they do not need to see anything you have not told us."
      >
        <Grid>
          <FormField
            id={`${formId}-recipient-name`}
            label="Full name"
            required
            error={err('recipient.name')}
          >
            <Input
              id={`${formId}-recipient-name`}
              name="recipientName"
              autoComplete="off"
              required
              invalid={Boolean(err('recipient.name'))}
            />
          </FormField>

          <FormField
            id={`${formId}-recipient-phone`}
            label="Phone number"
            required
            error={err('recipient.phone')}
            hint="Our rider calls this number on arrival."
          >
            <Input
              id={`${formId}-recipient-phone`}
              name="recipientPhone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="0803 123 4567"
              required
              invalid={Boolean(err('recipient.phone'))}
            />
          </FormField>

          <FormField
            id={`${formId}-recipient-email`}
            label="Email"
            className="sm:col-span-2"
            optionalText="optional"
            error={err('recipient.email')}
            hint="Required only if the recipient is paying."
          >
            <Input
              id={`${formId}-recipient-email`}
              name="recipientEmail"
              type="email"
              inputMode="email"
              autoComplete="off"
              invalid={Boolean(err('recipient.email'))}
            />
          </FormField>
        </Grid>

        <AddressFields formId={formId} who="recipient" err={err} />
      </Fieldset>

      {/* ── 4. Parcel ──────────────────────────────────────────────────── */}
      <Fieldset
        step="4"
        title="What are we carrying?"
        hint="An honest description protects you. If a parcel is later found to hold something else, the sender carries the cost and delay."
      >
        <FormField
          id={`${formId}-description`}
          label="Description of contents"
          required
          error={err('parcel.description')}
          hint="What it is, not what it is worth."
        >
          <Textarea
            id={`${formId}-description`}
            name="parcelDescription"
            placeholder="Two boxes of books and stationery"
            required
            invalid={Boolean(err('parcel.description'))}
          />
        </FormField>

        <Grid>
          <FormField
            id={`${formId}-quantity`}
            label="How many items?"
            required
            error={err('parcel.quantity')}
          >
            <Input
              id={`${formId}-quantity`}
              name="parcelQuantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              defaultValue={1}
              required
              invalid={Boolean(err('parcel.quantity'))}
            />
          </FormField>

          <FormField
            id={`${formId}-weight`}
            label="Total weight (kg)"
            required
            error={err('parcel.weightKg')}
            hint="Weigh the packed parcel, not the contents."
          >
            <Input
              id={`${formId}-weight`}
              name="parcelWeightKg"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.001"
              max={1000}
              placeholder="2.5"
              required
              invalid={Boolean(err('parcel.weightKg'))}
            />
          </FormField>
        </Grid>

        <details className="rounded-md border border-line bg-surface-muted/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-content">
            Add dimensions (helps us plan the load)
          </summary>
          <Grid className="mt-4">
            {(
              [
                ['lengthCm', 'Length (cm)'],
                ['widthCm', 'Width (cm)'],
                ['heightCm', 'Height (cm)'],
              ] as const
            ).map(([name, label]) => (
              <FormField key={name} id={`${formId}-${name}`} label={label} optionalText="optional">
                <Input
                  id={`${formId}-${name}`}
                  name={name}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0.1"
                  max={500}
                />
              </FormField>
            ))}
          </Grid>
        </details>

        <CheckField
          id={`${formId}-fragile`}
          name="parcelFragile"
          label="Handle with care"
          hint="Fragile parcels are flagged to the rider. It does not guarantee careful handling, so do not send anything you cannot afford to replace."
        />
      </Fieldset>

      {/* ── 5. Timing and payment ──────────────────────────────────────── */}
      <Fieldset
        step="5"
        title="When, and who is paying?"
        hint="We confirm collection with you by phone before any rider is dispatched."
      >
        <Grid>
          <FormField
            id={`${formId}-pickup-date`}
            label="Preferred pickup date"
            required
            error={err('preferredPickupDate')}
            hint="Within the next 90 days."
          >
            <Input
              id={`${formId}-pickup-date`}
              name="preferredPickupDate"
              type="date"
              required
              invalid={Boolean(err('preferredPickupDate'))}
            />
          </FormField>

          <FormField
            id={`${formId}-payer`}
            label="Who is paying?"
            required
            error={err('payerRole')}
          >
            <Select
              id={`${formId}-payer`}
              name="payerRole"
              defaultValue="sender"
              required
              invalid={Boolean(err('payerRole'))}
            >
              <option value="sender">The sender — me</option>
              <option value="recipient">The recipient</option>
            </Select>
          </FormField>
        </Grid>

        <CheckField
          id={`${formId}-recipient-pays`}
          name="recipientPays"
          label="Send the payment request to the recipient instead"
          hint="We will send them a secure payment link. Their email address is then required."
          error={err('recipientPays')}
        />

        <FormField
          id={`${formId}-notes`}
          label="Anything else we should know?"
          optionalText="optional"
          error={err('notes')}
          hint="Gate colour, landmark, delivery window — anything that saves the rider a phone call."
        >
          <Textarea
            id={`${formId}-notes`}
            name="notes"
            placeholder="Blue gate, second building on the left"
          />
        </FormField>
      </Fieldset>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-t border-line pt-8">
        <CheckField
          id={`${formId}-consent`}
          name="consentToContact"
          label="You may contact me and the recipient about this delivery"
          required
          error={err('consentToContact')}
          hint="Not optional, and not pre-ticked. Without it we cannot arrange the delivery."
        />

        <p className="text-sm text-content-muted">
          Requesting a booking does not charge you. We confirm the price with you
          first, and nothing is collected until you agree to it.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton />
          <Link
            href="/services"
            className="text-sm text-content-muted underline-offset-4 hover:underline"
          >
            Compare services first
          </Link>
        </div>
      </div>
    </form>
  );
}

/* ========================================================================== */
/* PARTS                                                                     */
/* ========================================================================== */

function Fieldset({
  step,
  title,
  hint,
  children,
}: {
  step: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-content-subtle">
          Step {step}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-content">{title}</h2>
        {hint ? <p className="mt-1.5 text-sm text-content-muted">{hint}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

function Grid({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // `sm:grid-cols-2` not `grid-cols-2`. Two address fields side by side at 320px
  // is the single most common cause of horizontal overflow on Nigerian phones.
  return <div className={`grid gap-5 sm:grid-cols-2 ${className}`}>{children}</div>;
}

function AddressFields({
  formId,
  who,
  err,
}: {
  formId: string;
  who: 'sender' | 'recipient';
  err: (key: string) => string | undefined;
}) {
  const isRecipient = who === 'recipient';

  return (
    <div className="flex flex-col gap-5">
      <FormField
        id={`${formId}-${who}-street`}
        label="Street address"
        required
        error={err(`${who}.street`)}
      >
        <Input
          id={`${formId}-${who}-street`}
          name={`${who}Street`}
          autoComplete={isRecipient ? 'off' : 'street-address'}
          placeholder="12 Allen Avenue"
          required
          invalid={Boolean(err(`${who}.street`))}
        />
      </FormField>

      {isRecipient ? (
        <FormField
          id={`${formId}-recipient-detail`}
          label="Landmark or building detail"
          optionalText="optional"
          error={err('recipient.streetDetail')}
          hint="The single most useful thing for a rider who has never been to the address."
        >
          <Input
            id={`${formId}-recipient-detail`}
            name="recipientStreetDetail"
            autoComplete="off"
            placeholder="Blue gate, opposite the filling station"
          />
        </FormField>
      ) : null}

      <Grid>
        <FormField
          id={`${formId}-${who}-locality`}
          label="Area or locality"
          required
          error={err(`${who}.locality`)}
        >
          <Input
            id={`${formId}-${who}-locality`}
            name={`${who}Locality`}
            autoComplete={isRecipient ? 'off' : 'address-level2'}
            placeholder="Ikeja"
            required
            invalid={Boolean(err(`${who}.locality`))}
          />
        </FormField>

        <FormField
          id={`${formId}-${who}-city`}
          label="City"
          required
          error={err(`${who}.city`)}
        >
          <Input
            id={`${formId}-${who}-city`}
            name={`${who}City`}
            autoComplete={isRecipient ? 'off' : 'address-level1'}
            placeholder="Lagos"
            required
            invalid={Boolean(err(`${who}.city`))}
          />
        </FormField>

        <FormField
          id={`${formId}-${who}-state`}
          label="State"
          required
          error={err(`${who}.state`)}
          className="sm:col-span-2"
        >
          {/*
            A closed list, not free text. "Lagos", "lagos state", "LA" and
            "Lagos State" are four different strings to a database, and a coverage
            check that cannot match them cannot answer "do you deliver there?".
          */}
          <Select
            id={`${formId}-${who}-state`}
            name={`${who}State`}
            defaultValue=""
            required
            invalid={Boolean(err(`${who}.state`))}
          >
            <option value="" disabled>
              Choose a state
            </option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </FormField>
      </Grid>
    </div>
  );
}

function CheckField({
  id,
  name,
  label,
  hint,
  error,
  required = false,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        {/*
          Native checkbox, not a styled div. It is keyboard-operable, announces
          its own checked state and works without JavaScript — all of which a
          custom control has to reimplement and usually gets wrong.
        */}
        <input
          id={id}
          name={name}
          type="checkbox"
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 size-5 shrink-0 rounded-sm border-line-strong accent-primary"
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-content">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 font-semibold text-danger-text">
              *
            </span>
          ) : null}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="pl-8 text-xs leading-relaxed text-content-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="pl-8 text-xs font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Explains the chosen service without a second round trip.
 *
 * Rendered from the same `SERVICE_HINTS` map the server uses for nothing —
 * deliberately. The text is descriptive copy, not coverage or pricing data, so
 * hardcoding it here cannot go stale the way a fetched price would.
 */
function ServiceHintLegend() {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-content-muted">
      {SERVICE_TYPES.map((type) => (
        <li key={type} className="flex flex-col sm:flex-row sm:gap-2">
          <span className="font-medium text-content sm:w-44 sm:shrink-0">
            {SERVICE_TYPE_LABELS[type]}
          </span>
          <span>{SERVICE_HINTS[type]}</span>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* CONFIRMATION                                                              */
/* ========================================================================== */

function BookingConfirmation({ state }: { state: BookingActionState }) {
  const needsQuote = state.outcome === 'quote_requested';

  return (
    <section aria-labelledby="booking-done" className="flex flex-col gap-6">
      <Alert variant={needsQuote ? 'info' : 'success'}>
        <p className="font-semibold">
          {needsQuote ? 'Booking received — a person will price it' : 'Booking received'}
        </p>
        <p className="mt-1">{state.message}</p>
      </Alert>

      <div className="rounded-lg border border-line bg-surface p-5">
        <p className="text-sm text-content-muted">Your booking reference</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-content">
          {state.bookingReference}
        </p>
        <p className="mt-3 text-sm text-content-muted">
          Write this down now. It is how you follow this delivery, and you will
          need it if you contact us. We also keep a copy in this browser.
        </p>
      </div>

      {/*
        No price is shown here, deliberately. An unpriced route is quoted by a
        person; a covered one is priced by the engine after the booking exists.
        Showing "from ₦X" here would be inventing a rate card that the client
        has not published yet.
      */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/track?ref=${encodeURIComponent(state.bookingReference ?? '')}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          <PackageCheck aria-hidden="true" className="size-4" />
          Track this delivery
        </Link>
        <Button
          variant="outline"
          size="lg"
          onClick={() => window.location.reload()}
          className="sm:w-auto"
        >
          Book another
        </Button>
      </div>

      <p className="text-sm text-content-muted">
        Questions?{' '}
        <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
          Contact us
        </Link>{' '}
        and quote{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
          {state.bookingReference}
        </code>
        .
      </p>
    </section>
  );
}
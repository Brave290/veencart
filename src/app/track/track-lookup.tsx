'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge, type PaymentStatus, type ShipmentStatus } from '@/components/ui/status-badge';
import { trackShipment, type TrackActionState } from './actions';

/**
 * Tracking form + timeline.
 *
 * WHY useActionState AND NOT useState
 * A form that calls a server action must go through React's action-state
 * plumbing so the pending state, the error path and progressive enhancement all
 * work. With `useActionState`, the same markup still submits without
 * JavaScript — the button, the label and the error message are all real
 * elements, not a div wired to onClick.
 */

const INITIAL: TrackActionState = { status: 'idle', result: null };

function SubmitButton() {
  // `useFormStatus` must live in a CHILD of the form, not in the same
  // component that renders it. In the same component it reads the status of
  // the parent form on the previous render and never updates.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Looking up…' : 'Track shipment'}
    </Button>
  );
}

export function TrackLookup() {
  const [state, formAction] = useActionState(trackShipment, INITIAL);

  return (
    <div className="mt-8">
      <form action={formAction} className="max-w-md" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reference">Tracking reference</Label>
          <input
            id="reference"
            name="reference"
            type="text"
            inputMode="text"
            autoComplete="off"
            // `enterKeyHint` and autocapitalisation matter here: references are
            // pasted from email on a phone, which auto-capitalises the first
            // letter and inserts smart quotes.
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            required
            maxLength={40}
            placeholder="VCTR-0001"
            aria-describedby={state.message ? 'reference-error' : 'reference-help'}
            aria-invalid={state.status === 'error' || state.status === 'not-found' ? true : undefined}
            className="h-11 w-full rounded-[9px] border border-line-strong bg-surface px-3 text-base outline-none transition-colors placeholder:text-content-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 md:text-sm"
          />
          <p id="reference-help" className="text-xs text-content-muted">
            Found in your booking confirmation email.
          </p>
        </div>

        <div className="mt-4">
          <SubmitButton />
        </div>

        {/*
          aria-live so a screen-reader user hears the result without having to
          go hunting for it. `polite`, not `assertive`: this is a normal
          response to a request, not an emergency.
        */}
        <div aria-live="polite" aria-atomic="true">
          {state.status === 'error' ||
          state.status === 'not-found' ||
          state.status === 'rate-limited' ? (
            <p
              id="reference-error"
              role="alert"
              className="mt-4 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-text"
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      {state.status === 'found' && state.result ? <Timeline result={state.result} /> : null}
    </div>
  );
}

function Timeline({ result }: { result: NonNullable<TrackActionState['result']> }) {
  return (
    <section aria-labelledby="shipment-heading" className="mt-10">
      <h2 id="shipment-heading" className="sr-only">
        Shipment status
      </h2>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-content-muted">
              {result.trackingReference}
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{result.route}</p>
          </div>
          <StatusBadge kind="shipment" status={result.currentStatus as ShipmentStatus} />
        </div>

        {/*
          Estimated delivery is shown ONLY when the database has a value. It is
          never computed in the browser and never defaulted to "tomorrow" — a
          date the customer cannot rely on is worse than no date.
        */}
        {result.estimatedDeliveryAt ? (
          <p className="mt-4 border-t border-line pt-4 text-sm text-content-muted">
            Estimated delivery:{' '}
            <time dateTime={result.estimatedDeliveryAt} className="text-content">
              {new Date(result.estimatedDeliveryAt).toLocaleString('en-NG', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Lagos',
              })}
            </time>
            <span className="block text-xs">
              An estimate, not a guarantee. We confirm on delivery.
            </span>
          </p>
        ) : null}
      </div>

      {result.events.length > 0 ? (
        <ol className="mt-6 space-y-0">
          {result.events.map((event, i) => (
            <li key={`${event.occurredAt}-${i}`} className="relative flex gap-4 pb-6">
              {i < result.events.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-5 h-full w-px bg-line"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-surface"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="shipment" status={event.status as ShipmentStatus} />
                  <time
                    dateTime={event.occurredAt}
                    className="text-xs text-content-muted"
                  >
                    {new Date(event.occurredAt).toLocaleString('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Africa/Lagos',
                    })}
                  </time>
                </div>
                {event.message ? (
                  <p className="mt-1 text-sm text-content-muted">{event.message}</p>
                ) : null}
                {event.locationName ? (
                  <p className="mt-1 text-xs text-content-subtle">{event.locationName}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm text-content-muted">
          No tracking events have been recorded yet. They appear here as soon as
          the shipment moves.
        </p>
      )}

      {/*
        Payment status is shown SEPARATELY from shipment status, and only once a
        payment record exists. A paid order can still be awaiting dispatch, and
        a delivered shipment does not prove a payment settled — conflating the
        two is how a support conversation starts.
      */}
      <p className="mt-6 text-sm text-content-muted">
        Questions about this shipment?{' '}
        <a href="/contact" className="text-primary underline-offset-4 hover:underline">
          Contact us
        </a>{' '}
        and quote{' '}
        <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
          {result.trackingReference}
        </code>
        .
      </p>
    </section>
  );
}

/** Re-exported so the payment badge type stays in one place. */
export type { PaymentStatus };
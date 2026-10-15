# Operations runbook

Day-to-day procedures for the things that actually go wrong: a booking nobody
can move, a payment that does not line up, an email that never arrived, an
uploaded photo nobody referenced, a parcel that could not be delivered.

Every query below is written against the schema in `backend/supabase/migrations/` and has
been checked against the column names, enum values and constraints in those
files. Column names are exact.

---

## Before anything else: how to query

All of this runs against production Postgres. Use a **read-only session by
default** — most of these procedures start with reading, and an accidental
`DELETE` in an operations session is not recoverable from a backup in the time
you have.

```bash
# Read-only session. Every query after this is a no-op if it tries to write.
psql "$SUPABASE_DB_URL" -c "set default_transaction_read_only = on;" -c "select 1;"
```

Or, for a whole session, export the connection with the flag on the URL:

```bash
export PGURL='postgresql://<user>:<password>@<host>:5432/postgres?options=-c%20default_transaction_read_only%3Don'
psql "$PGURL"
```

> **These sessions bypass RLS.** Connecting as the database owner or via the
> service role means every policy in `0007_rls.sql` is switched off. That is
> deliberate and necessary here — support needs to read what a customer cannot.
> It is also why the read-only flag is worth the effort: support queries see
> payment references, names, phone numbers and addresses.
>
> Never paste these results into a public-facing channel. Never put `otp_code`
> from `delivery_proofs` into a ticket.

When you do need to write, run the write **alone**, in its own transaction, and
read the row count before committing.

### Timezone

All timestamps are `timestamptz` in UTC, and the schema mandates it. Nigeria is
WAT (UTC+1). For a Lagos business date:

```sql
select (now() at time zone 'Africa/Lagos')::date as lagos_today;
```

---

## 1. A booking is stuck

"Stuck" means it is not moving and nobody knows why. Work the pipeline in order —
booking → payment → shipment → events — and stop at the first stage that is
wrong.

### 1a. See it

```sql
select id, booking_reference, status, service_type, item_count,
       total_weight_kg, created_at, updated_at,
       sender_name, sender_city, recipient_name, recipient_city, recipient_phone
from public.bookings
where booking_reference = '<booking-reference>';
```

`booking_reference` is what the customer reads out to support. If you only have
a phone number:

```sql
select id, booking_reference, status, created_at,
       sender_phone, sender_email, recipient_phone
from public.bookings
where sender_phone like '%<last-4-digits>'
   or recipient_phone like '%<last-4-digits>'
order by created_at desc
limit 20;
```

### 1b. The whole picture in one row

```sql
select
  b.booking_reference,
  b.status                   as booking_status,
  b.created_at               as booked_at,
  b.updated_at               as booking_last_touched,
  b.service_type,
  s.shipment_reference,
  s.tracking_reference,
  s.status                   as shipment_status,
  s.delivery_scheduled_at,
  s.estimated_delivery_at,
  p.reference                as payment_reference,
  p.status                   as payment_status,
  p.amount_minor,
  p.currency
from public.bookings b
left join public.shipments s on s.booking_id = b.id
left join public.payments  p on p.booking_id  = b.id
where b.booking_reference = '<booking-reference>';
```

Read the three statuses in order:

| `booking_status` | `payment_status` | `shipment_status` | Meaning |
| --- | --- | --- | --- |
| `awaiting_payment` | `pending`, null | null | Customer has not paid. Nothing is wrong. |
| `confirmed` | `succeeded` | `confirmed` | Paid and waiting for a driver. → [1d](#1d-nobody-has-been-assigned) |
| `confirmed` | `succeeded` | `requested` | Paid, no shipment raised yet. **Escalate — this is a real gap.** |
| `quoted` | `pending` | null | Quote sent, payment not started. Chase the customer. |
| `quote_requested` | null | null | Sitting in the dispatcher queue. → [1c](#1c-the-dispatch-queue-is-not-moving) |
| `draft` | null | null | Abandoned before submission. |
| anything, but `updated_at` is old | | | → [1b](#1b-the-whole-picture-in-one-row), then the timeline. |

### 1c. The dispatch queue is not moving

The queue view — matches `bookings_queue_idx`:

```sql
select booking_reference, status, service_type,
       sender_name, sender_city, recipient_name, recipient_city,
       created_at, now() - created_at as waiting_for
from public.bookings
where deleted_at is null
  and status in ('quote_requested', 'quoted', 'awaiting_payment', 'confirmed')
order by created_at
limit 50;
```

How long bookings sit in each stage, which is the number to alert on:

```sql
select status, count(*) as n,
       min(created_at) as oldest,
       max(created_at) as newest,
       (select count(*) from public.bookings b2
         where b2.deleted_at is null and b2.status = b.status
           and b2.created_at < now() - interval '24 hours') as over_24h
from public.bookings b
where deleted_at is null
group by status
order by oldest;
```

### 1d. Nobody has been assigned

Paid and confirmed, but no driver. Check the dispatch board, then the driver:

```sql
select s.shipment_reference, s.status, s.service_type,
       s.delivery_scheduled_at, s.origin_area_id, s.destination_area_id,
       s.is_urgent, s.amount_charged_minor
from public.shipments s
where s.status in ('confirmed', 'pickup_scheduled')
  and s.delivery_scheduled_at < now() + interval '4 hours'
order by s.is_urgent desc, s.delivery_scheduled_at;
```

Assigned but not started:

```sql
select sa.shipment_id, sa.driver_user_id, sa.scheduled_start, sa.scheduled_end,
       sa.actual_start, sa.released_at, sa.released_reason
from public.shipment_assignments sa
where sa.released_at is null
  and sa.scheduled_end < now()
order by sa.scheduled_start;
```

> Driver double-booking is prevented in the service layer with an advisory lock
> plus an overlap check, **not** by a database exclusion constraint — `EXCLUDE …
> WHERE` is not valid PostgreSQL. That logic does not exist yet; see the
> constraint comment in `0004_logistics.sql`. Until it does, two dispatchers can
> assign the same driver to overlapping windows. Check before assigning.

### 1e. The timeline

The full history of a shipment, in order. `shipment_events` is append-only:
corrections are **new rows**, never updates.

```sql
select sequence_no, event_type, previous_status, new_status,
       actor_role, actor_label, public_message, occurred_at
from public.shipment_events
where shipment_id = '<shipment-uuid>'
order by sequence_no;
```

What a driver is allowed to write is enforced by `public.is_driver_event_type()`.
If a price or payment event appears from a driver, that is a policy breach —
check the policy, not the driver.

```sql
select actor_role, event_type, count(*)
from public.shipment_events
where shipment_id = '<shipment-uuid>'
group by 1, 2 order by 1, 3 desc;
```

**Shipments that have gone silent** — active, but no event for hours:

```sql
select s.shipment_reference, s.status, s.delivery_scheduled_at,
       coalesce(max(e.occurred_at), s.created_at) as last_event_at,
       now() - coalesce(max(e.occurred_at), s.created_at) as silent_for
from public.shipments s
left join public.shipment_events e on e.shipment_id = s.id
where s.status in ('confirmed','pickup_scheduled','picked_up','in_transit','out_for_delivery')
group by s.id
having now() - coalesce(max(e.occurred_at), s.created_at) > interval '6 hours'
order by silent_for desc;
```

`coalesce` matters: without it a shipment that has **no events at all** yields
`NULL`, the comparison is `NULL`, and the row silently disappears from the
result. The worst-looking shipments would be the ones that vanish.

### 1f. Record what you did

`audit_logs` is append-only and is retained. Every privileged correction
belongs here.

```sql
insert into public.audit_logs
  (actor_user_id, actor_role, actor_label, action, entity_type, entity_id, metadata)
values
  ('<admin-uuid>', 'admin', '<your-name> via support', 'admin_action',
   'booking', '<booking-uuid>',
   '{"reason":"<what you did and why>","ticket":"<ticket-ref>"}'::jsonb);
```

Never store tokens, secrets, full request bodies, or personal data in
`metadata`. It is read by staff and kept for years.

---

## 2. A payment does not match

"Payment did not match" is four different faults with four different fixes.
Identify which one before touching anything.

| Symptom | Section |
| --- | --- |
| Payment stuck `pending`, customer says they paid | [2a](#2a-payment-stuck-in-pending) |
| Customer was charged, order is not confirmed | [2b](#2b-charged-but-the-booking-did-not-advance) |
| Webhook failed or never arrived | [2c](#2c-webhook-events-that-failed) |
| Amount differs from what Paystack recorded | [2d](#2d-the-amount-does-not-match) |
| Wrong refund, or a refund was issued by mistake | [2e](#2e-refunds) |

### The safety property

`payments` has **exactly one** payable target, enforced by
`payments_single_payable_check`. There is no matching-by-amount anywhere: two
customers each paying ₦5,000 cannot credit each other's order. **Never
"fix" a mismatch by matching rows on amount.** Find the `reference`.

`payment_events.provider_event_id` is `UNIQUE`, which is what makes webhook
replay safe. Paystack retries; a duplicate event collides on insert rather than
crediting twice.

### 2a. Payment stuck in `pending`

```sql
select p.id, p.reference, p.payable_kind, p.booking_id, p.product_order_id,
       p.amount_minor, p.currency, p.status, p.created_at,
       now() - p.created_at as age, p.provider_reference
from public.payments p
where p.status in ('pending', 'processing')
  and p.created_at < now() - interval '1 hour'
order by p.created_at;
```

This is the reconciliation sweeper's query and matches
`payments_status_created_idx`.

Before concluding anything, **verify with Paystack** using the `reference` — the
dashboard or the verify API. Do not assume a stale `pending` means the customer
did not pay; it usually means the webhook did not arrive.

- Paystack shows a successful charge → the webhook failed. Go to [2c](#2c-webhook-events-that-failed).
- Paystack shows no charge → the customer did not complete checkout. The
  payment row is an abandoned attempt. The partial unique index
  `payments_one_open_per_booking_idx` means a *new* attempt cannot be created
  while this one sits open. Resolve it before the customer retries, or the
  retry will fail at the database.

> Do not delete or edit the `pending` row to unblock a retry. Resolve it
> explicitly (webhook replay, or a documented decision to close it), or you lose
> the only record that the attempt happened.

### 2b. Charged, but the booking did not advance

```sql
select p.reference, p.amount_minor, p.currency, p.paid_at,
       b.id as booking_id, b.booking_reference, b.status as booking_status,
       b.updated_at as booking_last_touched
from public.payments p
join public.bookings b on b.id = p.booking_id
where p.status = 'succeeded'
  and b.status in ('draft', 'quote_requested', 'quoted', 'awaiting_payment')
order by p.paid_at;
```

Paid, but no shipment was ever created:

```sql
select p.reference, p.booking_id, p.amount_minor, p.paid_at
from public.payments p
where p.status = 'succeeded'
  and p.payable_kind = 'booking'
  and not exists (
    select 1 from public.shipments s where s.booking_id = p.booking_id
  )
order by p.paid_at desc;
```

Both of these are **application bugs, not data-entry problems.** The money is
real and the fulfilment state is wrong. Escalate to the application owner with
the `reference`; do not hand-edit the status to "fix" it — the fix belongs in
the code path that failed, or it will happen again on the next customer.

### 2c. Webhook events that failed

```sql
select provider_event_id, event_type, provider_reference,
       processing_status, signature_valid, attempts,
       processing_error, received_at, processed_at
from public.payment_events
where processing_status in ('failed', 'received')
order by received_at desc
limit 100;
```

`received` means received and not yet processed — either the worker is down or it
has not reached this row. `failed` means it tried and gave up.

**Signature failures — the alarm query:**

```sql
select count(*) as invalid_signature_events,
       min(received_at) as first_seen, max(received_at) as last_seen
from public.payment_events
where signature_valid is false;
```

A non-zero count means something is posting to `/api/webhooks/paystack` without
a valid HMAC signature. That is either a misconfiguration or someone probing the
endpoint. If the handler rejects unverified requests, the count is noise from
scanners and is **good news** — it proves the endpoint is not open.

Duplicate deliveries, which the `UNIQUE` constraint should make impossible:

```sql
select provider_event_id, count(*)
from public.payment_events
group by provider_event_id
having count(*) > 1;
```

**This must return zero rows.** Anything returned means the constraint is not
present in production, and every webhook is double-applying.

To inspect one event's full payload (retained for disputes; never contains card
data — the provider does not send it):

```sql
select jsonb_pretty(payload)
from public.payment_events
where provider_event_id = '<provider-event-id>';
```

### 2d. The amount does not match

Within a single row this is impossible: `payments_amount_matches_expected_check`
enforces `amount_minor = expected_amount_minor`, and
`payments_currency_matches_expected_check` enforces the currency. If a row has a
mismatch, the constraint is missing from production.

The real mismatch is between **our** record and **Paystack's**:

```sql
select p.reference, p.amount_minor as ours_kobo, p.currency,
       e.payload->>'amount' as paystack_kobo, e.received_at
from public.payments p
join public.payment_events e on e.payment_id = p.id
where e.payload ? 'amount'
  and (e.payload->>'amount') ~ '^[0-9]+$'
  and (e.payload->>'amount')::bigint <> p.amount_minor
order by e.received_at desc;
```

The `~ '^[0-9]+$'` guard is deliberate: casting a non-numeric payload field to
`bigint` raises an error and aborts the whole query, so a single odd webhook
event would make reconciliation permanently unavailable.

> `expected_amount_minor` is frozen before checkout starts, precisely so a
> provider-reported difference surfaces here instead of being quietly absorbed.
> **Do not "correct" a discrepancy by editing the amount.** Difference is
> investigated, and the difference between what was charged and what was owed is
> the customer's money. Any correction is a refund, recorded as a refund.

Daily money movement, to reconcile against the Paystack dashboard:

```sql
select (paid_at at time zone 'Africa/Lagos')::date as lagos_day,
       currency,
       count(*) as payments,
       sum(amount_minor) as total_minor,
       round(sum(amount_minor) / 100.0, 2) as total_naira
from public.payments
where status = 'succeeded' and paid_at is not null
group by 1, 2
order by 1 desc
limit 30;
```

### 2e. Refunds

```sql
select r.id, r.reference, r.status, r.amount_minor, r.currency,
       r.reason, r.reason_detail,
       p.reference as payment_reference, p.status as payment_status,
       p.refundable_amount_minor,
       r.requested_at, r.authorised_at, r.completed_at
from public.refunds r
join public.payments p on p.id = r.payment_id
where r.status in ('requested', 'processing')
order by r.requested_at;
```

Refunds awaiting a second signature — `requested_by` and `authorised_by` are
separate columns and a refund needs both:

```sql
select reference, amount_minor, reason, requested_at, authorised_at
from public.refunds
where status = 'requested' and authorised_by is null
order by requested_at;
```

Over-refunds. The trigger `enforce_refund_within_refundable()` should make this
impossible:

```sql
select r.reference, r.amount_minor, p.refundable_amount_minor
from public.refunds r
join public.payments p on p.id = r.payment_id
where r.status <> 'cancelled'
  and p.refundable_amount_minor is not null
  and r.amount_minor > p.refundable_amount_minor;
```

> Never issue a refund by deleting or downgrading a `payments` row. It is the
> financial record. A refund is a row in `refunds`, moving `payments.status` to
> `partially_refunded` or `refunded` and `refundable_amount_minor` down by the
> amount. The `payments_success_requires_reference_check` constraint also means a
> `succeeded` payment must retain its `provider_reference` and `paid_at`.

---

## 3. Failed notification sends

`notification_outbox` is a transactional queue: a row is written in the **same
transaction** as the business event, and a separate worker sends it. That
ordering is why "booking confirmed" emails do not go out for bookings that were
rolled back.

Default retry budget is `max_attempts = 5`, with `next_attempt_at` backing off
between tries. A row only reaches `failed` once it exhausts that budget.

### What is stuck

```sql
select status, channel, count(*) as n,
       min(created_at) as oldest, max(created_at) as newest
from public.notification_outbox
group by status, channel
order by oldest;
```

### What is due right now (worker backlog)

```sql
select count(*) as due_now,
       min(next_attempt_at) as oldest_due
from public.notification_outbox
where status = 'pending'
  and next_attempt_at <= now();
```

A growing `due_now` means **the worker is not running** — not that email is
broken. That distinction matters: the outbox is doing its job by holding work
until it can be done.

### What actually failed

```sql
select id, channel, template, recipient_email, status,
       attempts, max_attempts, last_error,
       created_at, next_attempt_at, sent_at
from public.notification_outbox
where status = 'failed'
order by created_at desc
limit 100;
```

Group by cause — this tells you whether it is one bad thing or everything:

```sql
select channel, template, split_part(coalesce(last_error, 'none'), ':', 1) as error_kind,
       count(*), max(created_at) as last_seen
from public.notification_outbox
where status = 'failed'
group by 1, 2, 3
order by count(*) desc;
```

Common causes:

| `last_error` contains | Cause |
| --- | --- |
| `401`, `unauthorized`, `invalid api key` | `RESEND_API_KEY` wrong, revoked, or from a different account |
| `domain not verified` | SPF/DKIM not published — see [DEPLOYMENT.md](./DEPLOYMENT.md#5-email-domain-spf-dkim-dmarc) |
| `rate limit`, `429` | Too many sends. Reduce volume or raise the Resend limit |
| `smtp`, `connection`, `timeout` | Transient network — retry is usually the fix |
| `550`, `does not exist` | Bad recipient address; retrying will never succeed |

### Retry

**Check first that it was never sent.** `dedupe_key` is `UNIQUE` per
template+recipient precisely so a retry cannot double-send, but you still do not
want to email a customer twice about the same event:

```sql
select id, template, recipient_email, status, attempts, max_attempts,
       sent_at, last_error
from public.notification_outbox
where id = '<outbox-uuid>';
```

Confirm `status <> 'sent'` and `sent_at is null`, then:

```sql
update public.notification_outbox
set status = 'pending',
    attempts = 0,
    next_attempt_at = now(),
    last_error = null
where id = '<outbox-uuid>'
  and status = 'failed'
returning id, template, recipient_email;
```

`returning` matters: it proves **one** row changed. A `RETURNING` with zero rows
means your filter did not match what you thought.

Bulk retry, once the underlying cause is fixed — retrying before that just burns
another five attempts:

```sql
update public.notification_outbox
set status = 'pending', attempts = 0, next_attempt_at = now()
where status = 'failed'
  and template = '<template-name>'
  and last_error like '%<error substring>%'
returning id, template, recipient_email;
```

> Set `status = 'pending'` and `attempts = 0` **in the same statement**. The
> `notification_outbox_exhausted_check` constraint enforces
> `status <> 'failed' or attempts >= max_attempts`, so flipping the status back
> to `failed` afterwards would be rejected.

### Send a customer one manually

Send it by hand from a verified account. Do not hand-edit the outbox row to
`sent` — that forges a record of a send that the system did not perform.

---

## 4. Cleaning up abandoned R2 uploads

Uploads are presigned `PUT` URLs. **The object appears in the bucket before
anything references it in the database** — a customer who abandons a half-finished
upload leaves an object that no row will ever point to. These accumulate silently
and cost money.

### Find objects nobody references

The private bucket first (proof-of-delivery photos and customer documents):

```bash
# Uses @aws-sdk/client-s3, already a dependency of this project.
# Requires R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_S3_ENDPOINT in the
# environment, and a token with Object Read on the bucket.
node --input-type=module -e '
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const bucket = process.env.R2_BUCKET_PRIVATE_FILES;
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
let token;
do {
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
  );
  for (const o of res.Contents ?? []) {
    if (o.LastModified.getTime() < cutoff) {
      console.log(o.LastModified.toISOString(), o.Size, o.Key);
    }
  }
  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);
'
```

The Cloudflare dashboard (R2 → bucket → **Objects**) shows the same listing and
is the safer choice for a first look — it is read-only by default.

### Before deleting anything, prove it is unreferenced

**A proof-of-delivery photo is the evidence that settles "did you actually
deliver my parcel?".** Deleting one is destroying a record, not clearing a cache.

Get every referenced key:

```sql
-- Proof-of-delivery photos and customer documents.
select image_url, shipment_id, captured_at
from public.delivery_proofs
where image_url is not null;

-- Marketplace images.
select object_key, product_id, is_primary
from public.product_images;
```

Compare that list against the bucket listing. Anything in the bucket and not in
the database is a candidate — **and a candidate only**. Keys are also written by
in-flight uploads that have not yet committed a row, so allow a generous margin
(24 hours above) before treating anything as abandoned.

### Delete

Only after the comparison, only for objects confirmed unreferenced, and never in
bulk on a first pass. `rclone` is available on this machine if an R2 remote has
been configured; otherwise the Cloudflare dashboard delete button works and is
reversible only for the first few minutes.

Before deleting anything from `veecart-private-files`, re-run:

```sql
select count(*) from public.delivery_proofs
where image_url like '%<the-object-key>%';
```

Zero rows, confirmed twice, by two people, for production data.

> There is no "orphaned upload" lifecycle rule in the application yet. Until one
> exists, this cleanup is a **manual** operational task with no owner. Treat it
> as a standing monthly task and log what you delete — otherwise "cleanup" means
> "delete, and nobody can prove what".

---

## 5. A delivery failed

### 5a. Everything that failed, right now

```sql
select s.shipment_reference, s.status, s.service_type,
       s.recipient_name, s.recipient_phone,
       s.recipient_street, s.recipient_locality, s.recipient_city, s.recipient_state,
       s.delivery_scheduled_at, s.delivery_attempts_count,
       s.last_location_note, s.last_location_at,
       s.amount_charged_minor, s.currency, s.is_urgent
from public.shipments s
where s.status in ('delivery_failed', 'exception', 'on_hold', 'returned_to_sender')
order by s.is_urgent desc, s.delivery_scheduled_at;
```

### 5b. Why it failed

```sql
select attempt_number, attempted_at, outcome, failure_reason,
       recipient_name_given, contact_phone_used,
       latitude, longitude, notes
from public.delivery_attempts
where shipment_id = '<shipment-uuid>'
order by attempt_number;
```

Outcomes are a fixed vocabulary — `delivered`, `recipient_absent`, `refused`,
`address_unknown`, `phone_unreachable`, `premises_closed`, `rescheduled`,
`damaged`, `other`. The database rejects anything else, so a value here is
genuinely driver-reported rather than free text.

Which reasons dominate tells you whether this is a driver problem, an address
problem, or a customer problem:

```sql
select outcome, failure_reason, count(*), max(attempted_at) as last_seen
from public.delivery_attempts
where outcome <> 'delivered'
  and attempted_at > now() - interval '30 days'
group by 1, 2 order by count(*) desc;
```

### 5c. The proof, if any was captured

```sql
select proof_type, image_url, signer_name,
       geo_latitude, geo_longitude, recipient_note, captured_at
from public.delivery_proofs
where shipment_id = '<shipment-uuid>'
order by captured_at;
```

> `delivery_proofs.otp_code` exists so support can settle disputes. It is
> sensitive. Read it if the dispute needs it; do not copy it into a ticket, a
> chat, or an email.

### 5d. Decide the outcome

**Re-attempt** — customer reachable, address fixable. Create a new attempt. Do
not edit an old one; `delivery_attempts` is append-only and the number of failed
attempts is itself a dispute fact.

**Return to sender** — `returned_to_sender`, with
`shipments.cancellation_reason` set. The customer should be told before this
happens, not after.

**On hold / exception** — `on_hold` with `hold_reason`, or `exception` for
anything the enum does not otherwise cover. Both keep the parcel visible on the
board without asserting something false.

### 5e. Money

Check what was charged and what is still refundable **before** promising
anything to the customer:

```sql
select p.reference, p.status, p.amount_minor, p.currency,
       p.expected_amount_minor, p.refundable_amount_minor,
       p.verified_at, p.paid_at
from public.payments p
where p.booking_id = (select booking_id from public.shipments where id = '<shipment-uuid>')
order by p.created_at desc;
```

If a refund is warranted:

1. Create a row in `refunds` with `requested_by` set. `refunds_requester_check`
   requires it.
2. A **second person** authorises it — `authorised_by`, `authorised_at`. The
   separation is in the schema on purpose; a UI toggle is not a control.
3. Submit to Paystack with the refund's `reference`.
4. On provider confirmation set `status = 'succeeded'` and `completed_at`
   together — `refunds_completed_check` requires exactly that pairing.

Whether a failed delivery is refundable at all is an **open client decision**,
not a technical fact. `system_settings` carries it with `is_confirmed = false`.
Do not invent a policy on a call with a customer.

---

## 6. Quick health check

Worth running at the start of a shift.

```sql
-- Bookings stuck per stage.
select status, count(*), min(created_at) as oldest
from public.bookings where deleted_at is null group by status order by oldest;

-- Payments that should not still be open.
select status, count(*), min(created_at) as oldest
from public.payments
where status in ('pending','processing')
group by status order by oldest;

-- Webhooks failing.
select processing_status, count(*), max(received_at)
from public.payment_events group by processing_status;

-- Signature failures — should be zero, and its being zero is the good news.
select count(*) from public.payment_events where signature_valid is false;

-- Delivery failures in the last 24h.
select outcome, count(*) from public.delivery_attempts
where attempted_at > now() - interval '24 hours' group by outcome order by count(*) desc;

-- Email backlog.
select status, count(*) from public.notification_outbox group by status;

-- Duplicate webhook events — must be zero.
select count(*) from (
  select provider_event_id from public.payment_events
  group by provider_event_id having count(*) > 1
) d;
```

### Alerts worth wiring up

Not yet implemented. Ranked by how much damage they prevent if missed:

| Alert | Condition | Why it matters |
| --- | --- | --- |
| Webhook signature failures | any `signature_valid = false` | Someone is probing an endpoint that can mark orders paid |
| Duplicate provider events | count > 0 | Idempotency constraint is not in production |
| Payments stuck open | any `pending`/`processing` older than 1h | Money taken, order not confirmed |
| Notification backlog | `due_now` growing | Worker stopped; customers go quiet |
| Migration drift | `db:verify` failing on main | Schema and code diverged |
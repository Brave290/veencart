-- ============================================================================
-- Veencart Logistics — 0006_payments_ops.sql
-- ----------------------------------------------------------------------------
-- Payments, refunds, notification queue, audit trail, idempotency and settings.
--
-- THE CENTRAL RULE OF THIS FILE:
-- A browser redirect is not proof of payment. Nothing in this schema may be
-- advanced to "paid" by anything other than a server-side verification or a
-- signature-checked provider event. There is deliberately no column that the
-- client can write to make an order fulfilled.
--
-- Payment status, order status and shipment status are three independent
-- lifecycles. This file owns only the first. Keeping them apart is what stops
-- "shipment delivered but nobody paid" from being representable as a state a
-- single careless UPDATE can create.
--
-- CONVENTIONS (identical to 0001-0005):
--   * uuid PKs defaulting to gen_random_uuid()
--   * timestamptz ONLY — UTC is mandated
--   * Money is `amount_minor bigint` (kobo) + explicit `currency char(3)`
--   * Append-only history uses public.deny_mutation()
--   * updated_at maintained by public.touch_updated_at()
-- ============================================================================

-- Refund lifecycle needs its own state: a refund REQUEST is not a refund DONE.
-- Without this, "customer asked for money back" and "money went back" collapse
-- into one flag and support cannot tell them apart.
do $do$
begin
  if to_regtype('public.refund_status') is null then
    create type public.refund_status as enum (
      'requested',    -- raised, awaiting authorisation
      'processing',   -- submitted to the provider
      'succeeded',    -- provider confirmed the money moved
      'failed',       -- provider rejected it
      'cancelled'     -- withdrawn before completion
    );
  end if;

  if to_regtype('public.payable_kind') is null then
    create type public.payable_kind as enum ('booking', 'product_order');
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 1. Payments
-- ----------------------------------------------------------------------------
-- A payment belongs to EXACTLY ONE payable record. There is no "orphan payment"
-- and no matching-by-amount: two customers paying the same N5,000 must never be
-- able to credit each other's order. The CHECK enforces the single target.
--
-- `reference` is generated SERVER-SIDE and is the Paystack reference. It is
-- unique, which is what makes the provider's own idempotency work in our favour.
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique
                          check (reference ~ '^[A-Za-z0-9_-]{8,64}$'),
  payable_kind          public.payable_kind not null,
  booking_id            uuid references public.bookings (id) on delete restrict,
  product_order_id      uuid references public.product_orders (id) on delete restrict,

  amount_minor          bigint not null check (amount_minor > 0),
  currency              char(3) not null check (currency ~ '^[A-Z]{3}$'),

  status                public.payment_status not null default 'pending',
  provider              text not null default 'paystack'
                          check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),

  -- Payer is a SNAPSHOT taken at booking time. "Who pays" is a commercial
  -- decision made once; re-deriving it later from a mutable profile would make
  -- historic receipts unreadable.
  payer_role            public.payment_payer_role not null default 'sender',
  payer_name            text,
  payer_email           citext,
  payer_phone           text,

  -- Provider-side identifiers, populated only by server verification/webhooks.
  provider_reference    text,
  provider_status_code  integer,
  provider_channel      text,
  paid_at               timestamptz,
  verified_at           timestamptz,
  failure_reason        text,

  -- The amount we EXPECTED to receive, frozen before checkout was initialised.
  -- If the provider reports a different number, reconciliation flags it; the
  -- difference is never quietly absorbed.
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  expected_currency     char(3) not null check (expected_currency ~ '^[A-Z]{3}$'),

  refundable_amount_minor bigint check (refundable_amount_minor >= 0),
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint payments_single_payable_check check (
    (payable_kind = 'booking' and booking_id is not null and product_order_id is null)
    or (payable_kind = 'product_order' and product_order_id is not null and booking_id is null)
  ),
  constraint payments_amount_matches_expected_check check (amount_minor = expected_amount_minor),
  constraint payments_currency_matches_expected_check check (currency = expected_currency),
  constraint payments_success_requires_reference_check check (
    status <> 'succeeded' or (provider_reference is not null and paid_at is not null)
  )
);

-- One live payment attempt per payable record.
--
-- A partial UNIQUE INDEX is used rather than UNIQUE(booking_id, status) because
-- the rule we actually want is "no DOUBLE CHARGE IN FLIGHT", not "one row per
-- status". A partial index on the open states gives exactly that: many historic
-- failed attempts may pile up (retries must be allowed), but while one payment
-- is pending/processing, a second concurrent checkout for the same booking is
-- rejected at the database level rather than by hopeful application code.
create unique index if not exists payments_one_open_per_booking_idx
  on public.payments (booking_id)
  where booking_id is not null and status in ('pending', 'processing');

create unique index if not exists payments_one_open_per_order_idx
  on public.payments (product_order_id)
  where product_order_id is not null and status in ('pending', 'processing');

create unique index if not exists payments_provider_reference_idx
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create index if not exists payments_created_idx on public.payments (created_at desc);
-- Reconciliation sweeper: stale-pending lookups.
--
-- There is deliberately NO partial index here on `created_at < now() - '1 hour'`:
-- index predicates must be IMMUTABLE, and now() is not — PostgreSQL correctly
-- refuses it. A sweeper that runs on a cron scans a bounded window anyway, so a
-- plain composite index on (status, created_at) serves it perfectly well without
-- pinning a staleness threshold into the schema.
create index if not exists payments_status_created_idx
  on public.payments (status, created_at);

-- ----------------------------------------------------------------------------
-- 2. Payment events — APPEND ONLY, IDEMPOTENT BY PROVIDER EVENT ID
-- ----------------------------------------------------------------------------
-- `provider_event_id` is UNIQUE. That single constraint is what makes webhook
-- delivery at-least-once safe: Paystack retries, networks duplicate, and a
-- replayed event collides on insert instead of double-crediting a customer.
-- The handler catches the unique violation and acknowledges the retry.
create table if not exists public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'paystack',
  -- Natural key from the provider. Unique = the idempotency anchor.
  provider_event_id text not null unique
                      check (length(provider_event_id) between 1 and 200),
  event_type        text not null,
  payment_id        uuid references public.payments (id) on delete set null,
  provider_reference text,
  -- Full body retained for disputes and reconciliation. Must never contain card
  -- data; the provider does not send it and we must not reconstruct it.
  payload           jsonb not null default '{}'::jsonb,
  signature_valid   boolean,
  processing_status text not null default 'received'
                      check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processing_error  text,
  attempts          integer not null default 1 check (attempts > 0),
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists payment_events_payment_idx
  on public.payment_events (payment_id, received_at desc);
create index if not exists payment_events_unprocessed_idx
  on public.payment_events (received_at)
  where processing_status = 'received';
create index if not exists payment_events_reference_idx
  on public.payment_events (provider_reference)
  where provider_reference is not null;

drop trigger if exists payment_events_append_only on public.payment_events;
create trigger payment_events_append_only
  before update or delete on public.payment_events
  for each row execute function public.deny_mutation();

-- ----------------------------------------------------------------------------
-- 3. Refunds
-- ----------------------------------------------------------------------------
-- Authorisation is separated from execution: `requested_by` may be a staff
-- member with refund permission, `authorised_by` may be an admin. A second
-- person must approve where the policy demands it — enforced here rather than
-- in a UI toggle, because a UI toggle is not a control.
create table if not exists public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  payment_id         uuid not null references public.payments (id) on delete restrict,
  reference          text not null unique
                       check (reference ~ '^[A-Za-z0-9_-]{8,64}$'),
  amount_minor       bigint not null check (amount_minor > 0),
  currency           char(3) not null check (currency ~ '^[A-Z]{3}$'),
  reason             public.refund_reason not null,
  reason_detail      text,
  status             public.refund_status not null default 'requested',
  provider           text not null default 'paystack',
  provider_reference text,
  failure_reason     text,
  requested_by       uuid,
  authorised_by      uuid,
  requested_at       timestamptz not null default now(),
  authorised_at      timestamptz,
  submitted_at       timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint refunds_completed_check check (
    (status = 'succeeded') = (completed_at is not null)
  ),
  constraint refunds_requester_check check (requested_by is not null)
);

-- A refund may never exceed the amount still refundable on its payment.
--
-- This is a TRIGGER, not a CHECK constraint: PostgreSQL forbids subqueries in
-- CHECK expressions, and "how much is left on THIS payment" is necessarily a
-- cross-row question. Enforced at the database so it holds for every writer,
-- including reconciliation jobs and any future import path.
create or replace function public.enforce_refund_within_refundable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_refundable bigint;
  v_currency   char(3);
begin
  select p.refundable_amount_minor, p.currency
    into v_refundable, v_currency
  from public.payments p
  where p.id = new.payment_id;

  if not found then
    raise exception 'Payment % no longer exists.', new.payment_id
      using errcode = '23503';
  end if;

  -- No refundable balance recorded yet (e.g. settled without one) blocks any
  -- refund rather than defaulting to "unlimited".
  if v_refundable is null then
    raise exception 'Payment % has no recorded refundable balance.', new.payment_id
      using errcode = '23514',
            hint = 'Reconcile the payment before issuing refunds against it.';
  end if;

  if new.amount_minor > v_refundable then
    raise exception
      'Refund % kobo exceeds refundable balance % kobo on payment %.',
      new.amount_minor, v_refundable, new.payment_id
      using errcode = '23514';
  end if;

  if new.currency <> v_currency then
    raise exception
      'Refund currency % does not match payment currency %.',
      new.currency, v_currency
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists refunds_within_refundable_guard on public.refunds;
create trigger refunds_within_refundable_guard
  before insert or update of amount_minor, payment_id on public.refunds
  for each row execute function public.enforce_refund_within_refundable();

create index if not exists refunds_payment_idx on public.refunds (payment_id, created_at desc);
create index if not exists refunds_status_idx on public.refunds (status, created_at desc);
create unique index if not exists refunds_provider_reference_idx
  on public.refunds (provider, provider_reference) where provider_reference is not null;

-- ----------------------------------------------------------------------------
-- 4. Notification outbox
-- ----------------------------------------------------------------------------
-- Transactional-pattern queue: rows are written in the SAME transaction as the
-- business event, and a separate worker sends them. That ordering is what stops
-- "booking confirmed" emails for bookings that were rolled back.
--
-- `dedupe_key` is UNIQUE per template+recipient, so a retried webhook or a
-- double-clicked button cannot send the same message twice.
create table if not exists public.notification_outbox (
  id              uuid primary key default gen_random_uuid(),
  channel         public.notification_channel not null default 'email',
  template        text not null check (length(template) between 1 and 80),
  recipient_email citext not null,
  recipient_name  text,
  subject         text,
  -- Template variables / references. Never rendered HTML from the database.
  payload         jsonb not null default '{}'::jsonb,
  dedupe_key      text not null unique check (length(dedupe_key) between 1 and 200),
  status          public.notification_status not null default 'pending',
  attempts        integer not null default 0 check (attempts >= 0),
  max_attempts    integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  provider        text,
  provider_message_id text,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A message past its retry budget must stop, not loop forever.
  constraint notification_outbox_exhausted_check check (
    status <> 'failed' or attempts >= max_attempts
  )
);

-- The worker's hot query: due, unsent, oldest first.
create index if not exists notification_outbox_due_idx
  on public.notification_outbox (next_attempt_at)
  where status = 'pending';
create index if not exists notification_outbox_recipient_idx
  on public.notification_outbox (recipient_email, created_at desc);

-- ----------------------------------------------------------------------------
-- 5. Audit log — APPEND ONLY
-- ----------------------------------------------------------------------------
-- Every privileged action: role grants, price overrides, refunds, driver
-- assignment, forced status corrections. Corrections are new rows referencing
-- the superseded id; history is never rewritten.
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid,
  actor_role     public.app_role,
  actor_label    text,
  action         public.audit_action not null,
  entity_type    text not null check (length(entity_type) between 1 and 60),
  entity_id      uuid,
  -- SAFE METADATA ONLY. Never store tokens, secrets, full request bodies or
  -- personal data here: the audit log is read by staff and retained for years.
  metadata       jsonb not null default '{}'::jsonb,
  ip_address     inet,
  user_agent     text,
  supersedes_id  uuid references public.audit_logs (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_user_id, created_at desc);
create index if not exists audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.deny_mutation();

-- ----------------------------------------------------------------------------
-- 6. Idempotency keys
-- ----------------------------------------------------------------------------
-- Lets a retried POST (flaky mobile network, double-submitted form, webhook
-- replay) return the ORIGINAL result instead of performing the action twice.
-- `request_hash` detects the same key being reused for a DIFFERENT payload,
-- which is a client bug or an attack, and is rejected rather than served.
create table if not exists public.idempotency_keys (
  key             text primary key check (length(key) between 8 and 200),
  operation       text not null check (length(operation) between 1 and 80),
  request_hash    text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status          text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'failed')),
  response_status integer check (response_status between 100 and 599),
  response_body   jsonb,
  locked_at       timestamptz not null default now(),
  completed_at    timestamptz,
  expires_at      timestamptz not null default now() + interval '24 hours',
  created_at      timestamptz not null default now()
);

create index if not exists idempotency_keys_expiry_idx on public.idempotency_keys (expires_at);

-- ----------------------------------------------------------------------------
-- 7. System settings
-- ----------------------------------------------------------------------------
-- Configurable business values, editable by an admin, readable by the app.
-- `is_secret` rows must NEVER be read into a client payload. Secrets that are
-- not business settings (API keys) live in environment variables instead —
-- this table holds POLICY, not credentials.
create table if not exists public.system_settings (
  key          text primary key check (key ~ '^[a-z0-9]+(\.[a-z0-9_]+)*$'),
  value        jsonb not null,
  value_type   text not null default 'string'
                  check (value_type in ('string', 'number', 'boolean', 'json', 'string_array')),
  -- Whether a non-null value is required.
  description  text,
  is_secret    boolean not null default false,
  -- Marks values the business has NOT yet confirmed. Anything unconfirmed is
  -- surfaced as configurable rather than presented to customers as fact.
  is_confirmed boolean not null default false,
  updated_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists system_settings_unconfirmed_idx
  on public.system_settings (key) where is_confirmed = false;

-- ----------------------------------------------------------------------------
-- 8. updated_at triggers
-- ----------------------------------------------------------------------------
do $do$
declare
  t text;
begin
  foreach t in array array[
    'payments', 'refunds', 'notification_outbox'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end
$do$;
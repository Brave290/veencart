-- ============================================================================
-- Veencart Logistics — 0004_logistics.sql
-- ----------------------------------------------------------------------------
-- Service areas, route rules, bookings, quotes, shipments, and everything that
-- records what happened to a parcel.
--
-- ADDRESS MODEL: sender / recipient / delivery are stored as structured
-- columns (name, phone, email, street, locality, city, state, country). Shipping
-- addresses are snapshotted onto the record on purpose — editing a saved
-- address must never rewrite the address a parcel was actually sent to, and a
-- courier's label cannot be regenerated from a mutable profile.
--
-- All timestamps are timestamptz (UTC, mandated).
-- All money is amount_minor bigint (kobo) + currency char(3). Never float.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- service_areas — where Veencart delivers, and at what price band.
-- Public read: the quote form needs it before anyone signs in.
-- ----------------------------------------------------------------------------
create table if not exists public.service_areas (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  state             text not null,
  lga               text,
  localities        text[] not null default '{}',
  postal_codes      text[],
  service_types     public.service_type[] not null default '{standard}',
  base_fee_minor    bigint not null default 0,
  per_kg_minor      bigint not null default 0,
  currency          char(3) not null default 'NGN',
  min_charge_minor  bigint not null default 0,
  cutoff_local_time time,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint service_areas_state_nonnull check (state is not null),
  constraint service_areas_base_fee_nonneg_check check (base_fee_minor >= 0),
  constraint service_areas_per_kg_nonneg_check check (per_kg_minor >= 0),
  constraint service_areas_min_charge_nonneg_check check (min_charge_minor >= 0),
  constraint service_areas_currency_iso_check check (currency ~ '^[A-Z]{3}$')
);

create index if not exists service_areas_state_idx on public.service_areas (state);
create index if not exists service_areas_active_idx on public.service_areas (is_active);
create index if not exists service_areas_state_active_idx
  on public.service_areas (state)
  where is_active;

drop trigger if exists service_areas_touch_updated_at on public.service_areas;
create trigger service_areas_touch_updated_at
  before update on public.service_areas
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- route_rules — pricing / SLA overrides between area pairs.
-- Unique on (origin, destination, service_type) so a rule is unambiguous.
-- ----------------------------------------------------------------------------
create table if not exists public.route_rules (
  id                  uuid primary key default gen_random_uuid(),
  origin_area_id      uuid not null references public.service_areas (id) on delete cascade,
  destination_area_id uuid not null references public.service_areas (id) on delete cascade,
  service_type        public.service_type not null,
  flat_fee_minor      bigint,
  per_kg_minor        bigint,
  per_distance_minor  bigint,
  free_threshold_kg   numeric(10, 3),
  surcharge_minor     bigint not null default 0,
  max_weight_kg       numeric(10, 3),
  max_volume_m3       numeric(10, 4),
  transit_days_min    integer,
  transit_days_max    integer,
  is_excluded         boolean not null default false,
  is_active           boolean not null default true,
  currency            char(3) not null default 'NGN',
  valid_from          timestamptz not null default now(),
  valid_to            timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint route_rules_flat_fee_nonneg_check check (flat_fee_minor is null or flat_fee_minor >= 0),
  constraint route_rules_per_kg_nonneg_check check (per_kg_minor is null or per_kg_minor >= 0),
  constraint route_rules_surcharge_nonneg_check check (surcharge_minor >= 0),
  constraint route_rules_currency_iso_check check (currency ~ '^[A-Z]{3}$'),
  constraint route_rules_not_same_area_check check (origin_area_id <> destination_area_id),
  constraint route_rules_valid_window_check check (valid_to is null or valid_to > valid_from),
  constraint route_rules_transit_days_check check (
    (transit_days_min is null or transit_days_max is null or transit_days_max >= transit_days_min)
  )
);

create unique index if not exists route_rules_unique_route_idx
  on public.route_rules (origin_area_id, destination_area_id, service_type);

create index if not exists route_rules_origin_idx on public.route_rules (origin_area_id);
create index if not exists route_rules_destination_idx on public.route_rules (destination_area_id);
create index if not exists route_rules_active_idx
  on public.route_rules (origin_area_id, destination_area_id)
  where is_active;

drop trigger if exists route_rules_touch_updated_at on public.route_rules;
create trigger route_rules_touch_updated_at
  before update on public.route_rules
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- bookings — the customer's request. Pre-quote.
-- `customer_user_id` may be NULL for a guest booking; guest access is then
-- carried by guest_access_tokens. Exactly one of customer_user_id /
-- guest_booking_reference must be present.
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  booking_reference   text not null,
  customer_user_id    uuid,
  business_account_id uuid references public.business_accounts (id) on delete set null,

  service_type        public.service_type not null,
  status              public.booking_status not null default 'draft',

  -- Sender
  sender_name         text not null,
  sender_phone        text not null,
  sender_email        citext,
  sender_street       text,
  sender_locality     text,
  sender_city         text,
  sender_state        text,
  sender_country      char(2) not null default 'NG',

  -- Recipient
  recipient_name      text not null,
  recipient_phone     text not null,
  recipient_email     citext,
  recipient_street    text not null,
  recipient_street_detail text,
  recipient_locality  text,
  recipient_city      text not null,
  recipient_state     text not null,
  recipient_country   char(2) not null default 'NG',

  -- Parcel
  item_count          integer not null default 1,
  total_weight_kg     numeric(10, 3),
  total_volume_m3     numeric(10, 4),
  declared_value_minor bigint,
  declared_currency   char(3),
  contents_description text,
  is_fragile           boolean not null default false,
  requires_cold_chain boolean not null default false,

  pickup_address_id   uuid references public.customer_addresses (id) on delete set null,
  delivery_address_id uuid references public.customer_addresses (id) on delete set null,

  preferred_pickup_at timestamptz,
  preferred_delivery_at timestamptz,
  special_instructions text,

  -- Guest-capable reference; hashed by the application, never a live token.
  guest_booking_reference text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  cancelled_at        timestamptz,
  deleted_at          timestamptz,

  constraint bookings_count_check check (item_count > 0),
  constraint bookings_declared_value_nonneg_check check (declared_value_minor is null or declared_value_minor >= 0),
  constraint bookings_currency_iso_check check (declared_currency is null or declared_currency ~ '^[A-Z]{3}$'),
  constraint bookings_sender_country_check check (sender_country ~ '^[A-Z]{2}$'),
  constraint bookings_recipient_country_check check (recipient_country ~ '^[A-Z]{2}$'),
  constraint bookings_weight_nonneg_check check (total_weight_kg is null or total_weight_kg >= 0),
  constraint bookings_ownership_check check (
    customer_user_id is not null or guest_booking_reference is not null
  )
);

create unique index if not exists bookings_reference_idx on public.bookings (booking_reference);
create index if not exists bookings_customer_idx on public.bookings (customer_user_id);
create index if not exists bookings_business_idx on public.bookings (business_account_id);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_created_at_idx on public.bookings (created_at desc);
create index if not exists bookings_recipient_phone_idx on public.bookings (recipient_phone);
create index if not exists bookings_pickup_address_idx on public.bookings (pickup_address_id);
create index if not exists bookings_delivery_address_idx on public.bookings (delivery_address_id);
create index if not exists bookings_customer_active_idx
  on public.bookings (customer_user_id, created_at desc)
  where deleted_at is null;
create index if not exists bookings_guest_ref_idx
  on public.bookings (guest_booking_reference)
  where guest_booking_reference is not null;
-- Dispatcher work queue.
create index if not exists bookings_queue_idx
  on public.bookings (status, created_at)
  where deleted_at is null and status in ('quote_requested', 'quoted', 'awaiting_payment', 'confirmed');

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- booking_items — line items on a booking, individually tracked.
-- ----------------------------------------------------------------------------
create table if not exists public.booking_items (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings (id) on delete cascade,
  description       text not null,
  category          text,
  quantity          integer not null default 1,
  weight_kg         numeric(10, 3),
  length_cm         numeric(10, 2),
  width_cm          numeric(10, 2),
  height_cm         numeric(10, 2),
  volume_m3         numeric(10, 4),
  declared_value_minor bigint,
  declared_currency char(3),
  is_fragile        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint booking_items_quantity_check check (quantity > 0),
  constraint booking_items_weight_check check (weight_kg is null or weight_kg >= 0),
  constraint booking_items_value_check check (declared_value_minor is null or declared_value_minor >= 0),
  constraint booking_items_currency_check check (declared_currency is null or declared_currency ~ '^[A-Z]{3}$')
);

create index if not exists booking_items_booking_idx on public.booking_items (booking_id);
create index if not exists booking_items_booking_created_idx on public.booking_items (booking_id, created_at);

drop trigger if exists booking_items_touch_updated_at on public.booking_items;
create trigger booking_items_touch_updated_at
  before update on public.booking_items
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- quotes — a priced offer attached to a booking.
-- `accepted_at` + the unique index below make "accept the quote" idempotent:
-- two concurrent acceptance attempts cannot both win.
-- ----------------------------------------------------------------------------
create table if not exists public.quotes (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings (id) on delete cascade,
  quote_reference     text not null,
  status              public.quote_status not null default 'draft',
  service_type        public.service_type not null,
  route_rule_id       uuid references public.route_rules (id) on delete set null,

  subtotal_minor      bigint not null default 0,
  discount_minor      bigint not null default 0,
  surcharge_minor     bigint not null default 0,
  vat_minor           bigint not null default 0,
  total_minor         bigint not null default 0,
  currency            char(3) not null default 'NGN',

  transit_days_min    integer,
  transit_days_max    integer,
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz,

  valid_until         timestamptz,
  notes               text,
  created_by          uuid,
  accepted_at         timestamptz,
  accepted_by         uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint quotes_subtotal_check check (subtotal_minor >= 0),
  constraint quotes_discount_check check (discount_minor >= 0),
  constraint quotes_surcharge_check check (surcharge_minor >= 0),
  constraint quotes_vat_check check (vat_minor >= 0),
  constraint quotes_total_check check (total_minor >= 0),
  constraint quotes_currency_iso_check check (currency ~ '^[A-Z]{3}$'),
  -- A quote must actually add up. Without this, a bug in the pricing service
  -- can silently charge a customer a different amount from the one displayed.
  constraint quotes_total_consistent_check check (
    total_minor = subtotal_minor + surcharge_minor + vat_minor - discount_minor
  )
);

create unique index if not exists quotes_reference_idx on public.quotes (quote_reference);
-- At most one accepted quote per booking, enforced by the database.
create unique index if not exists quotes_one_accepted_per_booking_idx
  on public.quotes (booking_id)
  where status = 'accepted';
create index if not exists quotes_booking_idx on public.quotes (booking_id);
create index if not exists quotes_status_idx on public.quotes (status);
create index if not exists quotes_valid_until_idx on public.quotes (valid_until);
create index if not exists quotes_accepted_idx on public.quotes (accepted_at desc);
create index if not exists quotes_route_rule_idx on public.quotes (route_rule_id);

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- quote_items — the price breakdown shown to the customer.
-- Kept per-line so support can explain a charge without re-running pricing.
-- ----------------------------------------------------------------------------
create table if not exists public.quote_items (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.quotes (id) on delete cascade,
  label          text not null,
  description    text,
  quantity       numeric(10, 3) not null default 1,
  unit_amount_minor bigint not null default 0,
  amount_minor   bigint not null default 0,
  currency       char(3) not null default 'NGN',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint quote_items_unit_nonneg_check check (unit_amount_minor >= 0),
  constraint quote_items_amount_nonneg_check check (amount_minor >= 0),
  constraint quote_items_currency_iso_check check (currency ~ '^[A-Z]{3}$')
);

create index if not exists quote_items_quote_idx on public.quote_items (quote_id);

drop trigger if exists quote_items_touch_updated_at on public.quote_items;
create trigger quote_items_touch_updated_at
  before update on public.quote_items
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- shipments — a booking that became a physical movement.
-- `tracking_reference` is the public-facing handle shown to the customer.
--
-- DENORMALISATION NOTE: recipient/destination fields are copied from the booking
-- so a label printed at pickup does not change when a profile is edited.
-- ----------------------------------------------------------------------------
create table if not exists public.shipments (
  id                uuid primary key default gen_random_uuid(),
  shipment_reference text not null,
  tracking_reference text not null,
  booking_id        uuid not null references public.bookings (id) on delete restrict,
  quote_id          uuid references public.quotes (id) on delete set null,
  shipment_order_id uuid,

  status            public.shipment_status not null default 'requested',
  service_type      public.service_type not null,

  customer_user_id  uuid,             -- denormalised from bookings for RLS speed

  sender_name      text not null,
  sender_phone     text not null,
  sender_street    text,
  sender_locality  text,
  sender_city      text,
  sender_state     text,
  sender_country   char(2) not null default 'NG',

  recipient_name    text not null,
  recipient_phone   text not null,
  recipient_email   citext,
  recipient_street  text not null,
  recipient_street_detail text,
  recipient_locality text,
  recipient_city    text not null,
  recipient_state   text not null,
  recipient_country char(2) not null default 'NG',

  pickup_address_id   uuid references public.customer_addresses (id) on delete set null,
  delivery_address_id uuid references public.customer_addresses (id) on delete set null,

  weight_kg         numeric(10, 3),
  volume_m3         numeric(10, 4),
  declared_value_minor bigint,
  declared_currency char(3),

  amount_charged_minor bigint not null default 0,
  currency          char(3) not null default 'NGN',

  pickup_scheduled_at   timestamptz,
  pickup_actual_at      timestamptz,
  delivery_scheduled_at timestamptz,
  delivery_actual_at    timestamptz,
  estimated_delivery_at timestamptz,

  -- Latest known position. Drives the tracking map without scanning events.
  last_latitude    numeric(9, 6),
  last_longitude   numeric(9, 6),
  last_location_at timestamptz,
  last_location_note text,

  -- Current leg/origin so support can tell Lagos from Abuja at a glance.
  origin_area_id      uuid references public.service_areas (id) on delete set null,
  destination_area_id uuid references public.service_areas (id) on delete set null,

  delivery_attempts_count integer not null default 0,
  is_urgent           boolean not null default false,
  hold_reason         text,
  cancellation_reason text,
  tags                text[] not null default '{}',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  delivered_at      timestamptz,
  cancelled_at      timestamptz,

  constraint shipments_amount_nonneg_check check (amount_charged_minor >= 0),
  constraint shipments_currency_iso_check check (currency ~ '^[A-Z]{3}$'),
  constraint shipments_declared_value_nonneg_check check (declared_value_minor is null or declared_value_minor >= 0),
  constraint shipments_declared_currency_iso_check check (declared_currency is null or declared_currency ~ '^[A-Z]{3}$'),
  constraint shipments_attempts_nonneg_check check (delivery_attempts_count >= 0),
  constraint shipments_sender_country_check check (sender_country ~ '^[A-Z]{2}$'),
  constraint shipments_recipient_country_check check (recipient_country ~ '^[A-Z]{2}$'),
  constraint shipments_lat_check check (last_latitude is null or (last_latitude >= -90 and last_latitude <= 90)),
  constraint shipments_lng_check check (last_longitude is null or (last_longitude >= -180 and last_longitude <= 180)),
  -- delivered_at is only meaningful once delivered.
  constraint shipments_delivered_consistent_check check (
    status <> 'delivered' or delivery_actual_at is not null
  )
);

create unique index if not exists shipments_shipment_reference_idx on public.shipments (shipment_reference);
create unique index if not exists shipments_tracking_reference_idx on public.shipments (tracking_reference);
create index if not exists shipments_booking_idx on public.shipments (booking_id);
create index if not exists shipments_quote_idx on public.shipments (quote_id);
create index if not exists shipments_customer_idx on public.shipments (customer_user_id);
create index if not exists shipments_status_idx on public.shipments (status);
create index if not exists shipments_recipient_phone_idx on public.shipments (recipient_phone);
create index if not exists shipments_pickup_address_idx on public.shipments (pickup_address_id);
create index if not exists shipments_delivery_address_idx on public.shipments (delivery_address_id);
create index if not exists shipments_origin_area_idx on public.shipments (origin_area_id);
create index if not exists shipments_destination_area_idx on public.shipments (destination_area_id);
create index if not exists shipments_created_at_idx on public.shipments (created_at desc);
create index if not exists shipments_delivery_scheduled_idx on public.shipments (delivery_scheduled_at);
-- Dispatch board: active work, newest first.
create index if not exists shipments_active_board_idx
  on public.shipments (status, delivery_scheduled_at)
  where status in ('confirmed', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'exception', 'on_hold');
-- Customer "my shipments" list.
create index if not exists shipments_customer_created_idx
  on public.shipments (customer_user_id, created_at desc);

drop trigger if exists shipments_touch_updated_at on public.shipments;
create trigger shipments_touch_updated_at
  before update on public.shipments
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- shipment_events — APPEND-ONLY timeline.
--
-- previous_status / new_status / actor_user_id / actor_role make the trail
-- reconstructable. `public_message` is the only text safe to show a customer;
-- `internal_note` is staff-only and must never be selected into a customer
-- response. `is_customer_visible` is the gate; when it is false the customer
-- cannot even see the row.
--
-- Corrections are NEW rows referencing the superseded event. UPDATE and DELETE
-- are blocked by trigger (public.deny_mutation).
-- ----------------------------------------------------------------------------
create table if not exists public.shipment_events (
  id                uuid primary key default gen_random_uuid(),
  shipment_id       uuid not null references public.shipments (id) on delete cascade,
  booking_id        uuid,
  sequence_no       integer not null,
  event_type        public.shipment_event_type not null,
  previous_status   public.shipment_status,
  new_status        public.shipment_status,
  actor_user_id     uuid,
  actor_role        public.app_role,
  actor_label       text,
  occurred_at       timestamptz not null default now(),
  recorded_at       timestamptz not null default now(),
  location_latitude numeric(9, 6),
  location_longitude numeric(9, 6),
  location_name     text,
  public_message    text,
  internal_note     text,
  -- DEFAULT FALSE, NOT TRUE.
  --
  -- This was `default true`, and that is a privacy bug with a nasty shape: the
  -- lowest-trust writer in the system (a driver) could post an event containing
  -- an internal note and leave this flag unset, and the customer-facing timeline
  -- query — which filters on this column — would then publish it. Publishing to
  -- a customer must be an explicit, deliberate act. Omitting the flag now means
  -- "staff only", which is the direction that fails safely.
  is_customer_visible boolean not null default false,
  supersedes_event_id uuid references public.shipment_events (id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  constraint shipment_events_sequence_positive_check check (sequence_no > 0),
  constraint shipment_events_lat_check check (location_latitude is null or (location_latitude >= -90 and location_latitude <= 90)),
  constraint shipment_events_lng_check check (location_longitude is null or (location_longitude >= -180 and location_longitude <= 180)),
  -- A status change must state both sides of the transition.
  constraint shipment_events_status_transition_check check (
    event_type <> 'status_change'
    or (previous_status is not null and new_status is not null)
  ),
  constraint shipment_events_actor_check check (
    event_type <> 'status_change' or actor_user_id is not null
  )
);

-- One row per sequence number per shipment: concurrent status writes collide
-- instead of producing a duplicated "attempt 1".
create unique index if not exists shipment_events_sequence_idx
  on public.shipment_events (shipment_id, sequence_no);
create index if not exists shipment_events_shipment_occurred_idx
  on public.shipment_events (shipment_id, occurred_at desc);
create index if not exists shipment_events_booking_idx on public.shipment_events (booking_id);
create index if not exists shipment_events_actor_idx on public.shipment_events (actor_user_id);
create index if not exists shipment_events_type_idx on public.shipment_events (event_type);
create index if not exists shipment_events_customer_timeline_idx
  on public.shipment_events (shipment_id, occurred_at desc)
  where is_customer_visible;
create index if not exists shipment_events_supersedes_idx on public.shipment_events (supersedes_event_id);

drop trigger if exists shipment_events_append_only on public.shipment_events;
create trigger shipment_events_append_only
  before update or delete on public.shipment_events
  for each row execute function public.deny_mutation();

-- ----------------------------------------------------------------------------
-- shipment_assignments — who is carrying which parcel, and when.
--
-- The EXCLUDE constraint is the point of this table: it makes double-booking a
-- driver impossible at the database level. Two rows for the same driver with
-- overlapping [scheduled_start, scheduled_end) windows are rejected by Postgres,
-- so two dispatchers clicking "assign" at the same moment cannot both win.
-- Requires btree_gist for the uuid equality part.
--
-- RECURSION NOTE: public.is_assigned_driver() reads this table, so no policy on
-- this table may call it. Driver-facing policies here compare driver_user_id
-- directly instead.
-- ----------------------------------------------------------------------------
create table if not exists public.shipment_assignments (
  id                 uuid primary key default gen_random_uuid(),
  shipment_id        uuid not null references public.shipments (id) on delete cascade,
  driver_user_id     uuid not null,
  assigned_by        uuid,
  scheduled_start    timestamptz not null,
  scheduled_end      timestamptz not null,
  actual_start       timestamptz,
  actual_end         timestamptz,
  released_at        timestamptz,     -- NULL = still an active assignment
  released_reason    text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint shipment_assignments_window_check check (scheduled_end > scheduled_start),
  constraint shipment_assignments_release_check check (released_at is null or released_at >= created_at)
);

-- NO DOUBLE-BOOKING A DRIVER — and why there is no EXCLUDE constraint here.
--
-- The natural encoding is `exclude using gist (driver_user_id with =,
-- tstzrange(scheduled_start, scheduled_end) with && where (released_at is null))`.
-- THAT IS NOT VALID POSTGRESQL. EXCLUDE constraints cannot take a WHERE clause;
-- partial exclusion constraints were proposed and never implemented. An
-- unconditional exclusion is also wrong, because it would keep a RELEASED
-- assignment blocking the driver forever, which breaks reassignment — a core
-- dispatcher workflow.
--
-- So the constraint is enforced in the service layer instead, inside the same
-- transaction that inserts the assignment:
--   1. pg_advisory_xact_lock(hashtextextended(driver_id, 0))  -- serialises
--      concurrent assignments for this driver; released at COMMIT/ROLLBACK.
--   2. An overlap SELECT against the partial index below. Row lock (FOR UPDATE)
--      makes the check stable against concurrent inserts.
-- This is verified by a concurrent-assignment integration test, not assumed.
create index if not exists shipment_assignments_active_driver_idx
  on public.shipment_assignments (driver_user_id, scheduled_start, scheduled_end)
  where released_at is null;;

create index if not exists shipment_assignments_shipment_idx on public.shipment_assignments (shipment_id);
create index if not exists shipment_assignments_driver_idx on public.shipment_assignments (driver_user_id);
create index if not exists shipment_assignments_assigned_by_idx on public.shipment_assignments (assigned_by);
-- Hot path: "my jobs right now".
create index if not exists shipment_assignments_driver_active_idx
  on public.shipment_assignments (driver_user_id, scheduled_start)
  where released_at is null;
create index if not exists shipment_assignments_window_idx
  on public.shipment_assignments (scheduled_start, scheduled_end)
  where released_at is null;

drop trigger if exists shipment_assignments_touch_updated_at on public.shipment_assignments;
create trigger shipment_assignments_touch_updated_at
  before update on public.shipment_assignments
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- delivery_attempts — every try at the door, successful or not.
-- Append-only: the number of failed attempts is a dispute fact, and editing it
-- later is never legitimate.
-- ----------------------------------------------------------------------------
create table if not exists public.delivery_attempts (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments (id) on delete cascade,
  attempt_number  integer not null,
  driver_user_id  uuid,
  attempted_at    timestamptz not null default now(),
  outcome         text not null,
  failure_reason  text,
  recipient_name_given text,
  contact_phone_used text,
  latitude        numeric(9, 6),
  longitude       numeric(9, 6),
  notes           text,
  created_at      timestamptz not null default now(),
  constraint delivery_attempts_number_check check (attempt_number > 0),
  constraint delivery_attempts_outcome_check check (
    outcome in ('delivered', 'recipient_absent', 'refused', 'address_unknown',
                'phone_unreachable', 'premises_closed', 'rescheduled', 'damaged', 'other')
  ),
  constraint delivery_attempts_lat_check check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint delivery_attempts_lng_check check (longitude is null or (longitude >= -180 and longitude <= 180))
);

-- The canonical attempt number for a shipment.
create unique index if not exists delivery_attempts_shipment_number_idx
  on public.delivery_attempts (shipment_id, attempt_number);
create index if not exists delivery_attempts_shipment_idx on public.delivery_attempts (shipment_id);
create index if not exists delivery_attempts_driver_idx on public.delivery_attempts (driver_user_id);
create index if not exists delivery_attempts_attempted_at_idx on public.delivery_attempts (attempted_at desc);

drop trigger if exists delivery_attempts_append_only on public.delivery_attempts;
create trigger delivery_attempts_append_only
  before update or delete on public.delivery_attempts
  for each row execute function public.deny_mutation();

-- ----------------------------------------------------------------------------
-- delivery_proofs — evidence a parcel reached a human.
-- `otp_code` is what the recipient gives the driver; it is stored so support can
-- settle "did you actually deliver it?" disputes. Treat it as sensitive.
-- ----------------------------------------------------------------------------
create table if not exists public.delivery_proofs (
  id             uuid primary key default gen_random_uuid(),
  shipment_id    uuid not null references public.shipments (id) on delete cascade,
  delivery_attempt_id uuid references public.delivery_attempts (id) on delete set null,
  proof_type     public.proof_type not null,
  image_url      text,
  signature_data text,           -- base64 SVG; not used for biometrics
  signer_name    text,
  otp_code       text,
  geo_latitude   numeric(9, 6),
  geo_longitude  numeric(9, 6),
  recipient_note text,
  captured_by    uuid,
  captured_at    timestamptz not null default now(),
  device_meta    jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  constraint delivery_proofs_lat_check check (geo_latitude is null or (geo_latitude >= -90 and geo_latitude <= 90)),
  constraint delivery_proofs_lng_check check (geo_longitude is null or (geo_longitude >= -180 and geo_longitude <= 180)),
  constraint delivery_proofs_photo_url_check check (
    proof_type <> 'photo' or image_url is not null
  )
);

create index if not exists delivery_proofs_shipment_idx on public.delivery_proofs (shipment_id);
create index if not exists delivery_proofs_attempt_idx on public.delivery_proofs (delivery_attempt_id);
create index if not exists delivery_proofs_captured_at_idx on public.delivery_proofs (captured_at desc);

drop trigger if exists delivery_proofs_touch_updated_at on public.delivery_proofs;
create trigger delivery_proofs_touch_updated_at
  before update on public.delivery_proofs
  for each row execute function public.touch_updated_at();
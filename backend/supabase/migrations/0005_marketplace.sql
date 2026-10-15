-- ============================================================================
-- Veencart Logistics — 0005_marketplace.sql
-- ----------------------------------------------------------------------------
-- Catalogue, inventory, carts and product orders for the Veencart-managed store.
--
-- SCOPE NOTE — no `pricing_rules` table:
-- An earlier draft of the design listed a generic `pricing_rules` table. It was
-- deliberately NOT created. Tariffs already live in `service_areas`
-- (base_fee_minor, per_kg_minor, min_charge_minor, per service_type array) and
-- `route_rules` (flat_fee_minor, per_kg_minor, per_distance_minor,
-- free_threshold_kg, surcharge_minor, validity window). Those two tables ARE the
-- pricing configuration: they are row-per-covered-geometry, which is how a real
-- rate card is shaped and how it is actually queried ("this origin, this
-- destination, this service"). A second generic rules table would duplicate
-- that data with weaker constraints and no query that the existing two cannot
-- serve. Surcharges are covered by route_rules.surcharge_minor and minimums by
-- service_areas.min_charge_minor. Revisit only if multi-currency or
-- customer-specific contract pricing is ever required.
--
-- CONVENTIONS (identical to 0001-0004):
--   * uuid PKs defaulting to gen_random_uuid()
--   * timestamptz ONLY — UTC is mandated. Local business dates are derived with
--     AT TIME ZONE 'Africa/Lagos' at query time, never stored naive.
--   * Money is `amount_minor bigint` (kobo) + explicit `currency char(3)`.
--     NEVER float / numeric for money.
--   * Append-only history uses the existing public.deny_mutation() trigger.
--   * updated_at maintained by the existing public.touch_updated_at() trigger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Categories
-- ----------------------------------------------------------------------------
-- Hierarchy via parent_id. Self-reference, so a cycle (A -> B -> A) is
-- theoretically insertable; the depth is capped at 2 levels (top + child) by
-- `parent_is_top_check`, and a cycle cannot be built within 2 levels. Deeper
-- trees would need a recursive CTE validation trigger — deliberately not
-- built until the business actually nests three levels deep (YAGNI).
create table if not exists public.product_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) between 1 and 120),
  slug            text not null unique
                    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description     text,
  parent_id       uuid references public.product_categories (id) on delete set null,
  image_object_key text,
  icon            text,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint product_categories_parent_not_self check (parent_id is null or parent_id <> id)
);

-- Single-level nesting (top + child, no grandchild) is enforced by a TRIGGER,
-- not a CHECK constraint: PostgreSQL forbids subqueries in CHECK, so the obvious
-- spelling — `check (parent_id is null or (select p.parent_id from ...) is null)`
-- — is rejected outright. A CHECK cannot consult another row by definition, and
-- "my parent has no parent" is inherently a cross-row question.
-- It is enforced as a BEFORE INSERT OR UPDATE trigger so both the insert and the
-- later re-parenting path are covered, and a cycle is rejected the moment it is
-- attempted rather than corrupting the tree.
create or replace function public.enforce_category_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id into v_grandparent
  from public.product_categories
  where id = new.parent_id;

  -- Parent vanished between the FK check and here (concurrent delete).
  if not found then
    raise exception 'Parent category % no longer exists.', new.parent_id
      using errcode = '23503';
  end if;

  if v_grandparent is not null then
    raise exception
      'Category depth is limited to two levels; % cannot nest under a child of %.',
      new.parent_id, v_grandparent
      using errcode = '23514',
            hint = 'Flatten the taxonomy to top-level categories plus children.';
  end if;

  return new;
end;
$$;

drop trigger if exists product_categories_depth_guard on public.product_categories;
create trigger product_categories_depth_guard
  before insert or update of parent_id on public.product_categories
  for each row execute function public.enforce_category_depth();

create index if not exists product_categories_parent_idx
  on public.product_categories (parent_id);
create index if not exists product_categories_active_sort_idx
  on public.product_categories (sort_order, name) where is_active;

-- ----------------------------------------------------------------------------
-- 2. Products
-- ----------------------------------------------------------------------------
-- `slug` is the public URL key. `sku` is the operational identifier that is
-- FROZEN into product_order_items at checkout.
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  sku              text not null unique
                     check (sku ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  slug             text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id      uuid references public.product_categories (id) on delete set null,
  title            text not null check (length(btrim(title)) between 1 and 200),
  short_description text,
  description      text,
  price_minor      bigint not null check (price_minor >= 0),
  compare_at_minor bigint check (compare_at_minor >= 0),
  currency         char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  weight_kg        numeric(10,3) check (weight_kg >= 0),
  is_published     boolean not null default false,
  is_active        boolean not null default true,
  requires_shipping boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  -- A "was" price must actually be higher, otherwise the badge lies.
  constraint products_compare_at_check check (
    compare_at_minor is null or compare_at_minor > price_minor
  )
);

create index if not exists products_category_idx on public.products (category_id);
-- Serves the storefront listing: published + not deleted, newest first.
create index if not exists products_public_listing_idx
  on public.products (created_at desc)
  where is_published = true and deleted_at is null and is_active = true;

create table if not exists public.product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  object_key     text not null,
  public_url     text,
  alt_text       text not null default '',
  width_px       integer check (width_px is null or width_px > 0),
  height_px      integer check (height_px is null or height_px > 0),
  display_order  integer not null default 0,
  is_primary     boolean not null default false,
  created_at     timestamptz not null default now(),
  -- The object key must be server-generated, never a client path.
  constraint product_images_object_key_check check (
    object_key !~ '\.\.' and object_key !~ '^/' and length(object_key) between 1 and 512
  )
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, display_order);

-- At most one primary image per product. Enforced with a partial unique index
-- rather than a trigger, so it is visible in the schema at a glance.
create unique index if not exists product_images_one_primary_idx
  on public.product_images (product_id) where is_primary;

-- ----------------------------------------------------------------------------
-- 3. Inventory
-- ----------------------------------------------------------------------------
-- AVAILABLE and RESERVED are stored separately and both constrained >= 0.
--
-- Why separate: `available` is what a shopper may buy right now; `reserved` is
-- stock held by an in-flight checkout that has not been paid. Collapsing them
-- into one number makes "released but not yet picked" indistinguishable from
-- "never existed", and makes partial cancellation arithmetic wrong.
--
-- available_quantity = physical/on-hand minus reserved. `reserved_quantity`
-- never exceeds what was on hand at reservation time.
create table if not exists public.inventory (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null unique references public.products (id) on delete cascade,
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity  integer not null default 0 check (reserved_quantity >= 0),
  reorder_level      integer not null default 0 check (reorder_level >= 0),
  version            bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Inventory movements — APPEND ONLY
-- ----------------------------------------------------------------------------
-- Every change to inventory lands here with an actor and a reason. Corrections
-- are new rows of type 'adjustment'; nothing is ever rewritten in place.
create table if not exists public.inventory_movements (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete restrict,
  movement_type     public.inventory_movement_type not null,
  delta_available   integer not null default 0,
  delta_reserved    integer not null default 0,
  resulting_available integer not null check (resulting_available >= 0),
  resulting_reserved  integer not null check (resulting_reserved >= 0),
  reason            text,
  actor_user_id     uuid,
  reference_type    text,
  reference_id      uuid,
  note              text,
  created_at        timestamptz not null default now(),
  -- A movement that changes nothing is a bug, not a no-op worth storing.
  constraint inventory_movements_nonzero_check check (
    delta_available <> 0 or delta_reserved <> 0
  ),
  constraint inventory_movements_actor_check check (
    actor_user_id is not null or movement_type in ('reservation', 'release')
  )
);

create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);
create index if not exists inventory_movements_actor_idx
  on public.inventory_movements (actor_user_id, created_at desc);
create index if not exists inventory_movements_reference_idx
  on public.inventory_movements (reference_type, reference_id)
  where reference_id is not null;

drop trigger if exists inventory_movements_append_only on public.inventory_movements;
create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function public.deny_mutation();

-- ----------------------------------------------------------------------------
-- 5. Carts
-- ----------------------------------------------------------------------------
-- Guest carts hold NO account. They are addressed by `session_key_hash`: a
-- SHA-256 of a high-entropy, httpOnly cookie value generated server-side. The
-- raw key is never stored, exactly as guest_access_tokens stores only its hash,
-- so a database dump does not yield a usable cart handle.
create table if not exists public.carts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete cascade,
  session_key_hash text check (session_key_hash ~ '^[0-9a-f]{64}$'),
  status           text not null default 'active'
                     check (status in ('active', 'converted', 'abandoned', 'expired')),
  expires_at       timestamptz not null default now() + interval '30 days',
  converted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- A cart is EITHER a user cart OR an anonymous cart. Never neither (an
  -- orphan cart is unreachable and can never be converted or expired usefully).
  constraint carts_owner_check check (user_id is not null or session_key_hash is not null),
  constraint carts_converted_check check (
    (status = 'converted') = (converted_at is not null)
  )
);

create index if not exists carts_user_idx on public.carts (user_id) where user_id is not null;
create unique index if not exists carts_session_active_idx
  on public.carts (session_key_hash) where session_key_hash is not null and status = 'active';
create index if not exists carts_expiry_idx on public.carts (expires_at) where status = 'active';

create table if not exists public.cart_items (
  id                uuid primary key default gen_random_uuid(),
  cart_id           uuid not null references public.carts (id) on delete cascade,
  product_id        uuid not null references public.products (id) on delete cascade,
  quantity          integer not null check (quantity between 1 and 999),
  -- Display-time snapshot only. Checkout RE-PRICES from products.price_minor;
  -- this column is never trusted as the amount charged.
  unit_price_minor  bigint not null check (unit_price_minor >= 0),
  currency          char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint cart_items_unique_per_product unique (cart_id, product_id)
);

create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

-- ----------------------------------------------------------------------------
-- 6. Product orders
-- ----------------------------------------------------------------------------
-- ORDER STATUS AND PAYMENT STATUS ARE SEPARATE ON PURPOSE.
-- product_order_status tracks fulfilment; `payments` (0006) tracks money. A
-- refund can be issued while an order is 'delivered', and a paid order can sit
-- at 'processing' for days. Folding them together produces states like
-- "paid_but_not_delivered" that mean two different things to two audiences.
create table if not exists public.product_orders (
  id                    uuid primary key default gen_random_uuid(),
  order_reference       text not null unique,
  user_id               uuid references public.profiles (id) on delete set null,
  -- Denormalised customer + delivery snapshot. Frozen at checkout on purpose:
  -- editing a saved address later must not rewrite where a past parcel went.
  customer_name         text not null,
  customer_phone        text not null,
  customer_email        citext,
  delivery_name         text not null,
  delivery_phone        text not null,
  delivery_street       text not null,
  delivery_street_detail text,
  delivery_locality     text,
  delivery_city         text,
  delivery_state        text not null,
  delivery_country      char(2) not null default 'NG' check (delivery_country ~ '^[A-Z]{2}$'),
  delivery_notes        text,

  subtotal_minor        bigint not null check (subtotal_minor >= 0),
  shipping_minor        bigint not null default 0 check (shipping_minor >= 0),
  discount_minor        bigint not null default 0 check (discount_minor >= 0),
  total_minor           bigint not null check (total_minor >= 0),
  currency              char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),

  status                public.product_order_status not null default 'pending_payment',
  -- Stock is held for this long before the reservation is released.
  reservation_expires_at timestamptz,
  fulfilment_shipment_id uuid,  -- FK added below, once shipments exists
  notes                 text,
  placed_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,

  -- The total must equal its own parts. This is the cheapest possible defence
  -- against a tampered or buggy checkout total.
  constraint product_orders_total_consistent_check check (
    total_minor = subtotal_minor + shipping_minor - discount_minor
  ),
  constraint product_orders_discount_check check (discount_minor <= subtotal_minor),
  constraint product_orders_currency_iso_check check (currency ~ '^[A-Z]{3}$')
);

create index if not exists product_orders_user_idx
  on public.product_orders (user_id, created_at desc);
create index if not exists product_orders_status_idx
  on public.product_orders (status, created_at desc);
-- Staff fulfilment queue: unfulfilled paid orders, oldest first.
create index if not exists product_orders_fulfilment_queue_idx
  on public.product_orders (created_at)
  where status in ('paid', 'processing');
-- Drives the reservation-expiry sweeper.
create index if not exists product_orders_reservation_expiry_idx
  on public.product_orders (reservation_expires_at)
  where reservation_expires_at is not null and status = 'pending_payment';

-- ----------------------------------------------------------------------------
-- 7. Product order items — IMMUTABLE SNAPSHOT
-- ----------------------------------------------------------------------------
-- sku, product_name and unit_price_minor are COPIES, not references. Renaming a
-- product or changing its price tomorrow must not alter what a customer was
-- charged, what they were told, or what was delivered. product_id is kept only
-- for analytics and is ON DELETE SET NULL — deleting a catalogue row must never
-- destroy order history.
create table if not exists public.product_order_items (
  id                uuid primary key default gen_random_uuid(),
  product_order_id  uuid not null references public.product_orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  sku               text not null,
  product_name      text not null,
  unit_price_minor  bigint not null check (unit_price_minor >= 0),
  quantity          integer not null check (quantity between 1 and 999),
  line_total_minor  bigint not null check (line_total_minor >= 0),
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at        timestamptz not null default now(),
  constraint product_order_items_line_total_check check (
    line_total_minor = unit_price_minor * quantity
  )
);

create index if not exists product_order_items_order_idx
  on public.product_order_items (product_order_id);

-- ----------------------------------------------------------------------------
-- 8. Deferred foreign keys
-- ----------------------------------------------------------------------------
-- `shipments.shipment_order_id` was created in 0004 without a constraint because
-- product_orders did not exist yet. Now that it does, the reference becomes real.
-- Guarded because 0004 may be replayed against a database where it already exists.
do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.shipments'::regclass
      and conname = 'shipments_shipment_order_id_fkey'
  ) then
    alter table public.shipments
      add constraint shipments_shipment_order_id_fkey
      foreign key (shipment_order_id)
      references public.product_orders (id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_orders'::regclass
      and conname = 'product_orders_fulfilment_shipment_id_fkey'
  ) then
    alter table public.product_orders
      add constraint product_orders_fulfilment_shipment_id_fkey
      foreign key (fulfilment_shipment_id)
      references public.shipments (id) on delete set null;
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 9. updated_at triggers
-- ----------------------------------------------------------------------------
do $do$
declare
  t text;
begin
  foreach t in array array[
    'product_categories', 'products', 'product_images', 'inventory',
    'carts', 'cart_items', 'product_orders', 'product_order_items'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end
$do$;
-- ============================================================================
-- Veencart Logistics — 0007_rls.sql
-- ----------------------------------------------------------------------------
-- Row Level Security for EVERY table. Until this file runs, the schema is an
-- open book: every row in every table is readable by `anon` and `authenticated`.
--
-- THE RECURSION TRAP (42P17) — read before writing any policy here:
-- A policy that reads the table it protects raises
--     ERROR: infinite recursion detected in policy for relation "x"
-- (SQLSTATE 42P17) and the query FAILS FOR EVERY ROLE — not merely the offending
-- one. One bad policy takes the whole application down, for admins included.
--
-- The trap is most obviously waiting at `user_roles`: its own policy has to ask
-- "is the caller an admin?", and is_admin() answers that by reading user_roles.
-- Left alone, that is the recursion.
--
-- WHY IT IS SAFE HERE: every helper in 0001 is SECURITY DEFINER and owned by
-- `veencart_authz`, a role carrying the BYPASSRLS attribute (0001 transfers
-- ownership, falling back to the migration-runner superuser when BYPASSRLS is
-- unavailable). A BYPASSRLS owner is not subject to row security, so the
-- function's inner SELECT is never re-filtered by user_roles' own policy. The
-- policy does not re-enter, therefore it cannot recurse.
--
-- 0007 VERIFIES that ownership transfer actually happened and RAISES if it did
-- not — a silent fallback to a non-BYPASSRLS owner would reintroduce 42P17 at
-- runtime, in production, on whichever query happened to hit it first.
--
-- MAINTENANCE RULE: never SELECT from user_roles inside a policy expression.
-- Always call public.has_role(...) / is_admin() / is_staff() / is_dispatcher() /
-- is_driver(). And never call is_assigned_driver() in a policy on
-- shipment_assignments — it reads that very table. Compare driver_user_id there.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Pre-flight: prove the helpers actually bypass row security
-- ----------------------------------------------------------------------------
do $do$
declare
  v_owner_ok boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_roles r on r.oid = p.proowner
    where p.oid = to_regprocedure('public.is_admin()')
      and (r.rolbypassrls or r.rolsuper)
  ) into v_owner_ok;

  if not v_owner_ok then
    raise exception
      'ABORT: public.is_admin() is not owned by a BYPASSRLS/SUPERUSER role. '
      'Its inner SELECT over user_roles would be re-filtered by that table''s '
      'own policy, raising SQLSTATE 42P17 and failing every query in the app. '
      'Fix 0001''s veencart_authz ownership transfer before continuing.'
      using errcode = '42501';
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 1. Enable RLS everywhere
-- ----------------------------------------------------------------------------
-- FORCE makes the policy apply to the table OWNER too, not just to anon and
-- authenticated. Without FORCE, any code that happens to connect as the owning
-- role silently reads every row. That is exactly the mistake that turns a
-- "service_role" connection into an IDOR.
do $do$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'customer_addresses', 'guest_access_tokens',
    'business_accounts', 'service_areas', 'route_rules', 'bookings',
    'booking_items', 'quotes', 'quote_items', 'shipments', 'shipment_events',
    'shipment_assignments', 'delivery_attempts', 'delivery_proofs',
    'product_categories', 'products', 'product_images', 'inventory',
    'inventory_movements', 'carts', 'cart_items', 'product_orders',
    'product_order_items', 'payments', 'payment_events', 'refunds',
    'notification_outbox', 'audit_logs', 'idempotency_keys', 'system_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end
$do$;

-- ----------------------------------------------------------------------------
-- 2. Privileges
-- ----------------------------------------------------------------------------
-- `anon` receives NO grant on anything by default. It is not granted table
-- privileges here; the only tables it may read are the three public catalogue
-- tables granted explicitly in section 4. Default-deny is the safe posture —
-- forgetting a revoke must fail closed, never open.
grant usage on schema public to anon, authenticated, service_role, veencart_service;

do $do$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'customer_addresses', 'guest_access_tokens',
    'business_accounts', 'service_areas', 'route_rules', 'bookings',
    'booking_items', 'quotes', 'quote_items', 'shipments', 'shipment_events',
    'shipment_assignments', 'delivery_attempts', 'delivery_proofs',
    'product_categories', 'products', 'product_images', 'inventory',
    'inventory_movements', 'carts', 'cart_items', 'product_orders',
    'product_order_items', 'payments', 'payment_events', 'refunds',
    'notification_outbox', 'audit_logs', 'idempotency_keys', 'system_settings'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role, veencart_service', t);
  end loop;
end
$do$;

-- Guest tokens, provider events, the outbox, audit and idempotency tables are
-- SERVER-ONLY. Even an authenticated customer must not read them: a guest token
-- row leaks the hash of an access credential, and payment_events carries raw
-- provider payloads. No policy below grants these to `authenticated`.
revoke all on public.guest_access_tokens from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.idempotency_keys from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

-- `inventory` is staff-only. Exact stock counts are competitive information and
-- tell a scraper precisely how hard to hammer the last unit.
revoke all on public.inventory from anon, authenticated;
revoke all on public.inventory_movements from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Identity
-- ----------------------------------------------------------------------------
-- profiles: a customer sees and edits their own row. Staff see all (they must
-- call customers). Nobody may flip their own `is_active` — that is an account
-- state a user must not be able to set on themselves.
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = public.current_user_id() or public.is_staff());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = public.current_user_id());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = public.current_user_id())
  with check (id = public.current_user_id() and is_active);

create policy profiles_staff_all on public.profiles
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- user_roles: reading your own roles is fine; granting one is admin-only.
-- is_admin() is safe to use here precisely because it is a BYPASSRLS
-- SECURITY DEFINER function (see the header).
create policy user_roles_select_self_or_admin on public.user_roles
  for select to authenticated
  using (user_id = public.current_user_id() or public.is_admin());

-- Privilege escalation guard: only an admin may INSERT, UPDATE or DELETE here.
-- Without this, any authenticated user could grant themselves 'admin'.
create policy user_roles_admin_insert on public.user_roles
  for insert to authenticated with check (public.is_admin());

create policy user_roles_admin_update on public.user_roles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_roles_admin_delete on public.user_roles
  for delete to authenticated using (public.is_admin());

-- customer_addresses: strictly own-rows.
create policy customer_addresses_own on public.customer_addresses
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- business_accounts: owner and admin only.
create policy business_accounts_owner_or_admin on public.business_accounts
  for select to authenticated
  using (owner_user_id = public.current_user_id() or public.is_admin());

create policy business_accounts_owner_update on public.business_accounts
  for update to authenticated
  using (owner_user_id = public.current_user_id() or public.is_admin())
  with check (owner_user_id = public.current_user_id() or public.is_admin());

create policy business_accounts_admin_write on public.business_accounts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- guest_access_tokens: NO client policy at all, by design.
-- A guest is not an authenticated principal and holds no database identity.
-- Their access is granted by the application AFTER verifying the raw token
-- against its stored hash, using the service role, and then returning a
-- deliberately narrow projection — never the booking row itself. Modelling
-- this in RLS would require putting the credential in the JWT, which is worse.

-- ----------------------------------------------------------------------------
-- 4. Public catalogue — the ONLY tables `anon` may read
-- ----------------------------------------------------------------------------
grant select on public.product_categories to anon;
grant select on public.products to anon;
grant select on public.product_images to anon;

-- Draft and soft-deleted products are staff working material. An unpublished
-- product must not be discoverable by enumerating slugs.
create policy product_categories_public_read on public.product_categories
  for select to anon, authenticated
  using (is_active);

create policy products_public_read on public.products
  for select to anon, authenticated
  using (is_published and is_active and deleted_at is null);

create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and p.is_published and p.is_active and p.deleted_at is null
    )
  );

-- Catalogue writes are operations/admin only. No customer or driver may publish.
create policy product_categories_ops_write on public.product_categories
  for all to authenticated
  using (public.is_dispatcher() or public.is_admin())
  with check (public.is_dispatcher() or public.is_admin());

create policy products_ops_write on public.products
  for all to authenticated
  using (public.is_dispatcher() or public.is_admin())
  with check (public.is_dispatcher() or public.is_admin());

create policy product_images_ops_write on public.product_images
  for all to authenticated
  using (public.is_dispatcher() or public.is_admin())
  with check (public.is_dispatcher() or public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Coverage and pricing configuration
-- ----------------------------------------------------------------------------
-- Coverage is public information ("do you deliver to my state?") so `anon` may
-- read active areas. route_rules carry MARGINS and per-kg rates, so those stay
-- with operations — the storefront must learn prices from the pricing engine,
-- never by scraping the rate card.
grant select on public.service_areas to anon;

create policy service_areas_public_read on public.service_areas
  for select to anon, authenticated using (is_active);

create policy service_areas_ops_write on public.service_areas
  for all to authenticated
  using (public.is_dispatcher() or public.is_admin())
  with check (public.is_dispatcher() or public.is_admin());

create policy route_rules_ops_read on public.route_rules
  for select to authenticated using (public.is_dispatcher() or public.is_admin());

create policy route_rules_admin_write on public.route_rules
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Logistics
-- ----------------------------------------------------------------------------
-- A GUEST booking has customer_user_id IS NULL. Under the policy below a guest
-- owns no database identity and therefore sees zero rows here — which is
-- exactly right. Guests reach their booking through a verified token via the
-- service path, never by querying the table.
create policy bookings_customer_own on public.bookings
  for select to authenticated
  using (customer_user_id = public.current_user_id());

create policy bookings_ops_read on public.bookings
  for select to authenticated using (public.is_staff() or public.is_dispatcher());

-- A customer may create a booking for themselves, but only in a state that
-- means "a request I just made" — never straight to 'confirmed', which is what
-- would let a client self-dispatch a parcel.
create policy bookings_customer_insert on public.bookings
  for insert to authenticated
  with check (
    customer_user_id = public.current_user_id()
    and status in ('draft', 'quote_requested', 'awaiting_payment')
  );

create policy bookings_ops_write on public.bookings
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

create policy booking_items_via_booking on public.booking_items
  for all to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_user_id = public.current_user_id()
             or public.is_staff() or public.is_dispatcher())
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_user_id = public.current_user_id()
             or public.is_staff() or public.is_dispatcher())
    )
  );

-- Customers may READ quotes raised on their booking. They may not UPDATE or
-- DELETE: acceptance is a server-side transition that must re-check expiry and
-- status in a transaction. A client that could write 'accepted' would be able to
-- mark a lapsed quote as agreed.
create policy quotes_customer_select on public.quotes
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.customer_user_id = public.current_user_id()
    )
  );

create policy quotes_ops_all on public.quotes
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

create policy quote_items_via_quote on public.quote_items
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes q
      join public.bookings b on b.id = q.booking_id
      where q.id = quote_id
        and (b.customer_user_id = public.current_user_id()
             or public.is_staff() or public.is_dispatcher())
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      join public.bookings b on b.id = q.booking_id
      where q.id = quote_id
        and (b.customer_user_id = public.current_user_id()
             or public.is_staff() or public.is_dispatcher())
    )
  );

-- shipments: customer sees own; driver sees ONLY currently-assigned jobs.
create policy shipments_customer_select on public.shipments
  for select to authenticated
  using (customer_user_id = public.current_user_id());

create policy shipments_driver_select on public.shipments
  for select to authenticated
  using (public.is_driver() and public.is_assigned_driver(id));

create policy shipments_ops_all on public.shipments
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- A driver may not insert or update shipment rows at all — status changes go
-- through the append-only shipment_events timeline, not by editing the row.

-- shipment_events:
--   * customers read only events on their own shipment;
--   * drivers read events on jobs assigned to them;
--   * drivers may APPEND only event types is_driver_event_type() allows —
--     status_change, location_update, delivery_attempt, proof_uploaded,
--     delay_note, handover. price_change, payment_update and admin_correction
--     are excluded, so a driver can never move money or rewrite history.
create policy shipment_events_customer_select on public.shipment_events
  for select to authenticated
  using (
    is_customer_visible
    and exists (
      select 1 from public.shipments s
      where s.id = shipment_id and s.customer_user_id = public.current_user_id()
    )
  );

create policy shipment_events_driver_select on public.shipment_events
  for select to authenticated
  using (public.is_driver() and public.is_assigned_driver(shipment_id));

create policy shipment_events_driver_insert on public.shipment_events
  for insert to authenticated
  with check (
    public.is_driver()
    and public.is_assigned_driver(shipment_id)
    and public.is_driver_event_type(event_type::text)
  );

create policy shipment_events_ops_all on public.shipment_events
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- The table is append-only by trigger (0004). No UPDATE/DELETE policy is
-- created for any role, so correction is a NEW row referencing the old one.

-- shipment_assignments:
-- NOTE: is_assigned_driver() is deliberately NOT used here — it reads this very
-- table, so using it in a policy on this table would be the 42P17 recursion.
-- driver_user_id is compared directly instead.
create policy shipment_assignments_driver_select on public.shipment_assignments
  for select to authenticated
  using (
    driver_user_id = public.current_user_id()
    or public.is_staff() or public.is_dispatcher()
  );

create policy shipment_assignments_ops_write on public.shipment_assignments
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- delivery_attempts
create policy delivery_attempts_driver_select on public.delivery_attempts
  for select to authenticated
  using (
    driver_user_id = public.current_user_id()
    or public.is_staff() or public.is_dispatcher()
  );

create policy delivery_attempts_driver_insert on public.delivery_attempts
  for insert to authenticated
  with check (
    driver_user_id = public.current_user_id()
    and public.is_assigned_driver(shipment_id)
  );

create policy delivery_attempts_ops_all on public.delivery_attempts
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- delivery_proofs — private evidence. Staff read; an assigned driver appends
-- for their own job. Never readable by a customer through the API: customers
-- see the event timeline, not the underlying file.
create policy delivery_proofs_ops_read on public.delivery_proofs
  for select to authenticated using (public.is_staff() or public.is_dispatcher());

create policy delivery_proofs_driver_insert on public.delivery_proofs
  for insert to authenticated
  with check (
    public.is_driver()
    and captured_by = public.current_user_id()
    and public.is_assigned_driver(shipment_id)
  );

create policy delivery_proofs_ops_write on public.delivery_proofs
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- ----------------------------------------------------------------------------
-- 7. Carts and product orders
-- ----------------------------------------------------------------------------
create policy carts_own on public.carts
  for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy carts_ops_read on public.carts
  for select to authenticated using (public.is_staff() or public.is_dispatcher());

-- A GUEST cart has user_id IS NULL and a session_key_hash instead. Like guest
-- bookings it is deliberately unreachable via RLS; the application reaches it
-- through the service role after verifying the hashed session cookie.

create policy cart_items_via_cart on public.cart_items
  for all to authenticated
  using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = public.current_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and c.user_id = public.current_user_id()
    )
  );

-- product_orders: a GUEST order has user_id IS NULL and is reached only through
-- the service path after token verification, so it appears as zero rows here.
create policy product_orders_customer_select on public.product_orders
  for select to authenticated
  using (user_id = public.current_user_id());

create policy product_orders_customer_insert on public.product_orders
  for insert to authenticated
  with check (
    user_id = public.current_user_id()
    and status = 'pending_payment'
  );

create policy product_orders_ops_all on public.product_orders
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

create policy product_order_items_via_order on public.product_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.product_orders o
      where o.id = product_order_id
        and (o.user_id = public.current_user_id()
             or public.is_staff() or public.is_dispatcher())
    )
  );

create policy product_order_items_ops_write on public.product_order_items
  for all to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- ----------------------------------------------------------------------------
-- 8. Payments, refunds, settings
-- ----------------------------------------------------------------------------
-- Payments carry no user_id: ownership is derived from the payable record.
-- The sub-selects read bookings and product_orders, never payments, so this
-- policy cannot recurse on itself.
create policy payments_customer_select on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.customer_user_id = public.current_user_id()
    )
    or exists (
      select 1 from public.product_orders o
      where o.id = product_order_id and o.user_id = public.current_user_id()
    )
  );

create policy payments_ops_read on public.payments
  for select to authenticated using (public.is_staff() or public.is_dispatcher());

-- Customers may start a payment for their own payable. The status is pinned to
-- 'pending' and the amount is pinned to the server-computed value: a browser
-- cannot submit its own amount, and cannot insert an already-succeeded payment.
create policy payments_customer_insert on public.payments
  for insert to authenticated
  with check (
    status = 'pending'
    and amount_minor = expected_amount_minor
    and (
      exists (
        select 1 from public.bookings b
        where b.id = booking_id and b.customer_user_id = public.current_user_id()
      )
      or exists (
        select 1 from public.product_orders o
        where o.id = product_order_id and o.user_id = public.current_user_id()
      )
    )
  );

-- No UPDATE policy for customers on payments. Promotion to 'succeeded' is a
-- server-side verification step; a client-writable payment status is a
-- pay-your-own-price vulnerability.
create policy payments_ops_update on public.payments
  for update to authenticated
  using (public.is_staff() or public.is_dispatcher())
  with check (public.is_staff() or public.is_dispatcher());

-- refunds: admin-only for writes. Customers may read refunds against their own
-- payments (a receipt page needs them), operations may read all.
create policy refunds_customer_select on public.refunds
  for select to authenticated
  using (
    exists (
      select 1 from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      where pay.id = payment_id and b.customer_user_id = public.current_user_id()
    )
    or exists (
      select 1 from public.payments pay
      join public.product_orders o on o.id = pay.product_order_id
      where pay.id = payment_id and o.user_id = public.current_user_id()
    )
  );

create policy refunds_ops_read on public.refunds
  for select to authenticated using (public.is_staff() or public.is_dispatcher());

create policy refunds_admin_write on public.refunds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- system_settings: readable by any signed-in user so the app can apply business
-- policy client-side, but secret values are masked by the service layer, and
-- only an admin may change them.
create policy system_settings_read on public.system_settings
  for select to authenticated using (true);

create policy system_settings_admin_write on public.system_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. Privileges the RLS helper functions need
-- ----------------------------------------------------------------------------
-- THE BUG THIS FIXES (found by running the suite, not by reading it):
-- SECURITY DEFINER is not a free pass to the data. The function executes as its
-- OWNER, and the owner still needs ordinary table-level GRANTs. `veencart_authz`
-- owns has_role()/is_dispatcher()/is_assigned_driver(), but nothing ever gave
-- it SELECT on the tables those functions read — so every role-based policy
-- failed with:
--     ERROR: permission denied for table user_roles   (SQLSTATE 42501)
-- BYPASSRLS defeats row-level POLICIES; it does nothing about table
-- privileges. Both are required, and they are independent.
--
-- Granted to exactly the two tables the helpers actually read. Least privilege:
-- this role is NOLOGIN and exists only to own the definer functions, so it must
-- not gain blanket access to customer PII it has no reason to touch.
--
-- MAINTENANCE RULE: if you add a helper function that reads another table, add a
-- grant for that table here in the same change, or the policy using it will
-- fail at runtime — not at migration time, which is what makes this so easy to
-- ship broken.
grant usage on schema public to veencart_authz;
grant select on public.user_roles            to veencart_authz;
grant select on public.shipment_assignments  to veencart_authz;

-- ----------------------------------------------------------------------------
-- 10. Helper privileges for the new trigger functions created in 0005/0006
-- ----------------------------------------------------------------------------
revoke all on function public.enforce_category_depth() from public;
grant execute on function public.enforce_category_depth() to service_role, veencart_service;

revoke all on function public.enforce_refund_within_refundable() from public;
grant execute on function public.enforce_refund_within_refundable() to service_role, veencart_service;

-- ----------------------------------------------------------------------------
-- 11. What is deliberately NOT covered by RLS
-- ----------------------------------------------------------------------------
-- The following have NO policy for anon or authenticated, so RLS denies them by
-- default and the lack of a GRANT makes that denial unconditional:
--
--   guest_access_tokens  – holds SHA-256 hashes of access credentials.
--   payment_events       – raw provider payloads, signature verdicts.
--   notification_outbox  – every pending email, with recipient addresses.
--   idempotency_keys     – replay surface.
--   audit_logs           – privileged-action history, read by admins only.
--   inventory            – live stock counts (competitive + scrape signal).
--   inventory_movements  – stock ledger.
--
-- These are reached only through the service role or veencart_service. Reminder,
-- carried over from 0001: BOTH bypass RLS by design, so the application MUST
-- re-derive the current actor and re-check permission itself on every code path
-- that uses them. RLS protects you from a compromised client; it protects you
-- from nothing on the service path. That check is the application's job.
-- ============================================================================
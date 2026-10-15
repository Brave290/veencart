-- ============================================================================
-- Veencart Logistics — seed.sql
-- ----------------------------------------------------------------------------
-- ⚠️  FICTIONAL DEMO DATA — NOT REAL BUSINESS DATA  ⚠️
--
-- Every person, phone number, address and product below is invented for
-- development and testing. There are no real Nigerian customers, drivers or
-- companies in this file. Do NOT copy any of it into production, marketing
-- copy, or client communication.
--
-- The identities are FIXED uuids so RLS tests can assert on exact rows without
-- hunting for generated ids.
--
-- Runs as the migration owner, which bypasses RLS by design — that is what
-- lets seed populate rows no authenticated user may create.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
-- Password: the `password_hash` column is NOT set here. Supabase Auth owns
-- credentials; these rows are linked by id = auth.users.id once a user signs
-- up or is invited. Seeding a password hash would mean storing credentials in
-- this repository, which is exactly what must never happen.
insert into public.profiles (id, email, phone, full_name, default_currency, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'admin@veencart.test',     '+2348000000001', 'Aisha Admin (demo)',      'NGN', true),
  ('00000000-0000-0000-0000-000000000002', 'staff@veencart.test',     '+2348000000002', 'Bello Staff (demo)',       'NGN', true),
  ('00000000-0000-0000-0000-000000000003', 'dispatch@veencart.test',  '+2348000000003', 'Chidi Dispatch (demo)',    'NGN', true),
  ('00000000-0000-0000-0000-000000000004', 'driver@veencart.test',    '+2348000000004', 'Dele Driver (demo)',       'NGN', true),
  ('00000000-0000-0000-0000-000000000005', 'driver2@veencart.test',   '+2348000000005', 'Efe Driver Two (demo)',    'NGN', true),
  ('00000000-0000-0000-0000-00000000000a', 'customer.a@veencart.test','+2348000000010', 'Fatima Customer A (demo)', 'NGN', true),
  ('00000000-0000-0000-0000-00000000000b', 'customer.b@veencart.test','+2348000000011', 'Grace Customer B (demo)',  'NGN', true);

-- ----------------------------------------------------------------------------
-- Roles — one user may hold several
-- ----------------------------------------------------------------------------
insert into public.user_roles (user_id, role, granted_by) values
  ('00000000-0000-0000-0000-000000000001', 'admin',      '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002', 'staff',      '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'dispatcher', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'driver',     '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'driver',     '00000000-0000-0000-0000-000000000001');

-- Customers are deliberately NOT granted a row in user_roles. A registered
-- customer with no role row is an ordinary principal; admin is the role that
-- confers operational power, and granting it by default would make every
-- signup an admin.

-- ----------------------------------------------------------------------------
-- Service coverage (fictional, illustrative — NOT a real rate card)
-- ----------------------------------------------------------------------------
insert into public.service_areas
  (id, name, state, lga, localities, service_types, base_fee_minor, per_kg_minor, currency, min_charge_minor, cutoff_local_time, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'Demo Lagos Island', 'Lagos', 'Lagos Island', array['Lagos Island','Victoria Island'], array['same_day','next_day','standard']::public.service_type[], 150000, 25000, 'NGN', 150000, '16:00', true),
  ('10000000-0000-0000-0000-000000000002', 'Demo Ibadan North','Oyo',   'Ibadan North', array['Ibadan North','Bodija'],        array['next_day','standard','economy']::public.service_type[], 300000, 40000, 'NGN', 300000, '15:00', true),
  ('10000000-0000-0000-0000-000000000003', 'Demo Abuja Central','FCT',  'Municipal',    array['Municipal','Wuse'],            array['next_day','express']::public.service_type[],          400000, 55000, 'NGN', 400000, '14:00', true),
  -- Inactive: proves anon can only ever see active coverage.
  ('10000000-0000-0000-0000-000000000004', 'Demo Retired Area', 'Kwara','Offa',        array['Offa'],                            array['standard']::public.service_type[],                  200000, 30000, 'NGN', 200000, '16:00', false);

insert into public.route_rules
  (id, origin_area_id, destination_area_id, service_type, flat_fee_minor, per_kg_minor, free_threshold_kg, surcharge_minor, max_weight_kg, transit_days_min, transit_days_max, is_excluded, is_active, currency, valid_from, valid_to) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'next_day', 250000, 40000, 1.000, 0, 50.000, 1, 2, false, true, 'NGN', now() - interval '30 days', now() + interval '365 days'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'express',  500000, 60000, 0.500, 0, 30.000, 1, 1, false, true, 'NGN', now() - interval '30 days', now() + interval '365 days'),
  -- Excluded route: must route to a MANUAL QUOTE, never to a fabricated price.
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'economy', 0, 0, 0, 0, 0.001, 0, 0, true,  true, 'NGN', now() - interval '30 days', now() + interval '365 days');

-- ----------------------------------------------------------------------------
-- Catalogue
-- ----------------------------------------------------------------------------
insert into public.product_categories (id, name, slug, sort_order) values
  ('30000000-0000-0000-0000-000000000001', 'Home & Living (demo)', 'home-living', 1),
  ('30000000-0000-0000-0000-000000000002', 'Electronics (demo)',   'electronics', 2),
  ('30000000-0000-0000-0000-000000000003', 'Unpublished (demo)',   'hidden-demo', 99);

insert into public.products (id, sku, slug, category_id, title, short_description, price_minor, currency, is_published, is_active) values
  ('40000000-0000-0000-0000-000000000001', 'VC-DEMO-0001', 'demo-kettle',    '30000000-0000-0000-0000-000000000001', 'Demo Electric Kettle',    'Fictional sample product', 2500000, 'NGN', true,  true),
  ('40000000-0000-0000-0000-000000000002', 'VC-DEMO-0002', 'demo-lantern',   '30000000-0000-0000-0000-000000000002', 'Demo Solar Lantern',      'Fictional sample product', 4750000, 'NGN', true,  true),
  -- Unpublished draft: anon must NOT be able to discover this by slug.
  ('40000000-0000-0000-0000-000000000003', 'VC-DEMO-0003', 'demo-secret-draft', '30000000-0000-0000-0000-000000000003', 'Demo Unpublished Item', 'Draft, must stay hidden', 100000, 'NGN', false, true);

insert into public.inventory (product_id, available_quantity, reserved_quantity, reorder_level) values
  ('40000000-0000-0000-0000-000000000001', 10, 0, 2),
  ('40000000-0000-0000-0000-000000000002',  1, 0, 2),  -- deliberately scarce: oversell tests
  ('40000000-0000-0000-0000-000000000003',  5, 0, 0);

-- ----------------------------------------------------------------------------
-- Bookings and shipments
-- ----------------------------------------------------------------------------
insert into public.bookings
  (id, booking_reference, customer_user_id, service_type, status,
   sender_name, sender_phone, sender_email, sender_street, sender_locality, sender_city, sender_state, sender_country,
   recipient_name, recipient_phone, recipient_email, recipient_street, recipient_locality, recipient_city, recipient_state, recipient_country,
   item_count, total_weight_kg, declared_value_minor, declared_currency, contents_description) values
  ('50000000-0000-0000-0000-000000000001', 'VCB-DEMO-0001', '00000000-0000-0000-0000-00000000000a', 'next_day', 'confirmed',
   'Fatima Customer A', '+2348000000010', 'customer.a@veencart.test', '12 Demo Street', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   'Ibrahim Recipient', '+2348000000099', 'recipient@demo.test', '45 Demo Road', 'Ibadan North', 'Ibadan', 'Oyo', 'NG',
   2, 3.500, 1500000, 'NGN', 'Fictional demo parcel'),
  -- Customer B's booking: used to prove A cannot read it.
  ('50000000-0000-0000-0000-000000000002', 'VCB-DEMO-0002', '00000000-0000-0000-0000-00000000000b', 'same_day', 'awaiting_payment',
   'Grace Customer B', '+2348000000011', 'customer.b@veencart.test', '7 Demo Close', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   'Kemi Recipient', '+2348000000088', 'recipient2@demo.test', '9 Demo Avenue', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   1, 1.000, 500000, 'NGN', 'Fictional demo parcel');

insert into public.booking_items (booking_id, description, quantity, weight_kg) values
  ('50000000-0000-0000-0000-000000000001', 'Demo carton of books', 2, 3.500);

insert into public.quotes
  (id, booking_id, quote_reference, status, service_type, subtotal_minor, discount_minor, surcharge_minor, vat_minor, total_minor, currency, valid_until, created_by, accepted_at, accepted_by) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'VCQ-DEMO-0001', 'accepted', 'next_day', 350000, 0, 0, 0, 350000, 'NGN', now() + interval '7 days', '00000000-0000-0000-0000-000000000002', now() - interval '2 hours', '00000000-0000-0000-0000-00000000000a'),
  -- Booking B has an ACCEPTED QUOTE at 200000. This is required, not decorative:
  -- the payments.derive_payment_amount trigger refuses to create a payment with
  -- no confirmed amount behind it, so a payment row cannot exist without a
  -- quote to justify it. That invariant is the point.
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'VCQ-DEMO-0002', 'accepted', 'same_day', 200000, 0, 0, 0, 200000, 'NGN', now() + interval '7 days', '00000000-0000-0000-0000-000000000002', now() - interval '1 hour', '00000000-0000-0000-0000-00000000000b');

insert into public.quote_items (quote_id, label, description, quantity, unit_amount_minor, amount_minor, currency, sort_order) values
  ('60000000-0000-0000-0000-000000000001', 'Base charge',   'Fictional base fee',      1, 250000, 250000, 'NGN', 1),
  ('60000000-0000-0000-0000-000000000001', 'Weight charge', 'Fictional per-kg charge', 3.5, 28571, 100000, 'NGN', 2);

insert into public.shipments
  (id, shipment_reference, tracking_reference, booking_id, quote_id, status, service_type, customer_user_id,
   sender_name, sender_phone, sender_street, sender_locality, sender_city, sender_state, sender_country,
   recipient_name, recipient_phone, recipient_email, recipient_street, recipient_locality, recipient_city, recipient_state, recipient_country,
   weight_kg, volume_m3, amount_charged_minor, currency, origin_area_id, destination_area_id, estimated_delivery_at) values
  -- Assigned to driver 1 — the job driver@veencart.test may see.
  ('70000000-0000-0000-0000-000000000001', 'VCS-DEMO-0001', 'VCTR-DEMO-0001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   'confirmed', 'next_day', '00000000-0000-0000-0000-00000000000a',
   'Fatima Customer A', '+2348000000010', '12 Demo Street', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   'Ibrahim Recipient', '+2348000000099', 'recipient@demo.test', '45 Demo Road', 'Ibadan North', 'Ibadan', 'Oyo', 'NG',
   3.500, 0.020, 350000, 'NGN', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', now() + interval '2 days'),
  -- Assigned to driver 2 — the job driver@veencart.test must NOT see.
  ('70000000-0000-0000-0000-000000000002', 'VCS-DEMO-0002', 'VCTR-DEMO-0002', '50000000-0000-0000-0000-000000000002', null,
   'confirmed', 'same_day', '00000000-0000-0000-0000-00000000000b',
   'Grace Customer B', '+2348000000011', '7 Demo Close', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   'Kemi Recipient', '+2348000000088', 'recipient2@demo.test', '9 Demo Avenue', 'Lagos Island', 'Lagos Island', 'Lagos', 'NG',
   1.000, 0.010, 200000, 'NGN', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() + interval '1 day');

insert into public.shipment_assignments (id, shipment_id, driver_user_id, assigned_by, scheduled_start, scheduled_end) values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', now(), now() + interval '4 hours'),
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', now(), now() + interval '4 hours');

-- `previous_status` is NOT NULL for status_change rows: every transition records
-- where it came FROM. A timeline that cannot show the prior state cannot be
-- audited. The first event therefore starts from 'requested', not from NULL.
insert into public.shipment_events
  (id, shipment_id, booking_id, sequence_no, event_type, previous_status, new_status, actor_user_id, actor_role, occurred_at, public_message, internal_note, is_customer_visible) values
  ('90000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1, 'status_change', 'requested', 'confirmed', '00000000-0000-0000-0000-000000000003', 'dispatcher', now() - interval '1 hour', 'Your shipment has been confirmed.', 'Demo timeline entry.', true),
  -- NOT customer visible: internal note only.
  ('90000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 2, 'delay_note', 'confirmed', 'confirmed', '00000000-0000-0000-0000-000000000002', 'staff', now() - interval '30 minutes', null, 'Demo internal note about vehicle availability.', false),
  ('90000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 1, 'status_change', 'requested', 'confirmed', '00000000-0000-0000-0000-000000000003', 'dispatcher', now() - interval '1 hour', 'Your shipment has been confirmed.', 'Demo timeline entry.', true);

-- ----------------------------------------------------------------------------
-- Payments
-- ----------------------------------------------------------------------------
insert into public.payments
  (id, reference, payable_kind, booking_id, amount_minor, currency, status, provider, payer_role, payer_name, payer_email, payer_phone, provider_reference, paid_at, verified_at, expected_amount_minor, expected_currency, refundable_amount_minor) values
  ('a0000000-0000-0000-0000-000000000001', 'VCP-DEMO-0001', 'booking', '50000000-0000-0000-0000-000000000001', 350000, 'NGN', 'succeeded', 'paystack', 'sender', 'Fatima Customer A', 'customer.a@veencart.test', '+2348000000010', 'DEMO_TXN_0001', now() - interval '2 hours', now() - interval '2 hours', 350000, 'NGN', 350000),
  -- Pending: proves "succeeded" is never granted without verification.
  ('a0000000-0000-0000-0000-000000000002', 'VCP-DEMO-0002', 'booking', '50000000-0000-0000-0000-000000000002', 200000, 'NGN', 'pending',  'paystack', 'sender', 'Grace Customer B', 'customer.b@veencart.test', '+2348000000010', null, null, null, 200000, 'NGN', null);

insert into public.payment_events (id, provider, provider_event_id, event_type, payment_id, provider_reference, payload, processing_status, processed_at) values
  ('b0000000-0000-0000-0000-000000000001', 'paystack', 'DEMO_EVENT_0001', 'charge.success', 'a0000000-0000-0000-0000-000000000001', 'DEMO_TXN_0001', '{"demo": true}'::jsonb, 'processed', now() - interval '2 hours');

-- ----------------------------------------------------------------------------
-- Product orders
-- ----------------------------------------------------------------------------
insert into public.product_orders
  (id, order_reference, user_id, customer_name, customer_phone, customer_email,
   delivery_name, delivery_phone, delivery_street, delivery_city, delivery_state, delivery_country,
   subtotal_minor, shipping_minor, discount_minor, total_minor, currency, status, placed_at) values
  ('c0000000-0000-0000-0000-000000000001', 'VCO-DEMO-0001', '00000000-0000-0000-0000-00000000000a',
   'Fatima Customer A', '+2348000000010', 'customer.a@veencart.test',
   'Fatima Customer A', '+2348000000010', '12 Demo Street', 'Lagos Island', 'Lagos', 'NG',
   2500000, 200000, 0, 2700000, 'NGN', 'paid', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000002', 'VCO-DEMO-0002', '00000000-0000-0000-0000-00000000000b',
   'Grace Customer B', '+2348000000011', 'customer.b@veencart.test',
   'Grace Customer B', '+2348000000011', '7 Demo Close', 'Lagos Island', 'Lagos', 'NG',
   4750000, 0, 0, 4750000, 'NGN', 'pending_payment', now());

insert into public.product_order_items (product_order_id, product_id, sku, product_name, unit_price_minor, quantity, line_total_minor, currency) values
  -- Snapshot: proves later catalogue edits cannot rewrite history.
  ('c0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'VC-DEMO-0001', 'Demo Electric Kettle (name at purchase)', 2500000, 1, 2500000, 'NGN');

-- ----------------------------------------------------------------------------
-- Guest access token — store the HASH only
-- ----------------------------------------------------------------------------
-- The raw token is never persisted. In the app this is sha256(random 32 bytes),
-- hex-encoded. The value below is sha256('demo-raw-token-do-not-use').
insert into public.guest_access_tokens
  (id, token_hash, purpose, booking_id, expires_at) values
  ('d0000000-0000-0000-0000-000000000001',
   '3137c5fbe8bf476d6461d89e9c8ce7219997cf55031e53485dad3859a8d045b5',
   'guest_booking', '50000000-0000-0000-0000-000000000001', now() + interval '7 days');

-- ----------------------------------------------------------------------------
-- Configurable business policy
-- ----------------------------------------------------------------------------
-- `is_confirmed = false` marks these as ENGINEERING DEFAULTS awaiting client
-- sign-off, not agreed business facts. Anything the business has not confirmed
-- must be surfaced as configurable in the UI rather than presented to customers
-- as fact.
-- `value` is jsonb, so every entry must be valid JSON. A bare 'photo' is NOT
-- valid JSON and the insert is rejected — non-numeric/non-boolean strings must
-- be JSON strings, hence '"photo"'. `value_type` documents the intended shape
-- for the application to read back.
insert into public.system_settings (key, value, value_type, description, is_confirmed) values
  ('payment.require_before_dispatch', 'true',  'boolean', 'Default: verified payment is required before a shipment may be dispatched.', false),
  ('payment.recipient_can_pay',       'true',  'boolean', 'Default: a secure, expiring payment link may be sent to the recipient.',      false),
  ('booking.reservation_expiry_hours','24',    'number',  'Default: how long an unpaid checkout holds stock before it is released.',      false),
  ('delivery.proof_required',         '"photo"', 'string', 'Default proof type. Proof requirements remain configurable per service.',   false),
  ('tracking.public_fields', '["status","occurred_at","public_message","location_name"]', 'json',
   'The only shipment fields a public tracking page may ever return.', false);
-- ============================================================================
-- Veencart Logistics — 0008_booking_coverage.sql
-- ----------------------------------------------------------------------------
-- FOUND BY A TEST, NOT BY READING: the booking write path resolved a route to a
-- service area and then had nowhere to put the answer, so `insert into bookings`
-- failed on `origin_area_id`.
--
-- WHY THE RESOLUTION MUST BE PERSISTED RATHER THAN RE-DERIVED
-- Three reasons, in order of how much they matter:
--
--  1. AUDITABILITY. A booking lands in `quote_requested` when there is no
--     tariff. Staff need to know WHY: nobody configured that route, or the
--     route was actively excluded, or the parcel was too heavy. Those are three
--     different conversations with the customer. Without the resolution stored,
--     the only way to find out is to re-run a query whose answers may have
--     changed since the customer booked.
--
--  2. PRICE STABILITY. A customer booked because a tariff existed at 09:00. If
--     somebody retires that tariff at 11:00, a re-resolution would send the
--     booking down a different path than the one the customer was shown. The
--     area captured at booking time is the one the booking was made against.
--
--  3. DISPATCH. Assignment and route warnings need the areas directly, not a
--     second resolution pass that could disagree with the first.
--
-- Both are nullable. A NULL area pair is meaningful, not incomplete: it records
-- "we could not resolve this to any active coverage area", which is precisely
-- the quote_requested case. Inventing a placeholder area to avoid NULLs would
-- destroy the distinction.
-- ============================================================================

alter table public.bookings
  add column if not exists origin_area_id      uuid references public.service_areas (id) on delete set null,
  add column if not exists destination_area_id uuid references public.service_areas (id) on delete set null;

-- Dispatch and pricing both read "covered bookings for this route", so this is
-- a lookup index rather than a decoration.
create index if not exists bookings_origin_destination_idx
  on public.bookings (origin_area_id, destination_area_id)
  where origin_area_id is not null and destination_area_id is not null;

-- The quote-request queue: unpriced bookings, oldest first, so the queue has a
-- stable order that does not shuffle every time two bookings arrive together.
create index if not exists bookings_quote_queue_idx
  on public.bookings (created_at)
  where status = 'quote_requested' and deleted_at is null;

-- Recipient-paid bookings need the recipient to be able to retrieve their own
-- payment link later without an account. Distinct from the guest_booking lookup
-- because it is keyed on the recipient's phone, not on a token.
create index if not exists bookings_recipient_lookup_idx
  on public.bookings (recipient_phone, created_at desc)
  where recipient_phone is not null;

comment on column public.bookings.origin_area_id is
  'Service area resolved for the pickup side at booking time. NULL means no active area matched and the booking is a quote request.';

comment on column public.bookings.destination_area_id is
  'Service area resolved for the delivery side at booking time. NULL means no active area matched and the booking is a quote request.';
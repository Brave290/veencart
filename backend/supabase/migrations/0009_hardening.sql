-- Veencart hardening — close application-boundary gaps before provider integration.
-- This migration is deliberately fail-closed: browser roles must not create
-- product orders, mutate payments, delete refunds, or read the internal rate card.

-- Product checkout is server-owned. The browser may read its own cart and start
-- a server-created payment, but it must not insert an order with a client-chosen
-- total or without immutable line-item snapshots.
drop policy if exists product_orders_customer_insert on public.product_orders;

-- Payment success is provider-verified only. Even an authenticated admin browser
-- session cannot forge provider_reference, paid_at, or status.
drop policy if exists payments_admin_update on public.payments;

-- The rate card contains margins and internal pricing. Public callers must use a
-- server-owned coverage/pricing projection rather than selecting the base/per-kg
-- tariff columns directly.
revoke all on public.service_areas from anon;

-- Public coverage projection: expose only route-discovery fields, never pricing
-- columns such as base_fee_minor, per_kg_minor, or min_charge_minor.
create or replace view public.service_area_coverage as
select id, name, state, lga, localities, service_types
  from public.service_areas
 where is_active;
grant select on public.service_area_coverage to anon, authenticated;

-- A capability token must point to exactly one resource, and its purpose must
-- match that resource. This prevents a future generic token lookup from turning
-- a tracking token into a booking or checkout capability.
alter table public.guest_access_tokens
  drop constraint if exists guest_access_tokens_target_xor_check;
alter table public.guest_access_tokens
  add constraint guest_access_tokens_target_xor_check check (
    (case when booking_id is not null then 1 else 0 end) +
    (case when shipment_id is not null then 1 else 0 end) +
    (case when order_id is not null then 1 else 0 end) = 1
    and (
      (purpose = 'guest_booking' and booking_id is not null)
      or (purpose = 'guest_tracking' and shipment_id is not null)
      or (purpose = 'guest_checkout' and order_id is not null)
    )
  );

-- Refunds may transition through their lifecycle, but their financial target and
-- amount are immutable. Deletion is never a valid correction because removing a
-- held/succeeded refund would reopen the refundable balance.
create or replace function public.protect_refund_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Refund rows are append-only; cancel the refund instead of deleting it.'
      using errcode = '45000';
  end if;

  if new.payment_id is distinct from old.payment_id
     or new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency
     or new.reference is distinct from old.reference then
    raise exception 'Refund identity, amount, currency, and payment cannot be changed.'
      using errcode = '45000';
  end if;

  return new;
end;
$$;

drop trigger if exists refunds_identity_guard on public.refunds;
create trigger refunds_identity_guard
  before update or delete on public.refunds
  for each row execute function public.protect_refund_identity();

-- The ceiling trigger must inspect the payment even when the caller is an admin
-- whose ordinary payment SELECT policy is intentionally narrow. The function
-- still receives only the values needed for the check and never returns rows.
alter function public.enforce_refund_within_refundable() security definer;

-- ============================================================================
-- Veencart Logistics — 0002_enums.sql
-- ----------------------------------------------------------------------------
-- All domain enums. Postgres enums (not CHECK constraints on text) because
-- these values are used in indexes, joins and API filters, and an enum gives a
-- compile-time vocabulary plus a small, dense storage type.
--
-- IDEMPOTENCY: `CREATE TYPE` has no IF NOT EXISTS, so each one is guarded by a
-- pg_type lookup inside a DO block.
--
-- GROWTH RULE: adding a value later needs `ALTER TYPE ... ADD VALUE`. On
-- PostgreSQL 12+ that is allowed inside a transaction, but the new value
-- cannot be *used* in the same transaction. Keep that in mind before shipping a
-- migration that inserts the new value.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- app_role — authorisation roles. Must match the strings used by has_role().
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum (
      'customer',
      'dispatcher',
      'driver',
      'staff',
      'admin'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- booking_status — lifecycle of a customer booking (the request, pre-quote).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status' and typnamespace = 'public'::regnamespace) then
    create type public.booking_status as enum (
      'draft',
      'quote_requested',
      'quoted',
      'quote_accepted',
      'awaiting_payment',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- quote_status — a quote is a priced offer attached to a booking.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_status' and typnamespace = 'public'::regnamespace) then
    create type public.quote_status as enum (
      'draft',
      'sent',
      'accepted',
      'rejected',
      'expired'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- shipment_status — EXACTLY these 16 values, in operational order.
-- Do not reorder or rename without a data migration: the ordinal is stored and
-- is relied on for progress reporting.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipment_status' and typnamespace = 'public'::regnamespace) then
    create type public.shipment_status as enum (
      'requested',
      'awaiting_quote',
      'quoted',
      'quote_accepted',
      'awaiting_payment',
      'confirmed',
      'pickup_scheduled',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'on_hold',
      'delivery_failed',
      'exception',
      'returned_to_sender'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- shipment_event_type — what happened, for the audit trail.
-- `price_change` / `payment_update` / `admin_correction` exist so that attempts
-- to post them as a driver are *representable* and therefore testable, not so
-- that drivers may write them. See public.is_driver_event_type().
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'shipment_event_type' and typnamespace = 'public'::regnamespace) then
    create type public.shipment_event_type as enum (
      'status_change',
      'location_update',
      'delivery_attempt',
      'proof_uploaded',
      'delay_note',
      'handover',
      'price_change',
      'payment_update',
      'admin_correction'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- payment_status
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status' and typnamespace = 'public'::regnamespace) then
    create type public.payment_status as enum (
      'pending',
      'processing',
      'succeeded',
      'failed',
      'cancelled',
      'partially_refunded',
      'refunded'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- payment_payer_role — who owes the money. Logistics is often receiver-pays,
-- which is why a single `customer_id` on the payment would be wrong.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_payer_role' and typnamespace = 'public'::regnamespace) then
    create type public.payment_payer_role as enum (
      'customer',
      'sender',
      'recipient',
      'business',
      'platform'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- refund_reason
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'refund_reason' and typnamespace = 'public'::regnamespace) then
    create type public.refund_reason as enum (
      'customer_request',
      'failed_delivery',
      'damaged_in_transit',
      'duplicate_payment',
      'fraud',
      'service_not_rendered',
      'goodwill',
      'other'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- product_order_status — ecommerce order lifecycle (separate from booking).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_order_status' and typnamespace = 'public'::regnamespace) then
    create type public.product_order_status as enum (
      'pending_payment',
      'paid',
      'processing',
      'dispatched',
      'delivered',
      'cancelled',
      'refunded'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- service_type — delivery speed bands sold to customers.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_type' and typnamespace = 'public'::regnamespace) then
    create type public.service_type as enum (
      'same_day',
      'next_day',
      'express',
      'standard',
      'economy',
      'freight'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- proof_type — evidence that a delivery happened.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'proof_type' and typnamespace = 'public'::regnamespace) then
    create type public.proof_type as enum (
      'photo',
      'signature',
      'otp',
      'contactless_delivery'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- guest_token_purpose — capability tokens for unauthenticated visitors.
-- Narrow purposes keep a token issued for "track my parcel" from being usable
-- to "place a booking".
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'guest_token_purpose' and typnamespace = 'public'::regnamespace) then
    create type public.guest_token_purpose as enum (
      'guest_booking',
      'guest_tracking',
      'guest_checkout'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- inventory_movement_type — the reason stock moved. The ledger is append-only.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type' and typnamespace = 'public'::regnamespace) then
    create type public.inventory_movement_type as enum (
      'restock',
      'sale',
      'reservation',
      'release',
      'return_to_stock',
      'adjustment',
      'shrinkage'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- notification_status / notification_channel
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_status' and typnamespace = 'public'::regnamespace) then
    create type public.notification_status as enum (
      'pending',
      'sent',
      'failed',
      'read'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel' and typnamespace = 'public'::regnamespace) then
    create type public.notification_channel as enum (
      'in_app',
      'email',
      'sms',
      'whatsapp',
      'push'
    );
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- audit_action — what kind of operation the audit row records.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'audit_action' and typnamespace = 'public'::regnamespace) then
    create type public.audit_action as enum (
      'create',
      'update',
      'delete',
      'status_change',
      'permission_grant',
      'permission_revoke',
      'login',
      'logout',
      'payment_capture',
      'refund_issue',
      'data_export',
      'admin_action'
    );
  end if;
end
$$;
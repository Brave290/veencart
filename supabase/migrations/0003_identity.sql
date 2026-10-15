-- ============================================================================
-- Veencart Logistics — 0003_identity.sql
-- ----------------------------------------------------------------------------
-- Identity: profiles, user_roles, customer_addresses, guest_access_tokens,
-- business_accounts.
--
-- Every FK created here is indexed (Postgres does NOT auto-index FKs, and an
-- unindexed FK turns every parent DELETE into a full scan of the child).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — public-facing details of an authenticated user.
-- `id` is the Supabase auth.users id (auth.uid()); we do not create that table,
-- we only reference it conceptually. Kept as a plain uuid PK so the schema also
-- works where auth lives elsewhere.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  email           citext,
  phone           text,
  full_name       text,
  avatar_url      text,
  -- enum default 'NGN'::char(3)
  default_currency char(3) not null default 'NGN',
  default_state   text,             -- Nigeria state of residence, e.g. 'Lagos'
  is_active       boolean not null default true,
  marketing_opt_in boolean not null default false,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,     -- soft delete; see data-deletion note below
  constraint profiles_currency_iso_check check (default_currency ~ '^[A-Z]{3}$')
);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (email)
  where email is not null;

create index if not exists profiles_phone_idx on public.profiles (phone);
create index if not exists profiles_active_idx on public.profiles (id) where is_active;
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- user_roles — the authorisation source of truth for RLS.
-- Deliberately separate from profiles so that reading your own profile can never
-- grant you anything.
--
-- RECURSION NOTE: the policies on THIS table call public.is_admin(), which
-- reads this very table through a SECURITY DEFINER function owned by a BYPASSRLS
-- role. That indirection is what stops SQLSTATE 42P17. Never replace those calls
-- with a direct `exists (select 1 from user_roles ...)` — you will take the whole
-- application down.
--
-- Only admins may write here, so a staff member cannot promote themselves.
-- ----------------------------------------------------------------------------
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  role        public.app_role not null,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  revoked_by  uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint user_roles_user_id_nonnull check (user_id is not null)
);

-- One live grant per (user, role). Re-granting after revocation is allowed
-- because the partial predicate excludes revoked rows.
create unique index if not exists user_roles_user_role_active_idx
  on public.user_roles (user_id, role)
  where revoked_at is null;

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_active_idx on public.user_roles (role) where revoked_at is null;
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);

drop trigger if exists user_roles_touch_updated_at on public.user_roles;
create trigger user_roles_touch_updated_at
  before update on public.user_roles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- customer_addresses — reusable addresses.
-- STRUCTURED COLUMNS, NOT JSON. Addresses get filtered by state and locality,
-- indexed, and validated per-field; burying them in jsonb makes that painful
-- and error-prone. `jsonb` is reserved for genuinely unstructured extras.
--
-- `label` lets a customer keep "Home" / "Office" / "Mum's place".
-- `is_default` is enforced as at-most-one-default per user by the partial
-- unique index below (NULL is not "equal", so no-default rows coexist fine).
-- ----------------------------------------------------------------------------
create table if not exists public.customer_addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  label          text,
  contact_name   text not null,
  phone          text not null,
  email          citext,
  street         text not null,
  street_detail  text,             -- flat, shop, landmark
  locality       text,             -- e.g. 'Ikeja', 'Wuse II'
  city           text not null,
  state          text not null,    -- Nigeria state, e.g. 'Lagos'
  lga            text,             -- Local Government Area
  postal_code    text,
  country        char(2) not null default 'NG',
  latitude       numeric(9, 6),    -- numeric, not float: this is a coordinate,
  longitude      numeric(9, 6),    -- not money, but float rounding bites here too
  is_default     boolean not null default false,
  delivery_notes text,
  extras         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint customer_addresses_country_check check (country ~ '^[A-Z]{2}$'),
  constraint customer_addresses_lat_check check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint customer_addresses_lng_check check (longitude is null or (longitude >= -180 and longitude <= 180))
);

create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (user_id)
  where is_default and deleted_at is null;

create index if not exists customer_addresses_user_id_idx on public.customer_addresses (user_id);
create index if not exists customer_addresses_state_idx on public.customer_addresses (state);
create index if not exists customer_addresses_user_active_idx
  on public.customer_addresses (user_id)
  where deleted_at is null;

drop trigger if exists customer_addresses_touch_updated_at on public.customer_addresses;
create trigger customer_addresses_touch_updated_at
  before update on public.customer_addresses
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- business_accounts — company customers with their own contact and RC number.
-- `owner_user_id` is the login; contacts may be separate people.
-- ----------------------------------------------------------------------------
create table if not exists public.business_accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null,
  business_name   text not null,
  rc_number       text,             -- Nigeria Corporate Affairs Commission number
  tin             text,             -- Nigeria Tax Identification Number
  contact_email   citext,
  contact_phone   text,
  billing_email   citext,
  billing_address jsonb not null default '{}'::jsonb,  -- billing is display-only
  credit_limit_minor bigint not null default 0,
  credit_currency char(3) not null default 'NGN',
  payment_terms_days integer not null default 0,
  is_verified     boolean not null default false,
  verified_at     timestamptz,
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint business_accounts_credit_nonneg_check check (credit_limit_minor >= 0),
  constraint business_accounts_currency_iso_check check (credit_currency ~ '^[A-Z]{3}$'),
  constraint business_accounts_terms_check check (payment_terms_days >= 0),
  constraint business_accounts_status_check check (status in ('active', 'suspended', 'pending'))
);

create index if not exists business_accounts_owner_idx on public.business_accounts (owner_user_id);
create index if not exists business_accounts_status_idx on public.business_accounts (status);
create index if not exists business_accounts_name_idx on public.business_accounts (lower(business_name));
create index if not exists business_accounts_owner_active_idx
  on public.business_accounts (owner_user_id)
  where deleted_at is null;

drop trigger if exists business_accounts_touch_updated_at on public.business_accounts;
create trigger business_accounts_touch_updated_at
  before update on public.business_accounts
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- guest_access_tokens — capability tokens for people with no account.
--
-- HASH, NEVER THE RAW TOKEN. The raw token is shown to the guest once and never
-- stored; only its sha256 hex digest lives here, so a database dump cannot be
-- replayed against the API. Lookup is by digest only.
--
-- Purpose is narrow on purpose: a `guest_tracking` token must not authorise a
-- booking. Expiry AND explicit revocation are both supported, and an expired or
-- revoked token must be rejected even if the hash still matches.
--
-- data-deletion note: revoking is the deletion story for a guest. The row keeps
-- the digest and timestamps for abuse investigation; it holds no message body
-- and no contact details.
-- ----------------------------------------------------------------------------
create table if not exists public.guest_access_tokens (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null,
  purpose       public.guest_token_purpose not null,
  booking_id    uuid,
  shipment_id   uuid,
  order_id      uuid,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  revoked_reason text,
  last_used_at  timestamptz,
  use_count     integer not null default 0,
  created_ip    inet,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint guest_access_tokens_hash_format_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint guest_access_tokens_use_count_check check (use_count >= 0),
  constraint guest_access_tokens_expiry_check check (expires_at > created_at)
);

create unique index if not exists guest_access_tokens_hash_idx on public.guest_access_tokens (token_hash);
create index if not exists guest_access_tokens_booking_idx on public.guest_access_tokens (booking_id);
create index if not exists guest_access_tokens_shipment_idx on public.guest_access_tokens (shipment_id);
create index if not exists guest_access_tokens_order_idx on public.guest_access_tokens (order_id);
create index if not exists guest_access_tokens_expires_idx on public.guest_access_tokens (expires_at);
create index if not exists guest_access_tokens_active_idx
  on public.guest_access_tokens (expires_at)
  where revoked_at is null;

drop trigger if exists guest_access_tokens_touch_updated_at on public.guest_access_tokens;
create trigger guest_access_tokens_touch_updated_at
  before update on public.guest_access_tokens
  for each row execute function public.touch_updated_at();
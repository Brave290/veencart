-- ============================================================================
-- Veencart Logistics — 0001_foundations.sql
-- ----------------------------------------------------------------------------
-- Extensions, auth stand-in, database roles, and the RLS helper functions that
-- every policy in this schema depends on.
--
-- CONVENTIONS ENFORCED THROUGHOUT VEENCART:
--   * ALL timestamps are `timestamptz` (UTC). UTC IS MANDATORY. Never `timestamp`.
--     Nigeria runs WAT (UTC+1); local business dates must be derived at query
--     time with AT TIME ZONE 'Africa/Lagos', never stored naive.
--   * ALL money is `amount_minor bigint` (integer minor units: kobo) plus an
--     explicit `currency char(3)`. NEVER float / numeric for money.
--   * Every table has a uuid primary key defaulting to `gen_random_uuid()`.
--
-- IDEMPOTENCY: safe to re-run. Objects use IF NOT EXISTS / guarded DO blocks /
-- DROP-then-CREATE.
--
-- SPLITTER SAFETY: plain SQL or `$$`-quoted bodies. No nested dollar-quoting
-- (some naive statement splitters break on it).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
-- pgcrypto   -> gen_random_uuid(), digest(), hmac()
-- citext     -> case-insensitive email/phone lookups without lower() indexes
-- btree_gist -> lets the exclusion constraint compare uuid/citext/text ranges
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- 2. `auth` stand-in
-- ----------------------------------------------------------------------------
-- In PRODUCTION on Supabase the `auth` schema and `auth.uid()` / `auth.jwt()`
-- already exist (owned by supabase_auth_admin). We create them ONLY when
-- missing, so this file is correct on Supabase AND in local PGlite/dev/test.
-- Guarded by to_regproc() so we never redefine Supabase's version.
create schema if not exists auth;

-- NESTED DOLLAR-QUOTING TRAP (this is why the block looks verbose):
-- The obvious spelling — execute 'create function ... as $fn$ ... $fn$' — is a
-- SYNTAX ERROR in PostgreSQL ("mismatched parentheses"). Inside a single-quoted
-- literal, '' is one literal quote, so the four-quote sequence needed to express
-- an empty string inside the nested body terminates the OUTER literal early.
-- Reproduced on PostgreSQL 18.6 before settling on the form below.
--
-- FIX: give every dollar-quoted region its OWN tag. $do$ (the block), $sql$
-- (the statement handed to EXECUTE) and $body$ (the function body). Distinct
-- tags cannot collide, so no quote escaping is required at all.
do $do$
begin
  if to_regproc('auth.uid()') is null then
    execute $sql$
      create function auth.uid() returns uuid language sql stable
      as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $body$
    $sql$;
  end if;

  if to_regproc('auth.jwt()') is null then
    execute $sql$
      create function auth.jwt() returns jsonb language sql stable
      as $body$
        select nullif(current_setting('request.jwt.claims', true), '')::jsonb
      $body$
    $sql$;
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
-- 3. Roles
-- ----------------------------------------------------------------------------
-- anon            Unauthenticated browser traffic. Default-deny everywhere
--                 except the public storefront/catalog tables.
-- authenticated   A signed-in user (customer, driver, dispatcher, staff, admin).
--                 RLS decides what they may see.
-- service_role    Supabase's trusted server path. Has BYPASSRLS *by design*.
--                 See SECURITY WARNING in section 8.
-- veencart_authz   NOLOGIN + BYPASSRLS. Owns the security-definer RLS helpers so
--                 they can read public.user_roles without tripping the policy
--                 recursion trap (SQLSTATE 42P17). See section 4.
-- veencart_service NOLOGIN. Veencart's own privileged server-side path (Next.js
--                 server actions / Edge Functions) connecting straight to
--                 Postgres instead of going through PostgREST.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- service_role already exists on Supabase WITH BYPASSRLS.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;

  -- Guarded: some managed providers refuse BYPASSRLS. If that happens the
  -- helpers keep their migration-runner owner (superuser on both Supabase and
  -- PGlite), which bypasses RLS too. Either way the helpers must be owned by a
  -- role that bypasses RLS -- see section 4.
  if not exists (select 1 from pg_roles where rolname = 'veencart_authz') then
    create role veencart_authz nologin bypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'veencart_service') then
    create role veencart_service nologin;
  end if;
end
$$;

-- Both app roles need to resolve objects in public.
grant usage on schema public to anon, authenticated, service_role, veencart_service;
grant usage on schema public to veencart_authz;

-- ----------------------------------------------------------------------------
-- 4. RLS helper functions  —  THE MOST IMPORTANT PART OF THIS FILE
-- ----------------------------------------------------------------------------
-- THE 42P17 RECURSION TRAP
-- --------------------------
-- If a policy on table T contains an expression that reads T, Postgres raises
--   ERROR: infinite recursion detected in policy for relation "t"  (SQLSTATE 42P17)
-- and the query FAILS FOR EVERY ROLE — not just the offending one. One such
-- policy takes the whole application down.
--
-- The classic way to hit it: a policy on public.user_roles that asks
-- "is this user an admin?" while public.is_admin() itself reads user_roles.
--
-- THE FIX (applied throughout this schema):
--   a) EVERY role lookup goes through a `security definer` function that reads
--      public.user_roles. Policies never touch user_roles directly.
--   b) Those functions are owned by a role that BYPASSES row security
--      (veencart_authz, or the migration-runner superuser as fallback), so the
--      inner SELECT is not re-filtered by user_roles' own policy. No re-entry,
--      therefore no recursion.
--   c) `set search_path = ''` on every definer function. With a fixed,
--      attacker-influenceable search_path a user could shadow a referenced
--      table/function and make a SECURITY DEFINER function run their code
--      (CVE-2018-1058 class). Empty search_path + fully-qualified names is the
--      documented fix. pg_catalog is always implicitly searched, so builtins
--      still resolve.
--
-- MAINTENANCE RULE: any new policy that needs "is the caller staff/driver/…"
-- MUST call one of these helpers. It must never SELECT from user_roles, and it
-- must never call a helper that reads the table the policy is attached to.
-- ----------------------------------------------------------------------------

-- CHECK_FUNCTION_BODIES (why this is switched off here and restored below):
-- With the default `check_function_bodies = on`, PostgreSQL parses and ANALYSES
-- every `language sql` function body at CREATE time and refuses to create it if
-- a referenced relation does not exist YET. The helpers below read
-- public.user_roles and public.shipment_assignments, which are defined in LATER
-- migrations -- so a correct forward reference fails on a first-principles
-- reading, and did (verified on PostgreSQL 18.6).
--
-- Three ways out, and why this one:
--   (a) Reorder so every table precedes every function -> collapses the modular
--       migration layout for no security benefit.
--   (b) Rewrite the helpers as plpgsql -> stops validation, but plpgsql is
--       slower on the hot path that RLS evaluates on every single query.
--   (c) Defer body validation for this section only. Chosen.
--
-- SAFE BECAUSE: body validation is a COMPILE-TIME convenience, not a permission
-- control. It grants no privilege and hides no error: a bad reference still
-- surfaces as a runtime failure the first time the function is called -- never
-- as silently-wrong authorization. Restored to `on` below so every later
-- migration keeps full checking.
set check_function_bodies = off;

-- JWT claim bundle, parsed safely. Returns NULL rather than erroring when the
-- claim is absent, empty or malformed -- a bad GUC must never 500 every query.
create or replace function public.jwt_claims()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_raw text;
begin
  v_raw := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
  if v_raw is null then
    return null;
  end if;
  return v_raw::jsonb;
exception
  when others then
    return null;
end;
$$;

-- The caller's user id, or NULL when anonymous.
-- Prefers the legacy single-claim GUC, then falls back to the claims bundle.
-- Validates the UUID *before* casting so a hostile/garbage GUC yields NULL
-- instead of raising `invalid input syntax for type uuid` mid-policy.
create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub text;
begin
  v_sub := nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '');

  if v_sub is null then
    v_sub := nullif(public.jwt_claims() ->> 'sub', '');
  end if;

  if v_sub is null
     or v_sub !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then
    return null;
  end if;

  return v_sub::uuid;
end;
$$;

-- All non-revoked role names held by the caller.
-- SECURITY DEFINER is mandatory: this reads user_roles, and user_roles' own
-- policies call into this function chain.
create or replace function public.current_role_names()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select ur.role::text
  from public.user_roles ur
  where ur.user_id = public.current_user_id()
    and ur.revoked_at is null;
$$;

-- Does the caller hold the named role?
create or replace function public.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = public.current_user_id()
      and ur.revoked_at is null
      and ur.role::text = p_role
  );
$$;

-- Convenience predicates used by policies. One per operational role so a policy
-- reads as a statement of intent: `using (public.is_dispatcher())`.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role('admin') $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_role('admin') or public.has_role('staff');
$$;

create or replace function public.is_dispatcher()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_role('admin')
      or public.has_role('staff')
      or public.has_role('dispatcher');
$$;

create or replace function public.is_driver()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.has_role('driver') $$;

-- Drivers AND dispatchers/staff/admin: anyone who may move a parcel.
create or replace function public.is_operations()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.has_role('admin')
      or public.has_role('staff')
      or public.has_role('dispatcher')
      or public.has_role('driver');
$$;

-- Is the caller assigned to this shipment right now?
-- Used by the `shipments` policy. It reads public.shipment_assignments, so it
-- MUST NOT be used by any policy on shipment_assignments (that would recurse);
-- that table's policies compare driver_user_id directly instead.
create or replace function public.is_assigned_driver(p_shipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shipment_assignments sa
    where sa.shipment_id = p_shipment_id
      and sa.driver_user_id = public.current_user_id()
      and sa.released_at is null
  );
$$;

-- Event types a driver is permitted to record. Deliberately hard-coded rather
-- than table-driven: a pure function cannot recurse, and the list must not be
-- editable by any user. Money-touching and state-authoritative events are
-- excluded — drivers never post price or payment changes.
create or replace function public.is_driver_event_type(p_type text)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'status_change',
    'location_update',
    'delivery_attempt',
    'proof_uploaded',
    'delay_note',
    'handover'
  );
$$;

-- End of the deferred-validation window. Every later migration gets full
-- statement-level checking again.
set check_function_bodies = on;

-- ----------------------------------------------------------------------------
-- 5. Generic triggers
-- ----------------------------------------------------------------------------

-- Maintains updated_at. Applied to every table that carries one.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Append-only enforcement. Corrections are NEW rows, never an UPDATE of history.
-- Raises SQLSTATE P0001 so callers can distinguish it from a driver error.
create or replace function public.deny_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Table %.% is append-only: % is not permitted.',
    tg_table_schema, tg_table_name, tg_op
    using
      errcode = 'P0001',
      hint = 'Record a corrective row (and reference the superseded id) instead of mutating history.';
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Ownership of the helper functions
-- ----------------------------------------------------------------------------
-- Hand the RLS helpers to veencart_authz (BYPASSRLS) so their exemption from
-- row security is an explicit property of this schema rather than an accident
-- of "the migration runner happens to be a superuser". If veencart_authz could
-- not be created, the functions simply keep their current owner and we log it.
do $$
declare
  v_has_authz boolean;
begin
  select exists (select 1 from pg_roles where rolname = 'veencart_authz' and rolbypassrls)
    into v_has_authz;

  if v_has_authz then
    execute 'alter function public.jwt_claims() owner to veencart_authz';
    execute 'alter function public.current_user_id() owner to veencart_authz';
    execute 'alter function public.current_role_names() owner to veencart_authz';
    execute 'alter function public.has_role(text) owner to veencart_authz';
    execute 'alter function public.is_admin() owner to veencart_authz';
    execute 'alter function public.is_staff() owner to veencart_authz';
    execute 'alter function public.is_dispatcher() owner to veencart_authz';
    execute 'alter function public.is_driver() owner to veencart_authz';
    execute 'alter function public.is_operations() owner to veencart_authz';
    execute 'alter function public.is_assigned_driver(uuid) owner to veencart_authz';
    execute 'alter function public.is_driver_event_type(text) owner to veencart_authz';
    -- The definer needs to read the tables its policies protect.
    execute 'grant usage on schema public to veencart_authz';
  else
    raise warning 'veencart_authz (BYPASSRLS) unavailable; RLS helpers retain the migration-runner owner.';
  end if;
end;
$$;

-- DEFAULT PRIVILEGE: functions are executable by PUBLIC on creation. Close
-- that down, then re-grant explicitly to the roles that need them.
revoke all on function public.jwt_claims() from public;
revoke all on function public.current_user_id() from public;
revoke all on function public.current_role_names() from public;
revoke all on function public.has_role(text) from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_dispatcher() from public;
revoke all on function public.is_driver() from public;
revoke all on function public.is_operations() from public;
revoke all on function public.is_assigned_driver(uuid) from public;
revoke all on function public.is_driver_event_type(text) from public;

grant execute on function public.jwt_claims() to authenticated, service_role, veencart_service;
grant execute on function public.current_user_id() to anon, authenticated, service_role, veencart_service;
grant execute on function public.current_role_names() to authenticated, service_role, veencart_service;
grant execute on function public.has_role(text) to authenticated, service_role, veencart_service;
grant execute on function public.is_admin() to authenticated, service_role, veencart_service;
grant execute on function public.is_staff() to authenticated, service_role, veencart_service;
grant execute on function public.is_dispatcher() to authenticated, service_role, veencart_service;
grant execute on function public.is_driver() to authenticated, service_role, veencart_service;
grant execute on function public.is_operations() to authenticated, service_role, veencart_service;
grant execute on function public.is_assigned_driver(uuid) to authenticated, service_role, veencart_service;
grant execute on function public.is_driver_event_type(text) to authenticated, service_role, veencart_service;

-- ----------------------------------------------------------------------------
-- 7. Default privileges
-- ----------------------------------------------------------------------------
-- Future tables created by this migration role are automatically covered by the
-- four grants every new table needs. This is what stops a later migration from
-- forgetting grants and silently producing "permission denied for table X".
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to veencart_service;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role, veencart_service;

-- ----------------------------------------------------------------------------
-- 8. SECURITY MODEL — read before trusting a connection string
-- ----------------------------------------------------------------------------
-- * anon / authenticated: fully sandboxed by RLS. They cannot bypass it.
-- * service_role: BYPASSRLS. It sees every row in every table, including
--   other customers' PII, guest tokens and payment records.
--   *** The application MUST validate actor permissions itself on every code
--   *** path that uses the service role. RLS gives you nothing there. A
--   *** service-role client pointed at user-supplied input is a full data
--   *** breach. Never expose a service-role key to the browser: it must live
--   *** in a server-only environment variable.
-- * veencart_service: same warning. It is NOLOGIN so nothing can connect as it
--   directly; Veencart's server runtime assumes the role after doing its own
--   authorization, which means that authorization is the security boundary.
--   Every server action must re-derive the actor and re-check permission
--   before writing.
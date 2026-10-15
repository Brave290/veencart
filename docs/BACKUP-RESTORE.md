# Backup and restore

> **A backup you have never restored is not a backup. It is a hope.**
>
> Every command in the "Restore" and "Prove it" sections below is written to be
> executed, not read. Run them on a schedule. An untested backup fails in exactly
> one situation — the one where you needed it — and it fails for boring reasons:
> a missing extension, a wrong connection port, a dump that captured zero rows, a
> restore that silently skipped the schema because of a permission error nobody
> was watching for.

---

## What actually needs backing up

| Asset | Mechanism | Restored by testing? |
| --- | --- | --- |
| **Postgres data** — bookings, shipments, payments, users | Supabase PITR (primary) + nightly logical dumps (off-site) | See [the drill](#the-restore-drill) |
| **R2 objects** — proof-of-delivery photos, customer documents | Cloudflare durability, **not** a backup | ❌ **No. Objects deleted at the bucket level are gone.** |
| **Environment secrets** — Paystack, Supabase, R2 keys | Password manager, **not** in the database | ❌ **No. A database dump contains none of these.** |
| **Vercel project config** — env vars, domains, settings | Vercel dashboard / CLI export | ❌ **No.** |

Two of those are routinely assumed to be covered and are not:

- **A `pg_dump` contains zero R2 objects.** A proof-of-delivery photo is evidence
  in a dispute. Losing the bucket loses the evidence, and no database backup
  brings it back. If that matters commercially, it needs its own copy —
  `wrangler r2 bucket` / S3 replication to a second account.
- **A `pg_dump` contains zero secrets.** `system_settings` holds business policy
  (`is_secret` rows are not credentials — the migration comments say so
  explicitly), but `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` live in
  the Vercel environment and the password manager. Restoring the database into a
  new environment does not restore the ability to take payments.

---

## Primary recovery: point-in-time recovery

Supabase Pro includes continuous WAL archiving, so the fastest recovery is
usually not a dump at all:

**Supabase dashboard → your project → Databases → Point-in-time Recovery.**

Pick a timestamp, restore to a new branch, and inspect before touching
production. This is the right tool for "we deleted the wrong customer at 14:20".

The backups below exist because PITR restores to a *new* database, costs quota,
and depends on a Supabase subscription being active and funded. A logical dump is
an independent copy you hold, that works during a Supabase outage, and that you
can load anywhere.

---

## Nightly logical dump

### Where and how

Run on a machine that is not the laptop of whoever is on call. A backup on the
same disk as the thing it protects is not a backup.

```bash
# Direct connection or the SESSION pooler (port 5432) — see the warning below.
export SOURCE_URL='postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres'

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="backups/veencart-${STAMP}.dump"

mkdir -p backups
pg_dump \
  --dbname="$SOURCE_URL" \
  --format=custom \
  --file="$OUT" \
  --schema=public \
  --no-owner \
  --no-privileges

ls -lh "$OUT"
```

`--format=custom` is binary and compressed, and `pg_restore` can restore it
selectively. Plain SQL would be larger and slower to load.

`--schema=public` is deliberate: it excludes Supabase's own internal schemas
(`auth`, `storage`, `realtime`, …), which Supabase manages and recreates. Pulling
those in causes conflicts on every restore.

### The pooler warning

> **`pg_dump` and `pg_restore` must not point at the transaction-mode pooler
> (port 5432 on the newer pooler hostname in some configurations, port 6543 on
> the others).** Transaction pooling recycles a backend connection between
> statements, which breaks `pg_dump` and `pg_restore` — they hold a session and
> a consistent snapshot across many statements, and prepared statements are
> invalidated underneath them. Symptoms vary: `server terminated unexpectedly`,
> `prepared statement "s1" does not exist`, or a dump that ends early.
>
> **Use the direct connection or the session-mode pooler.** If a dump works but
> a restore fails on the same URL, suspect this before anything else.
>
> Confirm which mode you are on in the Supabase dashboard → Database →
> Connection string.

### Verify the dump before trusting it

A zero-byte or truncated dump is the most common backup failure, and it is
invisible until you need it:

```bash
# Table list from inside the archive — works without a live database.
pg_restore --list "$OUT" | head -40
pg_restore --list "$OUT" | grep -c 'TABLE DATA'
```

Expect **32** tables (`public.*`) and a non-zero `TABLE DATA` count. If it is
zero, the dump captured no rows and is worthless.

```bash
# Record the checksum next to the file.
sha256sum "$OUT" > "$OUT.sha256"
```

### Retention

| Copies | Kept | Why |
| --- | --- | --- |
| Hourly, 7 days | 7 | Fast recovery from a bad afternoon |
| Daily, 30 days | 30 | Monthly rollback |
| Monthly, 12 months | 12 | Disputes and accounting |

Keep them **off-site** — a different provider or a different bucket. And keep
them **encrypted at rest**, because a dump contains names, phone numbers,
addresses, payment references and OTPs.

---

## The restore drill

**Run this quarterly. Put the date in the calendar now.**

The drill is the whole point. A backup whose restore path has never been
executed is a backup of unknown value.

### Step 1 — get a target

A throwaway database. Options, best first:

1. **A second Supabase project** — highest fidelity. The roles, `BYPASSRLS`
   ownership and `search_path` configuration that `0001_foundations.sql` depends
   on are Supabase-specific, and this is the only option that reproduces them.
2. **A local PostgreSQL** close to the Supabase version. You will have to create
   the roles yourself — see step 2.

> **This drill has not been run.** No production database exists yet, and no
> backup has been taken. Everything below is the procedure to follow when there
> is something to recover. Treat it as untested until you have run it once.

### Step 2 — create the roles

`0001_foundations.sql` creates application roles (`anon`, `authenticated`, and a
`BYPASSRLS` owner role) and the RLS helper functions are `SECURITY DEFINER` with
`set search_path = ''`, **owned by a role that bypasses RLS**. On a bare local
PostgreSQL those roles do not exist and the restore will fail partway with a
permission error that does not obviously mean "missing role".

On Supabase this is handled for you. On a local server, create the roles first —
or simply load the schema and accept that the RLS helper functions will need
re-owning afterwards.

This is precisely the kind of detail that makes an untested backup worthless.

### Step 3 — restore

```bash
export TARGET_URL='postgresql://postgres:<password>@<target-host>:5432/postgres'
export DUMP='backups/veencart-<stamp>.dump'

# --single-transaction: the entire restore is one transaction. Any error rolls
# the whole thing back, so you never end up with half a database that looks
# populated. (It implies serial restore — do not also pass --jobs.)
#
# --exit-on-error: stop at the first failure instead of ploughing on.
# --clean --if-exists: drop existing objects first, but only where they exist.
# --no-owner --no-privileges: don't try to recreate the source cluster's roles.
pg_restore \
  --dbname="$TARGET_URL" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --exit-on-error \
  --single-transaction \
  "$DUMP"
```

If it fails, read the **first** error. With `--single-transaction` everything
rolls back, so a partial restore is not a state you can be left in — but the
first error is the one that matters and the rest are usually consequences.

### Step 4 — prove it

A restore that "completes" is not a restore that works. Check that the data is
there **and** that the security model came with it:

```sql
-- 32 tables.
select count(*) from pg_tables where schemaname = 'public';

-- RLS enabled AND forced on every table. Both numbers must be 32. If FORCE is
-- missing, the table owner bypasses its own policies — which is the access
-- control model silently switched off.
-- The columns are on pg_class as relrowsecurity / relforcerowsecurity; the
-- pg_tables view only exposes the first of the two.
select count(*) filter (where c.relrowsecurity)        as rls_enabled,
       count(*) filter (where c.relforcerowsecurity)  as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- 62 policies.
select count(*) from pg_policies where schemaname = 'public';

-- The data is actually present.
select count(*) as bookings   from public.bookings;
select count(*) as shipments  from public.shipments;
select count(*) as payments   from public.payments;
select count(*) as audit_rows from public.audit_logs;
```

Compare the row counts against production **at the timestamp you dumped**. Not
"roughly similar" — the same numbers, because the dump is a point-in-time
snapshot.

```sql
-- Row counts by table, for the record.
select relname, n_live_tup
from pg_stat_user_tables
where schemaname = 'public'
order by relname;
```

### Step 5 — prove the security model works

A restored database that answers queries to everybody is worse than no database.

```sql
-- As the ANON role, with no identity, this must return ZERO rows.
set role anon;
select count(*) from public.payments;
reset role;
```

> On a **Supabase-hosted** target this returns `0`. On a **bare local
> PostgreSQL** it raises `permission denied for table payments` instead, because
> Supabase's default privileges (`anon` and `authenticated` having `USAGE` on
> `public` and `SELECT` on its tables) are not in the dump — they are platform
> defaults that Supabase recreates, which is exactly why `--schema=public`
> excludes everything Supabase manages.
>
> **A `permission denied` here is a finding, not a pass.** It means the grants are
> missing on the target. Record it in the drill log and fix the target before
> trusting the restore. A check that "passed" because it errored is not a pass.

Then confirm the helper functions still resolve — if `has_role()` or `is_admin()`
is broken, every policy in the application fails and it usually surfaces as a
generic permission error rather than as "the security layer is missing":

```sql
select has_role('admin'), is_staff(), is_dispatcher(), is_driver();
```

### Step 6 — record the result

Write down, in the incident log:

- Date, who ran it, which dump file (and its `sha256`).
- **Wall-clock time from `pg_dump` to "usable".** That is your real RTO, and it
  will be longer than you estimate.
- Anything that failed, and what you did about it.

The first drill almost always finds something. That is the drill working.

---

## Restoring into production

For a real incident:

1. **Stop writes.** Put the app in maintenance mode, or scale it to zero, before
   restoring. Restoring under live traffic means the application writes to a
   database that is being overwritten.
2. **Prefer PITR.** Supabase → Point-in-time Recovery → new branch. Verify the
   branch has the data. Only then promote it. This is faster and safer than
   restoring a dump over a live database.
3. **If restoring a dump**, restore to a *new* database, verify it with step 4
   above, then repoint the application. Do not `pg_restore` over a live
   production database — `--clean` drops tables, and the application will be
   serving 500s from the moment it starts until the restore finishes.
4. **Re-point the environment.** `SUPABASE_DB_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   change. Redeploy — see [DEPLOYMENT.md](./DEPLOYMENT.md#next_public_-values-are-frozen-at-build-time).
5. **Reconcile payments.** A restore rolls back `payments` too. Customers may
   have paid against records that no longer exist. Compare against Paystack:

   ```sql
   select (paid_at at time zone 'Africa/Lagos')::date as lagos_day,
       currency,
       count(*) as payments,
       sum(amount_minor) as total_minor
from public.payments
where status = 'succeeded' and paid_at is not null
group by 1, 2
order by 1 desc
limit 14;
   ```

   Reconcile against the Paystack dashboard for the same days. See
   [OPERATIONS.md](./OPERATIONS.md#2a-payment-stuck-in-pending).
6. **Check R2.** The database is back; the objects are not necessarily there.
   Confirm both buckets still exist and that a sample `delivery_proofs.image_url`
   resolves.

### Recovery targets

Not yet measured. These are **estimates, not verified numbers** — the first
drill replaces them with measurements.

| Scenario | Target | Basis |
| --- | --- | --- |
| Bad deploy, no data loss | < 5 min | Vercel promote of the previous deployment |
| Accidental `DELETE`, within retention | < 30 min | Supabase PITR to a timestamp |
| Accidental `DELETE`, older than retention | ~2–4 hours | Logical dump into a new database |
| Total region loss | hours | Whichever the provider can promise |

Do not quote these to a customer or a contract until the drill has measured
them. A target that has never been attempted is a wish.
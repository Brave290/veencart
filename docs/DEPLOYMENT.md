# Deploying Veencart Logistics to production

Step-by-step, in the order that avoids deploying something that cannot work.

Every command below is real and copy-pasteable. Every value written as
`<angle-brackets>` is a placeholder — **none of them is a credential this
repository contains**, and several require accounts the team does not have yet.

---

## Current state — read this first

| Area | State | Consequence for deploying |
| --- | --- | --- |
| Database schema + RLS | Complete, 7 migrations | Can be applied today, once a Supabase project exists |
| CI gate | Complete | Runs on every push and PR |
| Public site | Builds and serves | Deployable now |
| Booking, tracking, store, admin, driver | **Not built** | Deploying today ships the marketing site only |
| Paystack, R2, email integration | **Not built** | The credential steps below prepare the accounts, but there is no code to consume them yet |

Steps 3–6 configure third-party accounts for features that are not implemented.
They are written now so the accounts exist when the code lands — not because the
current deploy needs them. **A deploy today is a real deploy of a partial
application.** Say so to the client rather than discovering it in production.

---

## Preflight checklist

Run every command. A tick means you ran it and read the output — not that you
expect it to work.

```bash
# 1. The full local gate. This is what CI runs, in the same order.
npm run typecheck && npm run lint && npm run check:contrast \
  && npm run db:verify && npm run test && npm run build

# 2. Confirm the lockfile describes the manifest. A mismatch means nobody
#    knows exactly what is being deployed.
npm ci --dry-run

# 3. Confirm the working tree is what you think it is.
git status --short
git log --oneline -3

# 4. Confirm no secret is staged. The tree is otherwise clean if this prints
#    nothing.
git diff --cached --name-only
```

**If step 1 fails, stop.** Do not deploy a commit that its own CI rejects.

---

## 1. Supabase project

**BLOCKED — needs a Supabase account and a paid/appropriate plan the team does
not have yet.**

1. Create a project at <https://supabase.com/dashboard>. Choose the region
   closest to Lagos (`Europe (Paris)` or `ap-southeast-1` are common choices) —
   every request from Nigeria crosses an ocean either way; pick the lower-latency
   one and measure.
2. Under **Project Settings → API**, record:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` — server only, never
     `NEXT_PUBLIC_`
   - **Database URL** (Connection string, Session pooler) → `SUPABASE_DB_URL`

> The service role key is displayed **once**. Copy it into the password manager
> immediately. If it is lost, rotate it; do not try to recover it from the
> dashboard.

3. Do **not** disable RLS anywhere. The 7 migrations enable and force RLS on all
   32 tables. That enforcement *is* the access control model — see
   [ENVIRONMENT.md](./ENVIRONMENT.md#the-two-keys-that-must-never-be-next_public_).

---

## 2. Apply the migrations

**BLOCKED — needs `SUPABASE_DB_URL` from step 1.**

Migrations live in `backend/supabase/migrations/`, numbered `0001`–`0007`, and are meant
to run in filename order.

> These files do **not** write to the `supabase_migrations.schema_migrations`
> table, so the Supabase CLI has no remote history to compare against and will
> consider all seven unapplied. `--include-all` is what makes that work. Without
> it, `supabase db push` reports nothing to do — or fails looking for the history
> table. This is a real, verified property of these files, not a guess.

### Dry run first — always

```bash
supabase login
supabase link --project-ref <supabase-project-ref> --password '<db-password>'

# Prints what would be applied. Changes nothing.
supabase db push --linked --include-all --dry-run
```

Read the output before proceeding. Confirm it lists exactly `0001` … `0007` and
nothing else. If it proposes dropping or recreating anything unexpected, stop
and re-read the migrations.

### Apply

```bash
supabase db push --linked --include-all
```

### Fallback: plain `psql`

Use this when the CLI cannot reach the project, or when you want each file
applied with the credentials you are already using.

```bash
for f in $(ls backend/supabase/migrations/*.sql | sort); do
  echo "--- applying $f ---"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

**`ON_ERROR_STOP=1` is not optional.** Without it `psql` prints an error, keeps
going, and still exits 0 — so a half-applied migration reports success. That flag
is the difference between a failed deploy and a corrupted schema that surfaces
three days later.

All seven migrations are written to be idempotent (`IF NOT EXISTS`, guarded `DO`
blocks, drop-then-create), so re-running one is safe.

### Verify what landed

```bash
psql "$SUPABASE_DB_URL" -c "\dt public.*" | tail -n +3 | wc -l    # expect 32
psql "$SUPABASE_DB_URL" -c "select count(*) from pg_policies where schemaname = 'public';"
psql "$SUPABASE_DB_URL" -c "select count(*) from pg_tables where schemaname='public' and rowsecurity;"
```

The RLS count must equal the table count. If RLS is enabled but **not forced**
on even one table, that table's owner role bypasses its own policies — and on
Supabase, several internal roles do. Every table should report `rowsecurity = t`
and `relforcerowsecurity = t`.

### Seed data

`backend/supabase/seed.sql` contains fictional demo data — no real PII. **Do not load it
into production.** It exists so the RLS tests and local development have
something to assert against. Confirm `bookings` is empty afterwards:

```bash
psql "$SUPABASE_DB_URL" -c "select count(*) from public.bookings;"
```

---

## 3. Cloudflare R2

**BLOCKED — needs a Cloudflare account with R2 enabled (requires a payment
method on file).**

### Create the buckets

R2 → **Create bucket**, twice:

| Bucket | Access | Contents |
| --- | --- | --- |
| `veencart-public-media` | Public | Catalogue and marketing images |
| `veencart-private-files` | Private | Proof-of-delivery photos, customer documents |

Two buckets, deliberately. A single bucket cannot have two different access
policies; merging them would put delivery photos of customers' homes behind the
same public read that makes the catalogue work.

### CORS (dashboard only)

For each bucket: R2 → bucket → **Settings → CORS Policy** → **Add CORS policy**.

Public media bucket:

```json
[
  {
    "allowed_origins": [
      "https://<your-production-domain>",
      "http://localhost:3000"
    ],
    "allowed_methods": ["GET", "HEAD"],
    "allowed_headers": ["Content-Type"],
    "expose_headers": ["ETag"],
    "max_age_seconds": 3600
  }
]
```

Private files bucket: upload paths need `PUT`, and the allowed origin is the
application only.

```json
[
  {
    "allowed_origins": [
      "https://<your-production-domain>",
      "http://localhost:3000"
    ],
    "allowed_methods": ["PUT", "GET", "HEAD"],
    "allowed_headers": ["Content-Type", "x-amz-*"],
    "max_age_seconds": 3600
  }
]
```

Notes:

- `allowed_origins` is **not** `*` for the private bucket. `*` on a `PUT`-enabled
  bucket lets any website upload into your storage.
- `http://localhost:3000` is for development. Remove it before launch, or it
  stays in production forever because somebody will need it "just for testing".
- Keep `localhost` out of `NEXT_PUBLIC_APP_URL` in production. See
  [ENVIRONMENT.md](./ENVIRONMENT.md#app).

### API token

R2 → **Manage R2 API Tokens** → **Create API Token** → **Object Read & Write**,
scoped to both buckets. Record as `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY`.

Set `R2_ACCOUNT_ID` from the account identifier in the R2 overview page, and
`R2_S3_ENDPOINT` to `https://<account-id>.r2.cloudflarestorage.com`.

---

## 4. Paystack

**BLOCKED — needs a Paystack account, business verification, and bank
settlement details the team does not have yet.**

### Test mode first

1. Dashboard → **Settings → API Keys & Integration**. Use `pk_test_` /
   `sk_test_`.
2. Store the secret key as `PAYSTACK_SECRET_KEY`.

> **CORRECTION (16 Oct 2026).** This section previously said "Copy **Webhook
> Secret** → `PAYSTACK_WEBHOOK_SECRET`". **Paystack has no webhook secret.**
> That is a Stripe concept and the field does not exist in the Paystack
> dashboard — the instruction sent the team looking for something that is not
> there. Corrected below and in `.env.example`.

### Webhook URL

Dashboard → **Settings → API Keys & Integration → Webhooks**, add:

| Field | Value |
| --- | --- |
| URL | `https://<your-production-domain>/api/webhooks/paystack` |
| Events | `charge.success`, `charge.failed`, `refund.processed`, `refund.failed` |

There is **no Secret field** on this form. Verification uses your API secret
key, which the application already has as `PAYSTACK_SECRET_KEY`.

Use the **test** tab while on test keys — Paystack keeps test and live webhooks
separate, and a test key will not verify a live-mode event.

> **This endpoint does not exist yet.** The Paystack integration is not built.
> Setting the URL now means Paystack will begin delivering events to a 404,
> which appears in the dashboard as a failing webhook and will go onto a retry
> schedule. Add the URL when the route is implemented, not before.

### How the signature actually works

Per Paystack's live documentation (published 28 Sep 2026) and corroborated by
the official PHP SDK source:

| Aspect | Value |
| --- | --- |
| Header | `x-paystack-signature` |
| Algorithm | HMAC-SHA512, lowercase hex, 128 chars |
| Key | your API **secret key** |
| Hashed input | the **raw request body bytes** |

Three failure modes worth knowing before you debug:

1. **Re-serialising the JSON breaks verification.** Capture the raw bytes before
   any body parser consumes the stream. Identical data hashed differently is
   still a different digest.
2. **Test keys do not verify live events** (and the reverse).
3. **There is no replay protection.** The signature covers the body only — no
   timestamp, nonce or version field. A captured (body, signature) pair stays
   valid forever.

### The requirement that is not optional

`/api/webhooks/paystack` **must** verify that signature against
`PAYSTACK_SECRET_KEY` and reject unverified requests. Without it the endpoint is
a public write API for "mark this order as paid".

Because Paystack documents that **resending is not idempotent** — the same
event id really can arrive twice — and provides no replay protection, the
unique constraint on `payment_events.provider_event_id` is the *only* replay
defence in the system. It is a security control, not a tidy-up measure.

Paystack retries failed deliveries, so the handler must be **idempotent**. The
database already supports this correctly — `payment_events.provider_event_id` is
`UNIQUE`, so a replayed event collides on insert instead of double-crediting a
customer. Do not work around that constraint.

---

## 5. Email domain: SPF, DKIM, DMARC

**BLOCKED — needs a domain Veencart owns. None is configured yet.**

Until this is done, every transactional email is delivered to spam or rejected.

### SPF

Authorises the Resend sending servers for the domain. Published as a TXT record
on the **domain's DNS zone**, not on a subdomain.

- Name/Host: `@`
- Type: `TXT`
- Value (Resend's record, exactly as shown in their dashboard):
  `v=spf1 include:amazonses.com -all`

### DKIM

Signs outgoing mail so the receiving server can verify it was not spoofed.
Resend generates the records for the domain.

- Name/Host: `resend._domainkey`
- Type: `CNAME` (and the TXT records Resend lists)
- Value: the target Resend provides

SPF **alone is not enough** — it says which servers may send, not that a given
message was not modified. Both records are required.

### DMARC

Tells receivers what to do when SPF or DKIM fails. Start in monitoring mode.

- Name/Host: `_dmarc`
- Type: `TXT`
- Value: `v=DMARC1; p=none; rua=mailto:dmarc-reports@<your-domain>; fo=1`

`p=none` monitors without affecting delivery. After a week of clean reports,
move to `p=quarantine`, then eventually `p=reject`. Do not start at `p=reject` —
a single misconfigured sending service means bounced transactional mail, which is
how customers stop hearing about their deliveries.

### Then

Set `EMAIL_FROM=Veencart Logistics <no-reply@<your-domain>>` and
`RESEND_API_KEY`.

Verify:

```bash
dig +short TXT <your-domain>                # SPF
dig +short TXT resend._domainkey.<your-domain>   # DKIM
dig +short TXT _dmarc.<your-domain>         # DMARC
```

---

## 6. Vercel project and environment variables

**BLOCKED — needs a Vercel account and the production domain.**

### Create the project

```bash
npm i -g vercel
vercel login
vercel link                      # creates/links the project; answer the prompts
```

Do not run `vercel deploy --prod` yet. Configure variables first.

### `NEXT_PUBLIC_` values are frozen at build time

`NEXT_PUBLIC_*` values are **inlined into the JavaScript bundle at build time**.
Setting one on the Vercel project after a deploy has already happened changes
nothing about the live site. The value in the served bundle is the one that was
there when `next build` ran.

So: set every `NEXT_PUBLIC_*` variable **before** the first production deploy,
and **redeploy** after changing one. Server-only variables are read at request
time and do not have this problem — but on Vercel a redeploy is still needed for
them to reach Serverless Functions in some configurations, so redeploy anyway.

### Add the variables

```bash
# Server-only secrets — stored encrypted, never rendered in the dashboard.
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_DB_URL production
# Paystack webhook verification uses this same key — there is no separate
# webhook secret to add.
vercel env add PAYSTACK_SECRET_KEY production
vercel env add R2_ACCOUNT_ID production
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production
vercel env add R2_S3_ENDPOINT production
vercel env add R2_BUCKET_PUBLIC_MEDIA production
vercel env add R2_BUCKET_PRIVATE_FILES production
vercel env add R2_PUBLIC_MEDIA_BASE_URL production
vercel env add RESEND_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add SENTRY_DSN production

# Public values.
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY production

# Plain configuration.
vercel env add EMAIL_FROM production
vercel env add PAYSTACK_MIN_KOBO production
```

Each command prompts for the value and which environments to apply to. Use
`test` keys for Paystack until launch, and confirm `NEXT_PUBLIC_APP_URL` is the
real production domain — not `http://localhost:3000`, which is the single most
common misconfiguration on a first deploy.

Verify what is set without printing any secret values:

```bash
vercel env list production
```

Repeat the block with `preview` (and `development` if you use the CLI for dev)
for preview deployments. `NEXT_PUBLIC_APP_URL` differs per environment; a
preview build that inlines the production URL will generate production callback
URLs from a preview host.

---

## 7. Deploy

### From the CLI

```bash
vercel deploy --prod
```

### From a Git push (recommended)

Connect the GitHub repository in the Vercel dashboard so every push to `main`
deploys. Both CI workflows run first; configure them as required status checks
in **Settings → Branch Protection** so a red build cannot be merged.

### If you use `vercel.json`

The repository does not contain one. Next.js 16 is auto-detected by Vercel, so
no framework config is needed. If one is added later, keep the build command as
`npm run build` and the output directory as `.next`, and do not add a
`NODE_VERSION` that disagrees with `engines.node` (`>=22.0.0`).

---

## 8. Post-deploy verification

Run these against the **live** domain after every deploy. They are the only
checks that prove the deployed artefact works.

```bash
export APP=https://<your-production-domain>

# Public site responds and is not a framework error page.
curl -sS -o /dev/null -w '%{http_code}\n' "$APP"

# Security headers applied (set in next.config.ts).
curl -sSI "$APP" | grep -iE 'x-frame-options|x-content-type-options|referrer-policy|permissions-policy'

# The domain is really serving production, not a preview.
curl -sSI "$APP" | grep -iE '^server:|^x-vercel'

# NEXT_PUBLIC_ values were inlined at build time — if this prints
# "undefined" or localhost, the build used the wrong environment.
curl -sS "$APP" | grep -o 'localhost:3000' && echo "FAIL: localhost leaked into the bundle"
```

Then, in a browser, confirm the security headers above are present, the home page
and `/services` render, and `/services/<unknown-slug>` returns 404.

**These are manual steps.** They have not been automated and have not been run
against a live deployment, because no deployment exists yet.

---

## Rollback

**Time to roll back: 2–5 minutes** (Vercel redeploy of the previous
known-good deployment; a rollback that requires a rebuild is not a rollback).

```bash
# Find the deployment to return to.
vercel ls

# Promote a previous deployment back to production.
vercel promote <deployment-url-or-id> --prod
```

Or: Vercel dashboard → Deployments → the known-good one → **⋯ → Promote to
Production**.

### The rule about order

> **Database migrations run BEFORE the new code, never after.**

A migration that removes a column, renames a table, or tightens a constraint
breaks the currently-running version. Deploy migration first, code second — and
ensure the migration is **backward-compatible with the version currently in
production**, which is what makes rollback possible at all.

Concretely, safe migrations here:

- **Adding** a table, column, index, or enum value.
- **Widening** a constraint (`varchar(50)` → `varchar(100)`).
- Adding a `NOT NULL` column **with a default** — the old code ignores it.

Unsafe, and needing a two-release expand/contract:

- Dropping or renaming anything.
- Narrowing a type or adding a `NOT NULL` without a default.
- Changing a CHECK constraint that existing rows might violate.

### Rollback is not free if a migration is destructive

If migration N has already been applied and the code is rolled back to the
version before it, the old code runs against a newer schema. That is safe **only
if the migration was backward-compatible**. If it was not, rollback requires a
forward migration — you are not rolling back, you are repairing.

Prefer forward-only releases where the repair is a new migration, and keep every
migration file in the repository. Never edit or delete a migration that has been
applied to production; write a new one.

---

## Rotating a leaked secret

1. **Rotate at the provider first** — Paystack dashboard, Supabase API settings,
   Cloudflare R2 token. Invalidate the old value there. The provider is the only
   place that can actually revoke it.
2. Update the Vercel environment: `vercel env add <NAME> production --force`.
3. Redeploy.
4. Audit for use of the old value:
   - Paystack: dashboard transaction list, looking for refunds or transfers that
     should not exist.
   - Supabase: `audit_logs`, plus the table row counts for anything anomalous.
   - R2: object listing in both buckets.
5. If it was ever in a client bundle, assume it is public — see
   [ENVIRONMENT.md](./ENVIRONMENT.md#the-two-keys-that-must-never-be-next_public_).
   Git history retains it. Treat as compromised, not "fixed by redeploying".
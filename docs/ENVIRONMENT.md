# Environment variables

Every variable Veencart reads at runtime, what it is for, whether it is safe in
a browser, and what actually breaks when it is missing.

Source of truth: `.env.example` in the repository root. This document
**describes** that file; it does not replace it. If the two disagree, `.env.example`
is what the code was written against, and this document is wrong.

---

## The one rule that matters

> **`NEXT_PUBLIC_` means "this value is compiled into the JavaScript that every
> visitor downloads."**

Next.js inlines `NEXT_PUBLIC_*` variables into the client bundle at **build**
time. Anyone who loads the site can read them — view-source, DevTools, or one
`curl` of a `.js` chunk. The prefix is not a hint; it is a publish switch, and it
is irreversible once shipped.

Everything else stays server-side by construction. A variable named
`PAYSTACK_SECRET_KEY` is never bundled into a client chunk unless something
explicitly renames it, imports a server module into a client component, or writes
it into a response body. CI enforces the first two cases — see the
"Guard — no server-only secret name in the client bundle" step in
`.github/workflows/ci.yml`.

---

## The two keys that must never be `NEXT_PUBLIC_`

### `SUPABASE_SERVICE_ROLE_KEY`

This is the Supabase **service role** key. It does not merely have high
privileges — it **bypasses Row Level Security entirely**. Every policy in
`supabase/migrations/0007_rls.sql`, and the 44 tests that verify those policies,
protect data from a compromised or careless application. A service role key in
the browser removes that protection completely: anyone can read every row of
`payments`, `profiles`, `guest_access_tokens` and `audit_logs`, and write to
them.

The RLS layer is not decorative here. It is the primary access control, and this
key is the master override. Keep it server-side, always.

### `PAYSTACK_SECRET_KEY`

Paystack's **secret key**. With it, anyone can move money: initiate refunds,
initiate transfers, read full transaction histories. Paystack does not bind a
request to a browser origin, so a leaked secret key is a leaked bank account.

Its sibling `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is the opposite case and is
**meant** to be public — it is the publishable key that the browser hands to
Paystack's JS to initialise a checkout. Leaking it costs nothing.

The confusion is understandable and the consequence is severe, which is why
`PAYSTACK_SECRET_KEY` is called out separately here rather than left in a table.

**If either key has ever been in a client bundle, treat it as compromised.**
Rotating is the only remedy; see [DEPLOYMENT.md](./DEPLOYMENT.md#rotating-a-leaked-secret).

---

## Full variable reference

### App

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Absolute public base URL, no trailing slash. Used to build absolute links: Paystack callback/return URLs, email links, canonical URLs. |

**Breaks if missing:** any absolute URL is built from `undefined`. Customers
receive "undefined" in payment return URLs and email links. Set it to the real
production domain — `http://localhost:3000` in development.

**Build-time.** Because it is `NEXT_PUBLIC_`, the value is frozen into the bundle
when `next build` runs. On Vercel, adding or changing this variable does not
affect the live site until the next deployment. See
[DEPLOYMENT.md](./DEPLOYMENT.md#next_public_-values-are-frozen-at-build-time).

### Supabase

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Project URL, e.g. `https://<project-ref>.supabase.co`. Safe: it identifies the host, grants nothing. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | The publishable/anon key. Safe *because* RLS applies to it — the anon role can only read what the policies allow. |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO** | Bypasses RLS entirely. Master key. Never `NEXT_PUBLIC_`. |
| `SUPABASE_DB_URL` | **NO** | Direct Postgres connection string (`postgresql://…`). Used by migrations and operational queries. |

**Breaks if missing:** the app cannot reach the database at all. With the anon
key but no URL, the Supabase client throws on construction. With the service role
key missing, any code path that needs to read across RLS — the guest booking
service path, the notification outbox worker, the reconciliation sweeper — fails,
and does so as a permission error rather than as a clean "not configured".

**On `SUPABASE_DB_URL`:** the password is part of the connection string, so treat
the whole string as a secret. Percent-encode special characters in the password
(`@` → `%40`, `/` → `%2F`) or `psql` will misparse the URL. The Supabase CLI
requires this as well — it says so explicitly in its flag help.

### Paystack

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | **Yes** | Publishable key (`pk_test_` / `pk_live_`). Initialises the browser checkout. |
| `PAYSTACK_SECRET_KEY` | **NO** | Secret key (`sk_test_` / `sk_live_`). Server-side verification and refunds. Never `NEXT_PUBLIC_`. |
| `PAYSTACK_WEBHOOK_SECRET` | **NO** | HMAC-SHA512 signing secret from the Paystack dashboard. |
| `PAYSTACK_MIN_KOBO` | **No** | Minimum charge in kobo. Paystack rejects below this; also enforced server-side. Default `5000` (₦50). |

**Breaks if missing:** this is the most dangerous variable in the file, because
of *how* it breaks.

- **`PAYSTACK_WEBHOOK_SECRET` missing** does not crash the webhook. It makes
  `/api/webhooks/paystack` **unauthenticated**. Anyone who knows the URL can POST
  a fabricated `charge.success` and mark any order paid without paying. If this
  variable is absent, the endpoint must fail closed and reject every request —
  an unverified webhook is strictly worse than no webhook, because it silently
  creates orders that were never paid for. Treat "webhook secret unset" as a
  launch blocker, not a warning.
- `PAYSTACK_SECRET_KEY` missing: checkout initialisation succeeds in the browser
  and the server then cannot verify the payment. The customer is charged and the
  order is never confirmed — the worst failure mode in the system, because the
  money has left and nothing records it.
- Using `sk_live_` in production with a `pk_test_` public key (or the reverse)
  produces failures at verification that look like provider errors.

**Always start on test keys.** Paystack test keys and live keys are separate
accounts; a `pk_test_` public key cannot be used to make a real charge.

### Cloudflare R2

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | **NO** | Cloudflare account identifier. |
| `R2_ACCESS_KEY_ID` | **NO** | R2 API token key id. |
| `R2_SECRET_ACCESS_KEY` | **NO** | R2 API token secret. Never `NEXT_PUBLIC_`. |
| `R2_S3_ENDPOINT` | **No** | S3-compatible endpoint: `https://<account-id>.r2.cloudflarestorage.com`. |
| `R2_BUCKET_PUBLIC_MEDIA` | **No** | Bucket for catalogue images. Public-read via CDN. |
| `R2_BUCKET_PRIVATE_FILES` | **No** | Bucket for proof-of-delivery photos and customer documents. **Never** public. |
| `R2_PUBLIC_MEDIA_BASE_URL` | **No** | CDN/custom-domain base URL that serves `R2_BUCKET_PUBLIC_MEDIA`. |

**Breaks if missing:** uploads fail. Proof-of-delivery capture fails *at the
door*, with the driver holding the parcel — so this is a field failure, not just
an error log. Presigned upload URLs are generated server-side; without the
credentials, no URL can be produced.

**Two buckets is not redundancy, it is separation.** A public catalogue image and
a proof-of-delivery photo of somebody's living room must not be reachable through
the same policy. If they share a bucket, the public-read policy that makes the
catalogue work also exposes every delivery photo to anyone who can guess or
enumerate a key. Do not merge them to save configuration effort.

### Email

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | **NO** | Resend API key for transactional email. |
| `EMAIL_FROM` | **No** | From header, e.g. `Veecart Logistics <no-reply@yourdomain>`. |

**Breaks if missing:** the notification outbox accumulates `failed` rows and
nothing is ever delivered. Booking confirmations and delivery updates silently
do not arrive. This fails quietly — the system looks healthy and customers hear
nothing. That is why `notification_outbox` retries 5 times before marking a row
failed: see [OPERATIONS.md](./OPERATIONS.md#3-failed-notification-sends).

`EMAIL_FROM` must be a domain that passes SPF and DKIM. An unverified from
address lands in spam or is rejected outright. See
[DEPLOYMENT.md](./DEPLOYMENT.md#5-email-domain-spf-dkim-dmarc).

SMS and WhatsApp are deliberately **absent** from this file. Adding them changes
the operating cost model and is a business decision, not a configuration one.

### Rate limiting and monitoring

| Variable | Browser-safe | Purpose |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | **NO** | Upstash Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | **NO** | Upstash Redis REST token. Never `NEXT_PUBLIC_`. |
| `SENTRY_DSN` | Effectively yes | Sentry DSN. Public by design — it is a write-only ingest URL, not a read key. |

**Breaks if missing:** rate limiting fails **open** — requests are not limited.
Public tracking lookup and booking creation are the endpoints at risk: without
rate limiting they can be enumerated or used to generate load. Decide explicitly
whether a missing Redis means "allow all" or "reject all"; "allow all" silently
is the wrong default for a public endpoint.

`SENTRY_DSN` being public-by-design is exactly why it is safe to prefix with
`NEXT_PUBLIC_` if the code needs it on the client. It still is not prefixed here
— there is no reason to, and one fewer `NEXT_PUBLIC_` is one fewer thing to audit.
Setting a DSN in a client app is normally how browser errors get reported.

---

## Setting them up

### Local development

```bash
cp .env.example .env.local
```

`.gitignore` ignores `.env*` and re-includes only `.env.example`, so a real
`.env.local` can never be committed by accident — and adding a new variable to
the example file is never blocked by that rule.

Minimum to run the public site: nothing. The pages that exist today read no
environment variables. Everything else is needed as the booking, payment and
storage features land.

### CI

Set **none** of them. `.github/workflows/ci.yml` supplies non-secret placeholders
for the build step only. The full gate — typecheck, lint, contrast, migrations,
tests — needs no credentials at all, because the migration verifier and the test
suite run against PGlite rather than a real database.

A gate that needs a secret to run is a gate nobody runs. Keeping CI
credential-free is what guarantees it runs on every PR, including from forks.

### Production

See [DEPLOYMENT.md](./DEPLOYMENT.md). Store them in the host's encrypted
environment store — never in the repository, never in a build log, never in a
committed `.env`.

---

## Current gap: no boot-time validation

There is **no `src/lib/env.ts`**. Nothing validates this set at startup today, so
a missing variable surfaces as a failed request at the moment that code path is
first exercised — possibly days into production, possibly on a customer's order.

This is a known, open gap, recorded here rather than glossed over. What it means
in practice:

- A missing `RESEND_API_KEY` does not stop a deploy. It stops emails, quietly,
  at a time nobody is watching.
- A missing `PAYSTACK_WEBHOOK_SECRET` does not stop a deploy. It opens an
  unauthenticated endpoint that can mark orders paid.
- A missing `R2_SECRET_ACCESS_KEY` does not stop a deploy. It fails at a
  customer's doorstep.

Until a validated config module exists, **the checklist in
[DEPLOYMENT.md](./DEPLOYMENT.md#preflight-checklist) is the control.** Run it
before every production deploy. Adding that module is tracked as work for the
application layer, not for deployment.
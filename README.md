# Veencart Logistics

Nigeria-first logistics and commerce platform. Local and interstate delivery
booking, hybrid fixed-tariff and manual-quote pricing, Paystack payments,
Cloudflare R2 storage, shipment tracking, a single-store marketplace, and staff
and driver workspaces.

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 · Supabase
(Postgres + Auth + RLS) · Vitest · Playwright.

---

## Status

Honest state of the build. Nothing below is aspirational.

| Area | State | Verified by |
| --- | --- | --- |
| Database schema | **Complete** | 7 migrations applied to real PostgreSQL |
| Row Level Security | **Complete** | 44 tests, real role switching |
| Design tokens + motion | **Complete** | 21 contrast pairs, 18 motion tests |
| Public site (home, services) | **Partial** | builds, serves, 404 correct |
| Booking, tracking, store, admin, driver | **Not built** | — |
| Paystack, R2, email | **Not built** | blocked on client credentials |
| Playwright browser tests | **Written, unrunnable here** | see Known limitations |

### Client and integration documents

- [Merchant Integration API](./docs/MERCHANT-INTEGRATION-API.md) — external checkout, delivery-payment handoff, webhooks, idempotency, and owner notifications.
- [Client Implementation Report](./docs/CLIENT-IMPLEMENTATION-REPORT.md) — feasibility, privacy, security, dependencies, decisions, and acceptance criteria.
- [Client Implementation Report PDF](./docs/CLIENT-IMPLEMENTATION-REPORT.pdf) — shareable client-facing version.

### Foundation primitives

- `backend/src/lib/integration-security.ts` provides HMAC request signing, timestamp checks, nonce validation, and idempotency fingerprints for the future merchant API.
- `backend/src/lib/pricing-engine.ts` calculates delivery prices with `bigint` minor units and returns a versioned breakdown suitable for an immutable quote snapshot.
- `backend/src/lib/marketplace-entitlements.ts` centralises subscription/grace-period enforcement so marketplace access is not dependent on UI hiding.
- `backend/src/lib/notification-safety.ts` builds privacy-minimised pickup notifications and rejects unsafe action URLs and line-break injection.
- `tests/foundation-primitives.test.ts` covers the security and business-rule regressions for these modules.

Run `npm run check` for the full gate: typecheck, lint, contrast, migrations,
tests.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in Supabase + Paystack + R2 keys
npm run dev                    # http://localhost:3000
```

### Verification commands

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run check:contrast  # WCAG 2.1 AA gate — fails the build on regression
npm run db:verify       # apply every migration to real PostgreSQL
npm test                # 62 tests: RLS isolation + motion contract
npm run test:e2e        # Playwright (needs a browser-capable host)
npm run check           # all of the above except e2e
```

`npm run db:verify` and the test suite run migrations against **PGlite**, which
is real PostgreSQL 18.6 compiled to WebAssembly. The same files run on Supabase
in production. This is not a mock — RLS, transactions, CHECK constraints and
triggers all execute for real.

---

## Architecture

A **modular monolith**: one Next.js application, one relational database,
separate integrations for payments, storage and email. No microservices.

```
frontend/
  src/
    app/          Next.js routes, page shells and server-rendered UI
    components/   brand, motion and reusable UI components
    lib/          browser-safe design, motion and service definitions
backend/
  src/
    actions/      server actions exposed to frontend forms
    lib/          database adapter, SQL helpers, tracking projection and types
  supabase/       migrations/0001..0007 and fictional seed data
src -> frontend/src  compatibility link used by Next.js and existing tooling
scripts/             migration verifier, contrast gate, brand rename
tests/               rls.test.ts, motion.test.ts, e2e/
```

The project is still one deployable Next.js modular monolith. The `frontend/`
folder is where page and component work belongs. The `backend/` folder owns
server actions, database access, SQL and Supabase migrations. Root files remain
shared project configuration and command entry points. The small `src` link is
intentional: Next.js App Router and existing tooling continue to work while the
ownership boundary stays visible in GitHub.

### Database

32 tables, 18 enums, RLS enabled **and forced** on all 32, 62 policies.

Load-bearing decisions:

- **Money is `bigint` minor units plus an explicit `currency`.** Never float.
- **`timestamptz` only.** UTC is mandated; local business dates derive from
  `AT TIME ZONE 'Africa/Lagos'` at query time.
- **Append-only history** on `shipment_events`, `payment_events`,
  `inventory_movements`, `audit_logs` — enforced by trigger, not convention.
  Corrections are new rows.
- **RLS helper functions are `SECURITY DEFINER` with `set search_path = ''`**,
  owned by a `BYPASSRLS` role. This is what prevents the SQLSTATE 42P17
  policy-recursion trap that fails every query in the app.
- **Guest access tokens store only a SHA-256 hash**, with expiry and revocation.
  A guest is not a database principal and reaches their booking through the
  service path after verification.

Three bugs found by *running* the migrations rather than reading them are
documented in the commit history — including `EXCLUDE ... WHERE`, which is not
valid PostgreSQL, and a missing table grant that silently broke every
role-based policy.

---

## Design system

Brand teal and orange on warm neutrals. Tokens live in the Tailwind v4 `@theme`
block in `frontend/src/app/globals.css`; there is no `tailwind.config.js`.

### Contrast is a build gate

`npm run check:contrast` fails on regression. Four pairings in the supplied
palette were corrected because they failed WCAG 2.1 AA:

| Original | Ratio | Correction | New |
| --- | --- | --- | --- |
| `#FFFFFF` on `#F4773B` | 2.78:1 | ink `#202927` on orange fill | 5.36:1 |
| `#FFFFFF` on orange fill | 2.78:1 | `--color-brand-orange-700` | 4.99:1 |
| `#66736F` on `#F1F4F1` | 4.46:1 | `#5F6C68` | 4.95:1 |
| `#B8C3BD` control edge | 1.81:1 | `#808B87` | 3.52:1 |

**Orange is never a white-text background.**

### Motion

Motion must communicate something static design cannot. Durations are capped at
400ms, only `transform` and `opacity` are animated, and exit runs at ~75% of
entrance.

The reduced-motion contract is implemented so that **every failure mode degrades
to "the content is visible"**: no JavaScript, reduced motion, or a script error
all leave every section readable. `tests/motion.test.ts` enforces this.

---

## Known limitations

- **Playwright browser tests cannot run in this build environment.** Chromium
  fails to launch on Alpine (`posix_fallocate64: symbol not found`, a musl/glibc
  mismatch). The specs and config are correct and the production server boots;
  it needs a normal Linux runner.
- `scripts/sandbox-network-shim.cjs` exists solely because this sandbox blocks
  the syscall `next start` calls. It is inert without an opt-in env var and is
  never used by `npm start`, `dev` or `build`.
- **No logo asset in the repo.** The brand hexes are provisional until the
  client supplies the real logo and they are re-verified against it.
- Contact details and operating hours are intentionally absent. The live site
  and the WhatsApp listing currently disagree.

---

## Open client decisions

These are configurable, not guessed. Each is seeded in `system_settings` with
`is_confirmed = false`:

1. Whether payment is required before dispatch.
2. Recipient-payment procedure.
3. Actual rate card and supported routes.
4. Cancellation and refund policy.
5. Required proof of delivery per service.
6. Inventory reservation window.

Nothing in the codebase presents an unconfirmed value to a customer as fact.

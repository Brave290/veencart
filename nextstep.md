# Veencart — Next Steps

**Last updated:** 16 Oct 2026
**Owner note:** this file is the contract. Each step has a *done condition*
that can be verified, not "looks about right". If a step cannot be verified, it
is not done.

---

## 0. Where we actually are

Verified on this commit, not asserted:

| | |
| --- | --- |
| Database | 32 tables · 18 enums · RLS **and FORCE RLS** on all 32 · 62 policies |
| Tests | 90 passing (5 files) |
| Typecheck / lint / build | clean / clean / green |
| Security | 2 CRITICAL + 3 HIGH found by audit, all fixed, each with a regression test |
| Frontend | home, services ×6, store, book, contact, maintenance, track, 404 |
| Backend | data layer, public tracking projection — **no write path yet** |

### The central risk, stated plainly

**The schema and policies protect nothing yet, because no application code
writes to them.** 32 tables and 62 RLS policies are a vault with nothing inside.
This is the only structural risk in the project and every step below exists to
close it.

A corollary that dictates the order: **there is no data**, so `/admin`,
`/driver` and `/store` are not dashboards — they are mockups with empty states.
Building them before `/book` means designing screens against fiction.

---

## Phase 1 — Make the backend load-bearing

### Step 1 — Environment validation at boot 🔴 NEXT

**Why this is first:** it is small, and one missing variable is currently a
silent security failure. A missing Paystack key does not crash anything — it
just stops payment verification working, quietly, in production.

- [ ] `backend/src/lib/env.ts` using Zod, parsed once at startup
- [ ] Fails **loudly** on boot with a named variable, never a default
- [ ] Distinguishes server-only from browser-safe; refuses to expose a
      server-only key through any client path
- [ ] Runs in dev, in tests, and in production builds

**Done when:** `RESEND_API_KEY= npm run build` fails with a message naming
`RESEND_API_KEY`, and `npm run build` passes with a complete `.env`.

---

### Step 2 — Booking write path (`/book`) 🔴

The first real write. This is the step that makes the vault non-empty.

- [ ] Multi-step form: service type → pickup → destination → parcel → payer
- [ ] Zod validation **server-side**, not just client-side
- [ ] Nigerian address structure: state, city/locality, street, phone
- [ ] Route check against `service_areas` + `route_rules` BEFORE any price
- [ ] Unsupported route → `awaiting_quote`, never an invented price
- [ ] Writes `bookings` + `booking_items` in one transaction
- [ ] Guest access token generated, **hash only**, expiring
- [ ] Status starts at `requested`/`quote_requested` — never `confirmed`

**Done when:** a test books a supported route and asserts the rows exist with
the right status; a test books an unconfigured route and asserts a quote request
is created and **no price appears anywhere**.

> Deliberately plain-looking. You redesign this once it *works*, so your art
> direction sits on something real instead of a mockup you mentally fill in.

---

### Step 3 — Hybrid pricing engine

- [ ] Fixed tariff resolved from `route_rules` + `service_areas`
- [ ] Weight, dimension, quantity and service-type bands
- [ ] Manual quote request when no rule applies
- [ ] Quote stores an **immutable price snapshot** with a pricing-basis version
- [ ] Expiry enforced; an expired quote cannot be accepted

**Done when:** pricing tests cover tariff hit, tariff miss, expiry, surcharge,
minimum fee — and a later tariff change does not alter an accepted quote.

---

### Step 4 — Paystack (blocked on credentials)

Blocked until the client supplies test keys. Code must not be written blind.

- [ ] Server-side transaction initialisation, unique reference
- [ ] Amount taken from the **quote snapshot**, never from the browser
- [ ] Webhook: verify `x-paystack-signature` = HMAC-SHA512 over the **raw body**,
      keyed with `PAYSTACK_SECRET_KEY`
- [ ] Raw bytes captured before any body parser — re-serialising breaks the digest
- [ ] Idempotent on `payment_events.provider_event_id`
- [ ] Sender **or** recipient as payer; recipient link expiring

**Done when:** a forged `charge.success` is rejected, a valid one is processed,
and the same event delivered three times changes state exactly once.

> **Security note that shapes this step:** Paystack signs the body only — no
> timestamp, nonce or version — and states resends are not idempotent. The
> unique constraint is therefore the *only* replay defence, not housekeeping.

---

## Phase 2 — Surfaces (each unblocks the next)

### Step 5 — Customer tracking via token
Guest token → verified → narrow public projection. Rate-limited.

### Step 6 — `/admin` dispatch queue
Now shows real bookings. Unassigned queue, driver assignment, quote issuance.
Only after Step 2 produces rows.

### Step 7 — `/driver` mobile workspace
Assigned jobs only, status updates, delivery evidence. Mobile-first — drivers
are on low-end Android on mobile data.

### Step 8 — Marketplace
Catalogue, cart, transactional stock reservation, order fulfilment.
Separate order status from shipment status.

---

## Phase 3 — Operations

### Step 9 — Cloudflare R2 storage
Public media bucket vs private delivery-evidence bucket. Signed uploads, verified
before the record is written. **A failed upload must never count as proof.**

### Step 10 — Transactional email
Queued outbox with retries, triggered from **committed** business events.
SPF/DKIM/DMARC before launch.

### Step 11 — Staging verification
Deploy to staging. Run the full gate against real Supabase. Staff walkthrough.
Backups tested with an actual **restore**, not just a backup.

---

## Known risks, tracked not buried

| Risk | Why it matters | State |
| --- | --- | --- |
| No browser in this environment | Chromium cannot launch (musl/glibc). Every UI claim so far is verified by `curl`, not by rendering | **open** — needs a Linux runner |
| No application layer | Policies protect nothing yet | Steps 2–4 |
| No boot env validation | A missing key fails silently | Step 1 |
| No Veencart logo asset in repo | Brand hexes are provisional | client input |
| Contact details unconfirmed | Site and WhatsApp listing disagree | client input |
| Payment timing policy undecided | Configurable, `is_confirmed = false` | client decision |
| Refund/cancellation policy undecided | Configurable, `is_confirmed = false` | client decision |
| Reservation window undecided | Configurable, `is_confirmed = false` | client decision |

---

## Definition of done for the platform

- [ ] Guest booking creates real rows with a real route check
- [ ] Tracking exposes only authorised fields, verified by test
- [ ] Payment verified server-side; forged webhooks rejected
- [ ] Drivers update only assigned jobs
- [ ] Stock cannot be oversold under concurrency
- [ ] RLS proven per role with real role switching
- [ ] Restored-from-backup demonstrated, not assumed
- [ ] WCAG AA contrast gate green in CI
- [ ] 44+ tests, typecheck, lint, production build all green
- [ ] No fabricated prices, coverage claims, testimonials or contact details

---

## Questions for the client

Answers change configuration, not architecture. Each is already seeded as
`is_confirmed = false`.

1. **Rate card** — actual routes and prices.
2. **Payment timing** — required before dispatch, or deposit, or pay-on-delivery?
3. **Recipient payment** — how is the recipient's link delivered and authenticated?
4. **Cancellation / refund** — deadlines, fees, who authorises.
5. **Proof of delivery** — photo, signature, OTP, per service type?
6. **Stock reservation** — how long does an unpaid cart hold stock?
7. **Contact details** — authoritative phone, email, hours (site and WhatsApp disagree).
8. **Logo** — final brand asset so the palette can be reconciled against it.
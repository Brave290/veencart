# Veencart Client Implementation Report

**Prepared:** 18 October 2026  
**Repository:** `Brave290/veencart`  
**Audience:** Veencart / Founda Tech client team

## Executive summary

Veencart can support the requested operating model. A merchant may keep its own website and product checkout, then send Veencart a server-to-server delivery request. Veencart can validate the route, calculate or manually quote the delivery fee, collect the delivery payment, and notify the merchant when the item is ready for pickup. This is the recommended architecture because it separates product payment from delivery payment and keeps payment verification under Veencart's control.

The repository already contains a serious foundation: a Nigerian address and phone model, route coverage checks, a transactional booking write path, guest capability tokens, payment and notification-outbox tables, RLS policies, a marketplace schema, accessibility gates, and security regression tests. The project is not yet a complete production marketplace or logistics platform. The production Supabase adapter, Paystack integration, merchant API endpoints, subscription enforcement, operations dashboards, and SMS/WhatsApp provider integration still need to be completed and configured.

This report intentionally distinguishes **safe to implement**, **blocked by account or business decisions**, and **not safe to claim complete**. No customer-facing price, coverage promise, payment state, or notification-delivery claim should be fabricated.

## What the client requested

The client brief describes:

1. Merchants using a Veencart-hosted marketplace that is available only while their subscription is active.
2. Merchants keeping their own website and checkout, with customers coming to Veencart only to pay delivery.
3. Automatic delivery-fee calculation where a confirmed rate applies.
4. A merchant/business-owner notification after the relevant order/payment event, asking when the item will be available for pickup and using the merchant's saved location.
5. A website that remains open continuously rather than blocking customers by operating hours.
6. Rider scheduling after the merchant confirms availability.

The repository now includes a dedicated integration contract at `docs/MERCHANT-INTEGRATION-API.md` describing this model, authentication, idempotency, payload minimisation, webhooks, and acceptance criteria.

## Feasibility matrix

| Capability | Feasibility | Current position | Dependency / decision |
|---|---|---|---|
| Merchant server creates Veencart delivery request | Yes | Contract documented; endpoint not yet shipped | Production DB adapter, merchant credentials, API implementation |
| Customer pays product on merchant site | Yes | External to Veencart | Merchant's own checkout and order system |
| Customer pays delivery on Veencart | Yes | Payment schema is prepared; provider code is not complete | Paystack test credentials and payment policy |
| Automatic delivery fee | Yes, when rate card exists | Coverage exists; fee engine is still required | Confirmed routes, tariffs, surcharges, minimums |
| Manual quote fallback | Yes | Existing booking flow safely avoids invented prices | Operations quote workflow and SLA |
| Merchant notification by email | Yes | Outbox schema and runbook exist; provider send path is not complete | Resend/domain configuration |
| Merchant notification by SMS/WhatsApp | Yes | Provider-neutral contract documented; no provider selected | Provider, sender/template approval, consent, cost, delivery receipts |
| Merchant pickup availability response | Yes | Data model/API work remains | Merchant authentication and operations scheduling |
| Website open 24/7 | Yes | Recommended operating model | Capture pickup availability; do not promise instant collection |
| Subscription-gated hosted marketplace | Yes | Marketplace schema exists; subscription entitlement enforcement remains | Plans, billing, grace period, expiry behaviour, payment provider |
| Production operation | Not yet | Deliberately blocked by missing Supabase adapter/credentials | Supabase project, migrations, env secrets, staging verification |

## Recommended end-to-end integration

1. A customer orders and pays for goods on the merchant's website.
2. The merchant's server sends Veencart a signed delivery request with a unique merchant order ID and idempotency key.
3. Veencart authenticates the merchant, validates addresses and parcel information, checks route coverage, and creates a delivery booking.
4. If a confirmed tariff applies, Veencart creates an immutable delivery-fee snapshot and provides a hosted payment URL. If no tariff applies, Veencart returns a manual-quote outcome and no amount.
5. The customer pays delivery on Veencart. The amount is derived from the server-side snapshot, never from browser input.
6. Paystack's server-to-server verification or signature-checked webhook confirms payment. Redirects are not proof of payment.
7. Veencart writes a notification-outbox item asking the merchant when the parcel will be available. The notification should include only a short delivery reference and a secure action link.
8. The merchant confirms an availability window. Veencart staff schedules a rider using the merchant's stored pickup location.
9. Veencart sends signed status webhooks back to the merchant for accepted, pickup scheduled, picked up, in transit, delivered, failed, or cancelled states.

## What is already strong in the repository

- PostgreSQL migrations define 32 tables, enums, money in integer minor units, UTC timestamps, append-only histories, payment records, notification outbox, marketplace products/carts/orders, and RLS policies.
- The booking write path validates server-side, records booking and parcel rows transactionally, hashes guest access tokens, and avoids returning a price for an unsupported route.
- The site does not present unconfirmed contact details, operating hours, coverage, or fabricated prices as facts.
- The security model keeps service-role and payment secret keys server-side and documents why `NEXT_PUBLIC_` values are public.
- Accessibility and contrast gates are automated. Motion degrades to visible content for reduced-motion and script-failure cases.
- Production database misuse is guarded: the local file-backed adapter is not silently allowed to pretend to be production.
- The production dependency audit is clean. The full development audit reports a documented dev-only `braces` advisory in the ESLint chain; `npm audit --omit=dev` reports zero vulnerabilities.

## What remains to implement

### Merchant integration API

Build authenticated server routes for delivery creation, delivery lookup, availability confirmation, and outbound status webhooks. Add per-merchant credentials, HMAC signatures with timestamp and nonce, idempotency storage, replay rejection, rate limits, and audit rows. The browser must never receive a merchant secret.

### Delivery pricing engine

Implement a server-side engine that reads `service_areas` and `route_rules`, applies service type, weight, dimensions, quantity, surcharges, minimum charge, and validity windows, and stores an immutable quote snapshot with a pricing-basis version. Any unmatched route must remain a manual quote.

### Payments

Implement Paystack initialisation, server-side amount derivation, raw-body HMAC-SHA512 webhook verification using `PAYSTACK_SECRET_KEY`, provider-event idempotency, reconciliation, recipient-payment handling if approved, and refund flows. Start in test mode. Do not configure a webhook URL before its endpoint exists.

### Notifications

Implement an outbox worker with bounded retries, provider adapters, delivery receipts, operator-visible failures, and template versioning. SMS/WhatsApp should be treated as transactional operations messaging, not marketing, until consent and opt-out rules are approved.

### Marketplace subscriptions

Add subscription state and entitlement checks at the database/service boundary. Define plans, billing interval, trial, grace period, renewal failure, cancellation, refund, and post-expiry order rules. Recommended default: expired merchants cannot publish new products or create new marketplace orders, but already-paid orders remain fulfilable.

### Production infrastructure

Create and secure the Supabase project, apply and verify migrations, configure encrypted environment variables, set up Paystack test mode, configure notification providers, deploy to staging, run browser tests on a normal Linux runner, perform a real restore drill, and only then launch.

## Privacy and data protection

Veencart processes names, phone numbers, email addresses, precise addresses, parcel descriptions, order identifiers, payment references, and potentially delivery evidence. The product should follow data minimisation, purpose limitation, access control, retention limits, and secure deletion.

### Data minimisation

Collect only the fields needed to calculate, fulfil, support, and prove a delivery. Use a merchant pickup-location ID instead of copying the full owner address into every API call or notification. Do not transmit card data, CVV, passwords, customer account tokens, or unrelated order history.

### Notifications

SMS and WhatsApp are not suitable for full delivery addresses, payment details, guest tokens, or sensitive parcel descriptions. Use a short reference plus a short-lived authenticated action link. The link must be revocable, rate-limited, and scoped to the specific merchant request.

### Access control

Merchant users must see only their own stores, delivery requests, products, orders, subscription, and notification outcomes. Staff access must be role-limited and audited. Support queries run with elevated access should be read-only by default and must never copy OTPs, tokens, or complete personal records into tickets.

### Storage and retention

Public catalogue media and private proof-of-delivery files must remain in separate storage buckets. Proof files need short-lived signed URLs. Define retention periods for bookings, payment records, audit logs, notification payloads, and delivery evidence before launch. Database backups and dumps are sensitive because they contain customer data and payment references; encrypt them and keep them off-site.

### Legal and vendor review

The privacy notice should name the delivery purpose, merchant-to-Veencart transfer, payment provider, messaging provider, hosting/storage providers, retention, customer access/deletion rights, and international transfers where applicable. A legal or privacy review is required before production; this report is an engineering assessment, not legal advice.

## Security controls required for launch

- Never put `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `PAYSTACK_SECRET_KEY`, R2 secrets, or provider credentials in a `NEXT_PUBLIC_` variable or client bundle.
- Treat payment redirects as untrusted. Only server verification or a valid provider webhook can advance payment state.
- Verify Paystack signatures against the raw request body and deduplicate provider events.
- Enforce subscription entitlements in server code and database policies, not only in UI route guards.
- Use idempotency on merchant delivery creation and outbound webhooks.
- Rate-limit public tracking, booking, payment, integration, and action-link endpoints.
- Do not log guest tokens, secret keys, full webhook bodies where unnecessary, card data, OTPs, or full addresses.
- Keep an append-only audit trail for subscription changes, price overrides, refunds, dispatch actions, and access-control changes.
- Validate uploads, use private evidence storage, and verify that an upload succeeded before recording it as proof.
- Run a real backup restore drill; an untested backup is not a verified recovery plan.

## Client decisions needed

1. Confirm the rate card, supported routes, currency, minimum fee, surcharges, and weight/dimension rules.
2. Confirm whether delivery payment is required before dispatch, whether pay-on-delivery is allowed, and whether the recipient may pay.
3. Confirm cancellation, refund, failed-delivery, and re-delivery rules.
4. Choose the SMS/WhatsApp provider and approve sender identity, templates, consent, opt-out, delivery receipts, and monthly budget.
5. Provide the authoritative business contact details, domain, logo, and customer-support channel.
6. Define marketplace subscription plans, price, trial, grace period, renewal failure, cancellation, refunds, and post-expiry treatment of paid orders.
7. Confirm proof-of-delivery requirements: photo, signature, OTP, or service-specific combinations.
8. Confirm the customer-data retention schedule and approve the privacy notice.
9. Provide or provision Supabase, Paystack test, R2, email, messaging, monitoring, and hosting accounts.

## Acceptance tests for the complete system

- A merchant can create one delivery request from its own server and safely retry it without duplicate bookings.
- A request with an unsupported route produces a manual quote and no customer-visible amount.
- A supported request receives a server-derived fee snapshot that does not change when the rate card changes later.
- A forged Paystack webhook is rejected; a valid duplicate event changes state only once.
- A merchant cannot access another merchant's request by changing an ID or replaying a token.
- Payment success creates exactly one owner notification outbox item for the chosen trigger.
- A notification failure retries, then becomes visible to operations without silently disappearing.
- The owner action link is scoped, expires, can be revoked, and does not expose a bearer token in logs.
- An expired marketplace subscription blocks protected writes even when UI restrictions are bypassed.
- Private delivery evidence cannot be fetched using a public catalogue URL.
- RLS, typecheck, lint, contrast, migration, unit, browser, staging, and restore gates are green.

## Honest delivery status

The repository is a well-tested foundation and partial public site, not a finished production marketplace. The safe next implementation sequence is: production database adapter; merchant integration endpoints; pricing snapshots; Paystack test integration; notification worker/provider adapter; subscription entitlements; operations and rider surfaces; staging and restore verification.

The proposed external-checkout model is feasible and is documented for implementation. It should not be marketed as live until credentials, providers, business rules, integration tests, and staging verification are complete.

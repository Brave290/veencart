# Veencart Merchant Integration API

## Purpose

Veencart can support a merchant that keeps its own storefront and checkout. The merchant website creates the customer order and collects the product payment. It then sends Veencart a delivery request. Veencart validates the request, calculates or quotes the delivery fee, collects that delivery fee through Veencart, and sends the merchant an operational notification asking when and where the item will be ready for pickup.

This is an integration contract and security design. It is not a claim that the live endpoint or payment provider is already enabled: the production Supabase adapter, Paystack credentials, merchant credentials, and an SMS/WhatsApp provider are still required.

## Recommended flow

1. A customer orders and pays for goods on the merchant's website.
2. The merchant server creates a Veencart delivery request with a unique merchant order ID and an idempotency key. The merchant browser must not call Veencart with a secret key.
3. Veencart authenticates the merchant server, validates the payload, checks route coverage, and creates a delivery booking in `requested`, `quote_requested`, or `draft` status. Unsupported routes never receive an invented fee.
4. Veencart returns a delivery reference and either an approved fee snapshot or a manual-quote outcome.
5. The merchant redirects the customer to a Veencart-hosted delivery-payment page, or uses a Veencart checkout link. Veencart calculates the payable amount from its server-side quote snapshot; it never trusts an amount from the browser or merchant payload.
6. Paystack confirms payment through server-side verification or a signature-checked webhook. A redirect is not proof of payment, and duplicate webhook delivery must be harmless.
7. After the qualifying event selected by the client — payment success is the safer default — Veencart writes a transactional notification-outbox item asking the merchant when the parcel will be available and confirming the pickup location already registered for the merchant.
8. The merchant responds through an authenticated API endpoint or a signed action link with an availability window. Veencart staff can then schedule a rider.
9. Veencart sends status webhooks back to the merchant as the delivery moves through pickup, transit, and delivery. Webhook consumers must be idempotent.

## Authentication and replay protection

- Use a per-merchant server-to-server credential or HMAC signing key. Never expose it in browser JavaScript, HTML, logs, analytics, or customer-visible URLs.
- Include `Idempotency-Key` on every create request. The key must be unique per merchant operation and retained long enough to cover provider retries.
- Include a timestamp and nonce in the signed canonical request. Reject requests outside a small clock-skew window and reject reused nonces.
- Sign the method, path, timestamp, nonce, body digest, and body bytes with HMAC-SHA256. Compare signatures in constant time.
- Store the request identity and result before returning success. A retry with the same idempotency key must return the original result, not create another booking or payment.
- Rotate merchant keys. Provide a short overlap period so rotation does not interrupt delivery creation.

## Example create request

```http
POST /api/v1/merchant/delivery-requests
Authorization: Veencart-HMAC key_id="mrc_live_...", timestamp="...", nonce="...", signature="..."
Idempotency-Key: merchant-order-2026-000184-delivery-v1
Content-Type: application/json
```

```json
{
  "merchant_order_id": "ORD-2026-000184",
  "merchant_order_status": "paid",
  "customer": {
    "name": "Customer name",
    "phone": "+2348031234567",
    "email": "customer@example.com"
  },
  "pickup": {
    "location_id": "merchant-lagos-main",
    "available_from": "2026-10-20T10:00:00+01:00",
    "available_until": "2026-10-20T14:00:00+01:00"
  },
  "dropoff": {
    "name": "Recipient name",
    "phone": "+2348012345678",
    "street": "Recipient street",
    "locality": "Ikeja",
    "city": "Lagos",
    "state": "Lagos"
  },
  "parcel": {
    "description": "General merchandise",
    "quantity": 1,
    "weight_kg": 2.5,
    "length_cm": 30,
    "width_cm": 20,
    "height_cm": 15,
    "is_fragile": false
  },
  "service_type": "standard",
  "delivery_payment": {
    "payer": "customer",
    "return_url": "https://merchant.example/veencart/return"
  }
}
```

## Privacy-minimised payload rules

- Send only fields Veencart needs to perform delivery. Do not send card numbers, CVV, passwords, customer account tokens, or the merchant's internal order history.
- Parcel descriptions should be operational, not unnecessarily sensitive. Do not include health, religious, financial, or identity-document details unless a separate approved process exists.
- SMS/WhatsApp notifications should contain a short delivery reference and a secure action link, not full addresses, payment information, or access tokens.
- Use the merchant's registered pickup location ID rather than copying the full address into every notification.
- The privacy notice must explain the merchant-to-Veencart transfer, delivery purpose, provider subprocessors, retention, and customer rights.

## Response outcomes

- `201 created`: delivery request accepted; response includes `delivery_reference`, `status`, and a hosted `payment_url` only when an approved fee exists.
- `202 quote_required`: route or parcel is not covered by a confirmed tariff; no amount is returned. Operations must quote it.
- `409 duplicate`: same merchant order cannot create a second active delivery unless the original is explicitly cancelled or superseded.
- `401/403`: missing, invalid, expired, or unauthorised merchant credential.
- `422 validation_error`: invalid state, phone, dimensions, date, service, or missing required field.
- `429 rate_limited`: retry using the documented backoff and the same idempotency key.

## Subscription-gated marketplace

For merchants using Veencart's hosted marketplace, access must be enforced in the server and database layers. The UI may show a subscription warning, but UI hiding is not an access control.

The client must decide:

- plan names and prices;
- billing interval and currency;
- trial and grace periods;
- whether renewal failure blocks new orders, product publishing, or both;
- whether existing paid orders remain fulfilable after expiry;
- cancellation, refund, and reactivation rules;
- who can manage a merchant subscription.

Recommended default: an expired subscription blocks publishing new catalogue items and creating new marketplace orders, while preserving read-only access and allowing already-paid orders to complete. This must be confirmed by the client before production use.

## Provider dependencies

- **Supabase:** production database and RLS-backed persistence.
- **Paystack:** delivery-fee checkout, server-side verification, and webhook signature verification using the Paystack secret key over the raw request body.
- **SMS/WhatsApp provider:** provider selection, sender identity, templates, consent/opt-out support, delivery receipts, costs, and data-processing terms.
- **Email provider:** optional fallback and operational notifications.
- **Background worker or scheduled job:** outbox delivery, retries, webhook delivery, stale-payment reconciliation, and expired subscription handling.

## Acceptance criteria

- Repeating a create request with the same idempotency key returns one delivery request and one payment attempt.
- A forged payment webhook cannot mark delivery as paid.
- A merchant cannot create or mutate another merchant's delivery request.
- An unsupported route returns `quote_required` and never exposes a fabricated amount.
- Notification content excludes full addresses, secrets, payment-card data, and bearer tokens.
- Failed SMS/WhatsApp delivery remains in the outbox with bounded retries and an operator-visible failure state.
- Subscription expiry blocks protected marketplace writes even when the browser bypasses the UI.
- Every privileged change is auditable without copying unnecessary personal data into the audit row.

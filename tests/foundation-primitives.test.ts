import { describe, expect, it } from 'vitest';
import {
  canonicalMerchantRequest,
  createMerchantRequestSignature,
  idempotencyFingerprint,
  validateMerchantNonce,
  verifyMerchantRequestSignature,
} from '@backend/lib/integration-security';
import { calculateDeliveryPrice } from '@backend/lib/pricing-engine';
import { marketplaceEntitlement } from '@backend/lib/marketplace-entitlements';
import { buildMerchantPickupNotification } from '@backend/lib/notification-safety';

const SECRET = 'merchant-secret-that-is-at-least-32-characters-long';

const tariff = {
  routeRuleId: 'route-1',
  pricingBasisVersion: '2026-10-rate-card-v1',
  currency: 'NGN',
  baseFeeMinor: 1_000n,
  perKgMinor: 500n,
  perItemMinor: 100n,
  surchargeMinor: 250n,
  minimumChargeMinor: 2_000n,
};

describe('merchant integration security primitives', () => {
  it('signs and verifies the exact request body', () => {
    const body = JSON.stringify({ merchant_order_id: 'ORD-1', amount: 10 });
    const signature = createMerchantRequestSignature('merchant-1', body, {
      method: 'POST',
      path: '/api/v1/merchant/delivery-requests',
      nowSeconds: 1_800_000_000,
      nonce: 'nonce-abcdefghijklmnop',
    }, SECRET);

    expect(validateMerchantNonce(signature.nonce)).toBe(true);
    expect(verifyMerchantRequestSignature({
      method: 'POST',
      path: '/api/v1/merchant/delivery-requests',
      timestamp: signature.timestamp,
      nonce: signature.nonce,
      body,
    }, signature.signature, SECRET, { nowSeconds: 1_800_000_100 })).toBe(true);
    expect(verifyMerchantRequestSignature({
      method: 'POST',
      path: '/api/v1/merchant/delivery-requests',
      timestamp: signature.timestamp,
      nonce: signature.nonce,
      body: `${body} `,
    }, signature.signature, SECRET, { nowSeconds: 1_800_000_100 })).toBe(false);
  });

  it('rejects stale signatures and invalid nonce shapes', () => {
    expect(validateMerchantNonce('short')).toBe(false);
    expect(verifyMerchantRequestSignature({
      method: 'POST', path: '/x', timestamp: 10, nonce: 'nonce-abcdefghijklmnop', body: '{}',
    }, 'a'.repeat(64), SECRET, { nowSeconds: 1_000 })).toBe(false);
  });

  it('uses a stable fingerprint for idempotency storage', () => {
    expect(idempotencyFingerprint('post', '/x', '{}')).toBe(idempotencyFingerprint('POST', '/x', '{}'));
    expect(canonicalMerchantRequest({ method: 'post', path: '/x', timestamp: 1, nonce: 'n', body: '{}' })).toContain('POST');
  });
});

describe('delivery pricing foundation', () => {
  it('calculates integer minor-unit totals and applies a minimum', () => {
    const price = calculateDeliveryPrice({ weightKg: '1.2', quantity: 1, serviceType: 'standard' }, tariff);
    expect(price.subtotalMinor).toBe(1_000n + 500n * 2n + 100n);
    expect(price.surchargeMinor).toBe(250n);
    expect(price.totalMinor).toBe(2_350n);
    expect(price.pricingBasisVersion).toBe('2026-10-rate-card-v1');
  });

  it('rejects negative or overweight inputs instead of producing a price', () => {
    expect(() => calculateDeliveryPrice({ weightKg: '-1', quantity: 1, serviceType: 'standard' }, tariff)).toThrow();
    expect(() => calculateDeliveryPrice({ weightKg: '10', quantity: 1, serviceType: 'standard' }, { ...tariff, maxWeightKg: '5' })).toThrow(/weight/i);
  });
});

describe('marketplace entitlement policy', () => {
  const periodEnd = new Date('2026-11-01T00:00:00Z');
  it('allows reads but blocks writes without a subscription', () => {
    expect(marketplaceEntitlement(null, 'read_catalogue').allowed).toBe(true);
    expect(marketplaceEntitlement(null, 'create_order').allowed).toBe(false);
  });

  it('allows active and grace-period writes, but not expired writes', () => {
    expect(marketplaceEntitlement({ status: 'active', currentPeriodEnd: periodEnd }, 'publish_product', new Date('2026-10-20T00:00:00Z')).allowed).toBe(true);
    expect(marketplaceEntitlement({ status: 'past_due', currentPeriodEnd: new Date('2026-10-01T00:00:00Z'), gracePeriodEnd: new Date('2026-10-25T00:00:00Z') }, 'create_order', new Date('2026-10-20T00:00:00Z')).reason).toBe('grace_period');
    expect(marketplaceEntitlement({ status: 'expired', currentPeriodEnd: new Date('2026-10-01T00:00:00Z') }, 'create_order', new Date('2026-10-20T00:00:00Z')).allowed).toBe(false);
  });
});

describe('notification privacy boundary', () => {
  it('creates a short, safe merchant payload without customer PII', () => {
    const notification = buildMerchantPickupNotification({
      deliveryReference: 'VCB-12345',
      merchantName: 'Example Merchant',
      pickupLocationLabel: 'Lagos Main Store',
      actionUrl: 'https://veencart.example/actions/pickup/abc',
      channel: 'whatsapp',
    });
    expect(notification.template).toBe('merchant_pickup_availability_requested');
    expect(JSON.stringify(notification)).not.toMatch(/phone|email|address|token|payment/i);
  });

  it('rejects unsafe action URLs and header-injection text', () => {
    expect(() => buildMerchantPickupNotification({
      deliveryReference: 'VCB-1', merchantName: 'Merchant\nBCC: attacker@example.com', pickupLocationLabel: 'Store', actionUrl: 'https://example.com/a', channel: 'email',
    })).toThrow();
    expect(() => buildMerchantPickupNotification({
      deliveryReference: 'VCB-1', merchantName: 'Merchant', pickupLocationLabel: 'Store', actionUrl: 'http://example.com/a', channel: 'sms',
    })).toThrow(/HTTPS/);
  });
});

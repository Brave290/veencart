import 'server-only';

export type MarketplaceSubscription = {
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodEnd: Date;
  gracePeriodEnd?: Date | null;
};

export type MarketplaceOperation = 'read_catalogue' | 'publish_product' | 'create_order' | 'manage_subscription';

export type EntitlementDecision = {
  allowed: boolean;
  reason: 'active' | 'grace_period' | 'read_only_after_expiry' | 'subscription_required' | 'operator_only';
};

/**
 * Pure entitlement policy. Keep this check on the server/database boundary;
 * client-side hiding is only presentation and is not access control.
 */
export function marketplaceEntitlement(
  subscription: MarketplaceSubscription | null,
  operation: MarketplaceOperation,
  now = new Date()
): EntitlementDecision {
  if (operation === 'manage_subscription') {
    return { allowed: true, reason: 'operator_only' };
  }

  if (operation === 'read_catalogue') {
    return { allowed: true, reason: subscription ? 'active' : 'read_only_after_expiry' };
  }

  if (!subscription) return { allowed: false, reason: 'subscription_required' };
  if ((subscription.status === 'active' || subscription.status === 'trialing') && now < subscription.currentPeriodEnd) {
    return { allowed: true, reason: 'active' };
  }

  if (
    subscription.status === 'past_due' &&
    subscription.gracePeriodEnd &&
    now < subscription.gracePeriodEnd
  ) {
    return { allowed: true, reason: 'grace_period' };
  }

  return { allowed: false, reason: 'read_only_after_expiry' };
}

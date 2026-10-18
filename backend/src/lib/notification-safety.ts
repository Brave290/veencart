import 'server-only';

export type MerchantPickupNotificationInput = {
  deliveryReference: string;
  merchantName: string;
  pickupLocationLabel: string;
  actionUrl: string;
  channel: 'sms' | 'whatsapp' | 'email';
};

export type SafeNotificationPayload = {
  template: 'merchant_pickup_availability_requested';
  recipientName: string;
  subject?: string;
  variables: {
    deliveryReference: string;
    merchantName: string;
    pickupLocationLabel: string;
    actionUrl: string;
  };
  // Explicitly kept separate from variables so adapters cannot accidentally
  // send a full customer record to a short-message provider.
  channel: MerchantPickupNotificationInput['channel'];
};

function cleanSingleLine(value: string, max: number, label: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`${label} may not contain line breaks.`);
  const clean = value.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > max) throw new Error(`${label} is invalid.`);
  return clean;
}

export function buildMerchantPickupNotification(
  input: MerchantPickupNotificationInput
): SafeNotificationPayload {
  const actionUrl = new URL(input.actionUrl);
  if (actionUrl.protocol !== 'https:') throw new Error('Notification action URLs must use HTTPS.');
  if (actionUrl.username || actionUrl.password || actionUrl.hash) {
    throw new Error('Notification action URLs may not contain credentials or fragments.');
  }

  const payload: SafeNotificationPayload = {
    template: 'merchant_pickup_availability_requested',
    recipientName: cleanSingleLine(input.merchantName, 120, 'Merchant name'),
    variables: {
      deliveryReference: cleanSingleLine(input.deliveryReference, 64, 'Delivery reference'),
      merchantName: cleanSingleLine(input.merchantName, 120, 'Merchant name'),
      pickupLocationLabel: cleanSingleLine(input.pickupLocationLabel, 120, 'Pickup location'),
      actionUrl: actionUrl.toString(),
    },
    channel: input.channel,
  };

  if (input.channel === 'email') payload.subject = 'Veencart pickup availability required';
  return payload;
}

import 'server-only';

export type DeliveryPricingInput = {
  weightKg: string | number;
  quantity: number;
  serviceType: string;
  dimensionsCm?: { length: string | number; width: string | number; height: string | number };
};

export type DeliveryTariff = {
  routeRuleId: string;
  pricingBasisVersion: string;
  currency: string;
  baseFeeMinor: bigint;
  perKgMinor: bigint;
  perItemMinor?: bigint;
  perDistanceMinor?: bigint;
  distanceKm?: string | number;
  surchargeMinor?: bigint;
  minimumChargeMinor?: bigint;
  maxWeightKg?: string | number | null;
  volumetricDivisor?: bigint;
  volumetricRateMultiplier?: bigint;
};

export type DeliveryPriceBreakdown = {
  currency: string;
  subtotalMinor: bigint;
  surchargeMinor: bigint;
  totalMinor: bigint;
  billableWeightKg: string;
  pricingBasisVersion: string;
  routeRuleId: string;
};

const DECIMAL = /^\d+(?:\.\d{1,3})?$/;

function decimalToThousandths(value: string | number, label: string): bigint {
  const text = String(value).trim();
  if (!DECIMAL.test(text)) throw new Error(`${label} must be a non-negative decimal.`);
  const [wholePart, fraction = ''] = text.split('.');
  const whole = wholePart as string;
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Calculates a delivery fee without floating point arithmetic. The result is a
 * pure value object suitable for storing as a quote snapshot.
 */
export function calculateDeliveryPrice(
  input: DeliveryPricingInput,
  tariff: DeliveryTariff
): DeliveryPriceBreakdown {
  if (!/^[A-Z]{3}$/.test(tariff.currency)) throw new Error('Currency must be an ISO-4217 uppercase code.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999) {
    throw new Error('Quantity must be an integer between 1 and 999.');
  }
  if (tariff.baseFeeMinor < 0n || tariff.perKgMinor < 0n) throw new Error('Tariff amounts cannot be negative.');

  const actualWeight = decimalToThousandths(input.weightKg, 'Weight');
  if (actualWeight <= 0n) throw new Error('Weight must be greater than zero.');
  const maxWeight = tariff.maxWeightKg == null ? null : decimalToThousandths(tariff.maxWeightKg, 'Maximum weight');
  if (maxWeight !== null && actualWeight > maxWeight) throw new Error('Parcel exceeds the tariff weight limit.');

  let billableWeight = actualWeight;
  if (input.dimensionsCm && tariff.volumetricDivisor) {
    const length = decimalToThousandths(input.dimensionsCm.length, 'Length');
    const width = decimalToThousandths(input.dimensionsCm.width, 'Width');
    const height = decimalToThousandths(input.dimensionsCm.height, 'Height');
    if (length <= 0n || width <= 0n || height <= 0n) throw new Error('Dimensions must be greater than zero.');
    // Each dimension is stored in thousandths of a centimetre. Convert the
    // product to a thousandth-of-a-kilogram billable weight in one integer
    // expression: (cm³ / divisor) kg × 1000.
    const volumetricWeight = ceilDiv(length * width * height, 1_000_000n * tariff.volumetricDivisor);
    if (volumetricWeight > billableWeight) billableWeight = volumetricWeight;
  }

  const weightUnits = ceilDiv(billableWeight, 1000n);
  let subtotal = tariff.baseFeeMinor + tariff.perKgMinor * weightUnits;
  if (tariff.perItemMinor) subtotal += tariff.perItemMinor * BigInt(input.quantity);
  if (tariff.perDistanceMinor && tariff.distanceKm !== undefined) {
    const distance = decimalToThousandths(tariff.distanceKm, 'Distance');
    subtotal += tariff.perDistanceMinor * ceilDiv(distance, 1000n);
  }
  if (tariff.volumetricRateMultiplier && billableWeight > actualWeight) {
    subtotal *= tariff.volumetricRateMultiplier;
  }

  const surcharge = tariff.surchargeMinor ?? 0n;
  if (surcharge < 0n) throw new Error('Surcharge cannot be negative.');
  const beforeMinimum = subtotal + surcharge;
  const minimum = tariff.minimumChargeMinor ?? 0n;
  if (minimum < 0n) throw new Error('Minimum charge cannot be negative.');
  const total = beforeMinimum < minimum ? minimum : beforeMinimum;

  return {
    currency: tariff.currency,
    subtotalMinor: subtotal,
    surchargeMinor: surcharge,
    totalMinor: total,
    billableWeightKg: `${billableWeight / 1000n}.${(billableWeight % 1000n).toString().padStart(3, '0')}`,
    pricingBasisVersion: tariff.pricingBasisVersion,
    routeRuleId: tariff.routeRuleId,
  };
}

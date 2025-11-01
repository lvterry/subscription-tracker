import seedData from '@/data/subscriptions.json';
import type { BillingCadence, Subscription } from '@/types/subscription';

const isBillingCadence = (value: unknown): value is BillingCadence =>
  value === 'Monthly' || value === 'Yearly';

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const coerced = Number(value);
    return Number.isFinite(coerced) ? coerced : null;
  }
  return null;
};

export const normalizeSubscription = (entry: unknown): Subscription | null => {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  const record = entry as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.trim() === '') {
    return null;
  }
  if (typeof record.name !== 'string' || record.name.trim() === '') {
    return null;
  }

  const fee = coerceNumber(record.fee);
  if (fee === null || fee < 0) {
    return null;
  }

  if (!isBillingCadence(record.cadence)) {
    return null;
  }

  const billingDate =
    typeof record.billingDate === 'string' ? record.billingDate : '';

  return {
    id: record.id,
    name: record.name,
    fee,
    cadence: record.cadence,
    billingDate,
  };
};

export const seedSubscriptions: Subscription[] = Array.isArray(seedData)
  ? seedData.map(normalizeSubscription).filter(Boolean) as Subscription[]
  : [];

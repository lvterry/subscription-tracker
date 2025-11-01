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

  const cost = coerceNumber(record.cost);
  if (cost === null || cost < 0) {
    return null;
  }

  // Handle both camelCase and snake_case field names
  const billingCycle = record.billingCycle || record.billing_cycle;
  if (!isBillingCadence(billingCycle)) {
    return null;
  }

  const nextBillingDate =
    typeof record.nextBillingDate === 'string' ? record.nextBillingDate :
    typeof record.next_billing_date === 'string' ? record.next_billing_date :
    '';

  const currency =
    typeof record.currency === 'string' ? record.currency : undefined;

  return {
    id: record.id,
    name: record.name,
    cost,
    billingCycle,
    nextBillingDate,
    currency,
  };
};

export const seedSubscriptions: Subscription[] = Array.isArray(seedData)
  ? seedData.map(normalizeSubscription).filter(Boolean) as Subscription[]
  : [];

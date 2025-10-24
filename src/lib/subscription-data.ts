import seedData from '@/data/subscriptions.json';
import type { BillingCadence, Subscription } from '@/types/subscription';

const STORAGE_KEY = 'subscription-tracker-subscriptions';

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

export const loadSubscriptionsFromStorage = (): Subscription[] => {
  if (typeof window === 'undefined') {
    return seedSubscriptions;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return seedSubscriptions;
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return seedSubscriptions;
    }

    const normalized = parsed
      .map(normalizeSubscription)
      .filter((item): item is Subscription => Boolean(item));

    if (normalized.length === parsed.length) {
      return normalized;
    }

    return normalized.length > 0 ? normalized : seedSubscriptions;
  } catch {
    return seedSubscriptions;
  }
};

export const persistSubscriptionsToStorage = (
  subscriptions: Subscription[],
) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  } catch {
    // Swallow storage errors (e.g. quota exceeded or private mode)
  }
};

export { STORAGE_KEY };

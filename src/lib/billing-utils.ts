import { addMonths, addYears, format, isBefore, parseISO, startOfDay } from 'date-fns';
import type { BillingCadence, Subscription } from '@/types/subscription';

const ISO_OUTPUT = 'yyyy-MM-dd';
const MAX_ITERATIONS = 240; // Prevent infinite loops (~20 years of monthly advances)

const parseDate = (value: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

export const rollForwardNextBillingDate = (
  nextBillingDate: string,
  billingCycle: BillingCadence,
  today: Date = new Date(),
): string | null => {
  const parsed = parseDate(nextBillingDate);
  if (!parsed) {
    return null;
  }

  const increment =
    billingCycle === 'Yearly'
      ? (date: Date) => addYears(date, 1)
      : (date: Date) => addMonths(date, 1);

  const todayStart = startOfDay(today);
  let candidate = parsed;
  let iterations = 0;

  while (isBefore(candidate, todayStart) && iterations < MAX_ITERATIONS) {
    candidate = increment(candidate);
    iterations += 1;
  }

  return format(candidate, ISO_OUTPUT);
};

export const autoAdvanceSubscription = (
  subscription: Subscription,
  today: Date = new Date(),
): { subscription: Subscription; changed: boolean } => {
  const rolled = rollForwardNextBillingDate(
    subscription.nextBillingDate,
    subscription.billingCycle,
    today,
  );

  if (!rolled || rolled === subscription.nextBillingDate) {
    return { subscription, changed: false };
  }

  return {
    subscription: { ...subscription, nextBillingDate: rolled },
    changed: true,
  };
};

export const autoAdvanceSubscriptions = (
  subscriptions: Subscription[],
  today: Date = new Date(),
): { subscriptions: Subscription[]; changedSubscriptions: Subscription[] } => {
  const advanced: Subscription[] = [];
  const changed: Subscription[] = [];

  subscriptions.forEach((subscription) => {
    const { subscription: updated, changed: didChange } = autoAdvanceSubscription(
      subscription,
      today,
    );
    advanced.push(updated);
    if (didChange) {
      changed.push(updated);
    }
  });

  return { subscriptions: advanced, changedSubscriptions: changed };
};

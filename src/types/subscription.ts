export type BillingCadence = 'Monthly' | 'Yearly';

export type FallbackIconKey =
  | 'sparkles'
  | 'globe'
  | 'rocket'
  | 'wallet'
  | 'calendar';

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCadence;
  nextBillingDate: string;
  currency?: string;
  providerId?: string | null;
  providerSlug?: string | null;
  providerName?: string | null;
  logoPath?: string | null;
  fallbackIconKey?: FallbackIconKey | null;
  normalizedName?: string | null;
};

export type SubscriptionProvider = {
  id: string;
  slug: string;
  displayName: string;
  logoPath: string;
  lastVerifiedAt?: string | null;
  notes?: string | null;
};

export type SubscriptionFormValues = {
  name: string;
  cost: string;
  currency: string;
  billingCycle: BillingCadence;
  nextBillingDate: string;
};

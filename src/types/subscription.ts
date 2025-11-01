export type BillingCadence = 'Monthly' | 'Yearly';

export type Subscription = {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCadence;
  nextBillingDate: string;
  currency?: string;
};

export type SubscriptionFormValues = {
  name: string;
  cost: string;
  currency: string;
  billingCycle: BillingCadence;
  nextBillingDate: string;
};

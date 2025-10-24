export type BillingCadence = 'Monthly' | 'Yearly';

export type Subscription = {
  id: string;
  name: string;
  fee: number;
  cadence: BillingCadence;
  billingDate: string;
};

export type SubscriptionFormValues = {
  name: string;
  fee: string;
  cadence: BillingCadence;
  billingDate: string;
};

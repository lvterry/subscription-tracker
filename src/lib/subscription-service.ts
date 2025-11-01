import { supabase } from './supabaseClient';
import type { Subscription, BillingCadence } from '@/types/subscription';

type SubscriptionRow = {
  id: string;
  user_id?: string;
  name: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

/**
 * Transform database row to Subscription type
 */
const transformRow = (row: SubscriptionRow): Subscription => {
  return {
    id: row.id,
    name: row.name,
    cost: row.cost,
    billingCycle: row.billing_cycle as BillingCadence,
    nextBillingDate: row.next_billing_date || '',
    currency: row.currency,
  };
};

/**
 * Load subscriptions for a user from the database
 */
export const loadSubscriptions = async (userId: string): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, name, cost, currency, billing_cycle, next_billing_date, active')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(transformRow).filter(Boolean) as Subscription[];
  } catch (error) {
    console.error('Error loading subscriptions:', error);
    throw error;
  }
};

/**
 * Create a new subscription in the database
 */
export const createSubscription = async (
  userId: string,
  subscription: Omit<Subscription, 'id'>
): Promise<Subscription> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        name: subscription.name,
        cost: subscription.cost,
        currency: subscription.currency || 'USD',
        billing_cycle: subscription.billingCycle,
        next_billing_date: subscription.nextBillingDate,
        active: true,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from insert');
    }

    return transformRow(data as SubscriptionRow);
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

/**
 * Update an existing subscription in the database
 */
export const updateSubscription = async (
  userId: string,
  subscription: Subscription
): Promise<Subscription> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        name: subscription.name,
        cost: subscription.cost,
        currency: subscription.currency || 'USD',
        billing_cycle: subscription.billingCycle,
        next_billing_date: subscription.nextBillingDate,
      })
      .eq('id', subscription.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No data returned from update');
    }

    return transformRow(data as SubscriptionRow);
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

/**
 * Delete a subscription from the database (hard delete)
 */
export const deleteSubscription = async (
  userId: string,
  subscriptionId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting subscription:', error);
    throw error;
  }
};


import { supabase } from './supabaseClient';
import {
  normalizeSubscriptionName,
  pickFallbackIconKey,
} from './provider-utils';
import type {
  Subscription,
  BillingCadence,
  FallbackIconKey,
  SubscriptionProvider,
} from '@/types/subscription';

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
  provider_id?: string | null;
  fallback_icon_key?: string | null;
  normalized_name?: string | null;
  subscription_providers?: ProviderRow | ProviderRow[] | null;
};

type ProviderRow = {
  id: string;
  slug: string;
  display_name: string;
  logo_path: string | null;
};

/**
 * Transform database row to Subscription type
 */
const transformRow = (row: SubscriptionRow): Subscription => {
  const providerEntry = Array.isArray(row.subscription_providers)
    ? row.subscription_providers[0]
    : row.subscription_providers;
  const provider = providerEntry ?? null;
  const fallbackIconKey = row.fallback_icon_key as FallbackIconKey | null | undefined;

  return {
    id: row.id,
    name: row.name,
    cost: row.cost,
    billingCycle: row.billing_cycle as BillingCadence,
    nextBillingDate: row.next_billing_date || '',
    currency: row.currency,
    providerId: row.provider_id ?? null,
    providerSlug: provider?.slug ?? null,
    providerName: provider?.display_name ?? null,
    logoPath: provider?.logo_path ?? null,
    fallbackIconKey: fallbackIconKey ?? null,
    normalizedName: row.normalized_name ?? null,
  };
};

const fetchProviderBySlug = async (
  slug: string
): Promise<SubscriptionProvider | null> => {
  if (!slug) {
    return null;
  }

  const { data, error } = await supabase
    .from('subscription_providers')
    .select('id, slug, display_name, logo_path, last_verified_at, notes')
    .eq('slug', slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription provider:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    displayName: data.display_name,
    logoPath: data.logo_path,
    lastVerifiedAt: data.last_verified_at ?? null,
    notes: data.notes ?? null,
  };
};

/**
 * Load subscriptions for a user from the database
 */
export const loadSubscriptions = async (userId: string): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        name,
        cost,
        currency,
        billing_cycle,
        next_billing_date,
        active,
        provider_id,
        fallback_icon_key,
        normalized_name,
        subscription_providers:subscription_providers (
          id,
          slug,
          display_name,
          logo_path
        )
      `)
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
    const normalizedName =
      subscription.normalizedName && subscription.normalizedName.length > 0
        ? subscription.normalizedName
        : normalizeSubscriptionName(subscription.name);

    let providerId: string | null = subscription.providerId ?? null;
    let fallbackIconKey: FallbackIconKey | null =
      subscription.fallbackIconKey ?? null;

    if (!providerId) {
      const provider = await fetchProviderBySlug(normalizedName);
      if (provider) {
        providerId = provider.id;
        fallbackIconKey = null;
      } else if (!fallbackIconKey) {
        fallbackIconKey = pickFallbackIconKey(normalizedName);
      }
    } else {
      fallbackIconKey = null;
    }

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
        provider_id: providerId,
        fallback_icon_key: fallbackIconKey,
        normalized_name: normalizedName,
      })
      .select(`
        id,
        user_id,
        name,
        cost,
        currency,
        billing_cycle,
        next_billing_date,
        active,
        provider_id,
        fallback_icon_key,
        normalized_name,
        subscription_providers:subscription_providers (
          id,
          slug,
          display_name,
          logo_path
        )
      `)
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
    const normalizedName =
      subscription.normalizedName && subscription.normalizedName.length > 0
        ? subscription.normalizedName
        : normalizeSubscriptionName(subscription.name);

    let providerId: string | null = subscription.providerId ?? null;
    let fallbackIconKey: FallbackIconKey | null =
      subscription.fallbackIconKey ?? null;

    if (!providerId) {
      const provider = await fetchProviderBySlug(normalizedName);
      if (provider) {
        providerId = provider.id;
        fallbackIconKey = null;
      } else if (!fallbackIconKey) {
        fallbackIconKey = pickFallbackIconKey(normalizedName);
      }
    } else {
      fallbackIconKey = null;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        name: subscription.name,
        cost: subscription.cost,
        currency: subscription.currency || 'USD',
        billing_cycle: subscription.billingCycle,
        next_billing_date: subscription.nextBillingDate,
        provider_id: providerId,
        fallback_icon_key: fallbackIconKey,
        normalized_name: normalizedName,
      })
      .eq('id', subscription.id)
      .eq('user_id', userId)
      .select(`
        id,
        user_id,
        name,
        cost,
        currency,
        billing_cycle,
        next_billing_date,
        active,
        provider_id,
        fallback_icon_key,
        normalized_name,
        subscription_providers:subscription_providers (
          id,
          slug,
          display_name,
          logo_path
        )
      `)
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

import { supabase } from './supabaseClient';
import type {
  SubscriptionProvider,
  FallbackIconKey,
} from '@/types/subscription';
import { PROVIDER_CATALOG } from '@/data/provider-catalog';
import { pickFallbackIconKey } from './provider-utils';

export type ProviderInput = {
  id?: string;
  slug: string;
  displayName: string;
  logoPath: string;
  lastVerifiedAt?: string | null;
  notes?: string | null;
};

export type UnmatchedSubscription = {
  id: string;
  userId: string | null;
  name: string;
  normalizedName: string | null;
  fallbackIconKey: FallbackIconKey | null;
  createdAt: string | null;
};

const mapProviderRow = (row: Record<string, unknown>): SubscriptionProvider => ({
  id: String(row.id),
  slug: String(row.slug),
  displayName: String(row.display_name),
  logoPath: typeof row.logo_path === 'string' ? row.logo_path : '',
  lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
  notes: (row.notes as string | null) ?? null,
});

export const loadProviders = async (): Promise<SubscriptionProvider[]> => {
  const { data, error } = await supabase
    .from('subscription_providers')
    .select('id, slug, display_name, logo_path, last_verified_at, notes')
    .order('slug', { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map(mapProviderRow);
};

let catalogCache: {
  providers: SubscriptionProvider[];
  fetchedAt: number;
} | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const loadProviderCatalog = async (): Promise<SubscriptionProvider[]> => {
  const now = Date.now();
  if (catalogCache && now - catalogCache.fetchedAt < CACHE_TTL) {
    return catalogCache.providers;
  }

  const { data, error } = await supabase
    .from('subscription_providers')
    .select('id, slug, display_name, logo_path, last_verified_at, notes')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('Error loading provider catalog:', error);
    // Fallback to local catalog if Supabase is unavailable or user lacks access
    const fallback = Object.values(PROVIDER_CATALOG);
    catalogCache = { providers: fallback, fetchedAt: now };
    return fallback;
  }

  if (!data) {
    const fallback = Object.values(PROVIDER_CATALOG);
    catalogCache = { providers: fallback, fetchedAt: now };
    return fallback;
  }

  const providers = data.map(mapProviderRow);
  catalogCache = { providers, fetchedAt: now };
  return providers;
};

export const upsertProvider = async (
  input: ProviderInput
): Promise<SubscriptionProvider> => {
  const payload: Record<string, unknown> = {
    slug: input.slug,
    display_name: input.displayName,
    logo_path: input.logoPath,
    last_verified_at: input.lastVerifiedAt ?? null,
    notes: input.notes ?? null,
  };

  if (input.id) {
    payload.id = input.id;
  }

  const { data, error } = await supabase
    .from('subscription_providers')
    .upsert(payload, { onConflict: 'slug' })
    .select('id, slug, display_name, logo_path, last_verified_at, notes')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No data returned from provider upsert');
  }

  return mapProviderRow(data as Record<string, unknown>);
};

export const deleteProvider = async (providerId: string): Promise<void> => {
  const { error } = await supabase
    .from('subscription_providers')
    .delete()
    .eq('id', providerId);

  if (error) {
    throw error;
  }
};

export const loadUnmatchedSubscriptions =
  async (): Promise<UnmatchedSubscription[]> => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, name, normalized_name, fallback_icon_key, created_at')
      .is('provider_id', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    if (!data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id ?? null,
      name: row.name,
      normalizedName: row.normalized_name ?? null,
      fallbackIconKey: (row.fallback_icon_key as FallbackIconKey | null) ?? null,
      createdAt: row.created_at ?? null,
    }));
  };

export const assignProviderToSubscription = async (
  subscriptionId: string,
  providerId: string | null,
  options?: { fallbackIconKey?: FallbackIconKey | null }
): Promise<void> => {
  const fallbackIconKey = providerId
    ? null
    : options?.fallbackIconKey ?? pickFallbackIconKey(subscriptionId);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      provider_id: providerId,
      fallback_icon_key: fallbackIconKey,
    })
    .eq('id', subscriptionId);

  if (error) {
    throw error;
  }
};

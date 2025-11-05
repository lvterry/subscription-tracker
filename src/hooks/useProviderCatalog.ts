import { useEffect, useMemo, useState } from 'react';
import { loadProviderCatalog } from '@/lib/provider-service';
import { PROVIDER_CATALOG } from '@/data/provider-catalog';
import { normalizeSubscriptionName } from '@/lib/provider-utils';
import type { SubscriptionProvider } from '@/types/subscription';

const MIN_QUERY_LENGTH = 2;

export type ProviderSearchResult = SubscriptionProvider & {
  score: number;
};

export const useProviderCatalog = (isAuthenticated: boolean) => {
  const [providers, setProviders] = useState<SubscriptionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isAuthenticated) {
          const remote = await loadProviderCatalog();
          if (!cancelled) {
            setProviders(remote);
          }
        } else {
          const local = Object.values(PROVIDER_CATALOG);
          if (!cancelled) {
            setProviders(local);
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load providers';
        if (!cancelled) {
          setError(message);
          const fallback = Object.values(PROVIDER_CATALOG);
          setProviders(fallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const providerMap = useMemo(() => {
    return new Map<string, SubscriptionProvider>(
      providers.map((provider) => [provider.slug, provider])
    );
  }, [providers]);

  const findBySlug = (slug: string) => providerMap.get(slug) ?? null;

  const findByDisplayName = (name: string) => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }
    return providers.find(
      (provider) => provider.displayName.trim().toLowerCase() === trimmed
    ) ?? null;
  };

  const search = (query: string): ProviderSearchResult[] => {
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }
    const normalizedQuery = normalizeSubscriptionName(query);
    const lowerQuery = query.trim().toLowerCase();

    const results = providers
      .map((provider) => {
        const normalizedName = normalizeSubscriptionName(provider.displayName);
        let score = 0;

        if (provider.displayName.trim().toLowerCase() === lowerQuery) {
          score = 120;
        } else if (normalizedQuery && provider.slug === normalizedQuery) {
          score = 100;
        } else if (normalizedQuery && provider.slug.startsWith(normalizedQuery)) {
          score = 80;
        } else if (normalizedQuery && normalizedName.startsWith(normalizedQuery)) {
          score = 70;
        } else if (provider.displayName.toLowerCase().includes(lowerQuery)) {
          score = 50;
        } else if (normalizedQuery && provider.slug.includes(normalizedQuery)) {
          score = 40;
        }

        return { provider, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => ({
        ...entry.provider,
        score: entry.score,
      }));

    return results;
  };

  return {
    providers,
    loading,
    error,
    findBySlug,
    findByDisplayName,
    search,
  } as const;
};

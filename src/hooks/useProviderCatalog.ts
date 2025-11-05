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
    return providers.reduce<Record<string, SubscriptionProvider>>((acc, provider) => {
      acc[provider.slug] = provider;
      return acc;
    }, {});
  }, [providers]);

  const findBySlug = (slug: string) => providerMap[slug] ?? null;

  const search = (query: string): ProviderSearchResult[] => {
    if (!query || query.length < MIN_QUERY_LENGTH) {
      return [];
    }
    const normalizedQuery = normalizeSubscriptionName(query);
    if (!normalizedQuery) {
      return [];
    }

    const results = providers
      .map((provider) => {
        const normalizedName = normalizeSubscriptionName(provider.displayName);
        let score = 0;

        if (provider.slug === normalizedQuery) {
          score = 100;
        } else if (provider.slug.startsWith(normalizedQuery)) {
          score = 80;
        } else if (normalizedName.startsWith(normalizedQuery)) {
          score = 70;
        } else if (provider.displayName.toLowerCase().includes(query.toLowerCase())) {
          score = 50;
        } else if (provider.slug.includes(normalizedQuery)) {
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
    search,
  };
};

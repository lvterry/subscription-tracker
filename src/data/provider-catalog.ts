import type { SubscriptionProvider } from '@/types/subscription';

export const PROVIDER_CATALOG: Record<string, SubscriptionProvider> = {
  netflix: {
    id: 'netflix',
    slug: 'netflix',
    displayName: 'Netflix',
    logoPath: '/logos/netflix.svg',
    lastVerifiedAt: null,
    notes: null,
  },
  'apple-music': {
    id: 'apple-music',
    slug: 'apple-music',
    displayName: 'Apple Music',
    logoPath: '/logos/apple-music.svg',
    lastVerifiedAt: null,
    notes: null,
  },
  spotify: {
    id: 'spotify',
    slug: 'spotify',
    displayName: 'Spotify',
    logoPath: '/logos/spotify.svg',
    lastVerifiedAt: null,
    notes: null,
  },
  chatgpt: {
    id: 'chatgpt',
    slug: 'chatgpt',
    displayName: 'ChatGPT',
    logoPath: '/logos/chatgpt.svg',
    lastVerifiedAt: null,
    notes: null,
  },
  'amazon-prime-video': {
    id: 'amazon-prime-video',
    slug: 'amazon-prime-video',
    displayName: 'Amazon Prime Video',
    logoPath: '/logos/amazon-prime-video.svg',
    lastVerifiedAt: null,
    notes: null,
  },
  'youtube-premium': {
    id: 'youtube-premium',
    slug: 'youtube-premium',
    displayName: 'YouTube Premium',
    logoPath: '/logos/youtube-premium.svg',
    lastVerifiedAt: null,
    notes: null,
  },
};

export const getProviderBySlug = (slug: string): SubscriptionProvider | null =>
  PROVIDER_CATALOG[slug] ?? null;

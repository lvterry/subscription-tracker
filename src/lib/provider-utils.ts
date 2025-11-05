import type { FallbackIconKey } from '@/types/subscription';

const FALLBACK_ICON_KEYS: FallbackIconKey[] = [
  'sparkles',
  'globe',
  'rocket',
  'wallet',
  'calendar',
];

/**
 * Normalize a subscription name into a provider slug.
 * Lowercases the string and replaces non-alphanumeric characters with dashes.
 */
export const normalizeSubscriptionName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Pick a fallback icon key, optionally deterministic via seed.
 */
export const pickFallbackIconKey = (seed?: string): FallbackIconKey => {
  if (!seed) {
    const index = Math.floor(Math.random() * FALLBACK_ICON_KEYS.length);
    return FALLBACK_ICON_KEYS[index];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  const index = Math.abs(hash) % FALLBACK_ICON_KEYS.length;
  return FALLBACK_ICON_KEYS[index];
};

export const getFallbackIconKeys = (): readonly FallbackIconKey[] => FALLBACK_ICON_KEYS;

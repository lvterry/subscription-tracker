import type { FallbackIconKey } from '@/types/subscription';

export const FALLBACK_ICON_MAP: Record<FallbackIconKey, string> = {
  sparkles: '✨',
  globe: '🌐',
  rocket: '🚀',
  wallet: '👛',
  calendar: '📅',
};

export const getFallbackEmoji = (
  key?: FallbackIconKey | null
): string | null => {
  if (!key) {
    return null;
  }
  return FALLBACK_ICON_MAP[key] ?? null;
};

import { useEffect, useMemo, useState } from 'react';
import { SubscriptionLogo } from '@/components/SubscriptionLogo';
import type { ProviderSearchResult } from '@/hooks/useProviderCatalog';

type ProviderSuggestionListProps = {
  results: ProviderSearchResult[];
  onSelect: (provider: ProviderSearchResult) => void;
  onClose: () => void;
  anchorId?: string;
};

export const ProviderSuggestionList = ({
  results,
  onSelect,
  onClose,
  anchorId,
}: ProviderSuggestionListProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (results.length === 0) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const active = results[activeIndex];
        if (active) {
          onSelect(active);
        }
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, activeIndex, onSelect, onClose]);

  const labelledBy = useMemo(() => {
    if (!anchorId) {
      return undefined;
    }
    return anchorId;
  }, [anchorId]);

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      role="listbox"
      aria-label="Service provider suggestions"
      aria-labelledby={labelledBy}
      className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg"
    >
      {results.map((provider, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={provider.id}
            type="button"
            role="option"
            aria-selected={isActive}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70'
            }`}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(provider);
            }}
          >
            <SubscriptionLogo
              providerName={provider.displayName}
              logoPath={provider.logoPath}
              fallbackIconKey={null}
              subscriptionName={provider.displayName}
              sizeClassName="h-8 w-8"
            />
            <div className="flex flex-col">
              <span className="font-medium">{provider.displayName}</span>
              <span className="text-xs text-muted-foreground">{provider.slug}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

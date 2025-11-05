import { useState } from 'react';
import { getFallbackEmoji } from '@/data/fallback-icons';
import type { FallbackIconKey } from '@/types/subscription';
import { cn } from '@/lib/utils';

type SubscriptionLogoProps = {
  providerName?: string | null;
  logoPath?: string | null;
  fallbackIconKey?: FallbackIconKey | null;
  subscriptionName: string;
  className?: string;
  sizeClassName?: string;
};

const baseWrapperClasses =
  'flex shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg';

export const SubscriptionLogo = ({
  providerName,
  logoPath,
  fallbackIconKey,
  subscriptionName,
  className,
  sizeClassName = 'h-12 w-12',
}: SubscriptionLogoProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const altText = providerName ?? subscriptionName;
  const fallbackEmoji = getFallbackEmoji(fallbackIconKey);

  if (logoPath && !imageFailed) {
    return (
      <div className={cn(baseWrapperClasses, sizeClassName, className)}>
        <img
          src={logoPath}
          alt={`${altText} logo`}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  if (fallbackEmoji) {
    return (
      <div className={cn(baseWrapperClasses, sizeClassName, className)}>
        <span role="img" aria-label={`${altText} symbol`}>
          {fallbackEmoji}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(baseWrapperClasses, sizeClassName, className)}>
      <span className="text-muted-foreground" aria-hidden="true">
        —
      </span>
      <span className="sr-only">{`${altText} placeholder`}</span>
    </div>
  );
};

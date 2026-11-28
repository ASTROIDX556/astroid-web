'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { isMockMode } from '@/lib/env';
import { getQueryErrorMessage } from '@/lib/query-error-handling';

export interface QueryErrorFallbackProps {
  /** Error thrown by the failed query. */
  error?: unknown;
  /** Callback invoked when the user clicks "Retry". */
  onRetry?: () => void;
  /** Disables the retry button and spins the icon while a refetch is in flight. */
  isRetrying?: boolean;
  /** Optional custom heading. */
  title?: string;
  /** Tighter padding for card-sized dashboard widgets. */
  compact?: boolean;
  /** Override offline detection (useful for testing or paused queries). */
  isOffline?: boolean;
  /** Extra classes for the fallback container. */
  className?: string;
}

/**
 * Tracks browser connectivity when mock mode is inactive (`NEXT_PUBLIC_API_URL` set).
 * In mock mode, queries resolve against local fixtures so offline state is ignored.
 */
export function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState<boolean>(() => {
    if (isMockMode || typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
  });

  useEffect(() => {
    if (isMockMode || typeof window === 'undefined') return undefined;

    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    setOffline(navigator.onLine === false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return offline;
}

/**
 * Reusable TanStack Query error & offline fallback card with design-token styling
 * and a "Retry" action button.
 */
export function QueryErrorFallback({
  error,
  onRetry,
  isRetrying = false,
  title,
  compact = false,
  isOffline: isOfflineProp,
  className,
}: QueryErrorFallbackProps) {
  const detectedOffline = useOfflineStatus();
  const isOffline = isOfflineProp ?? detectedOffline;

  const heading = title ?? (isOffline ? "You're offline" : 'Something went wrong');
  const message = isOffline
    ? 'Network connection is unavailable. Reconnect and retry to load live data.'
    : getQueryErrorMessage(error);

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-card border border-dashed text-center',
        isOffline
          ? 'border-warning/40 bg-warning-soft/30'
          : 'border-danger/40 bg-danger-soft/30',
        compact ? 'gap-2.5 p-5' : 'gap-4 p-10',
        className,
      )}
    >
      {isOffline ? (
        <WifiOff
          className={cn('text-warning', compact ? 'h-6 w-6' : 'h-8 w-8')}
          aria-hidden
        />
      ) : (
        <AlertTriangle
          className={cn('text-danger', compact ? 'h-6 w-6' : 'h-8 w-8')}
          aria-hidden
        />
      )}

      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            'font-display font-semibold tracking-tight text-foreground',
            compact ? 'text-sm' : 'text-lg',
          )}
        >
          {heading}
        </h3>
        <p className="max-w-sm text-xs text-foreground-secondary">{message}</p>
      </div>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw
            className={cn('mr-1.5 h-3.5 w-3.5', isRetrying && 'animate-spin')}
            aria-hidden
          />
          {isRetrying ? 'Retrying…' : 'Retry'}
        </Button>
      )}
    </div>
  );
}

'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { isMockMode } from '@/lib/env';
import {
  QueryErrorFallback,
  useOfflineStatus,
} from '@/components/dashboard/query-error-fallback';

export interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** Skeleton shown while the first fetch is in flight. */
  loading: React.ReactNode;
  /** Rendered with the resolved, non-nullish data. */
  children: (data: T) => React.ReactNode;
  /** Optional custom empty predicate + node (e.g. empty arrays). */
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  /** Heading for the first-load failure card. */
  errorTitle?: string;
  /** Called before the retry refetch, e.g. to clear a local filter. */
  onRetry?: () => void;
  /** Tighter spacing for card-sized dashboard widgets. */
  compact?: boolean;
}

const Fade = ({ children, keyName }: { children: React.ReactNode; keyName: string }) => (
  <motion.div
    key={keyName}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);

/**
 * Standardizes the loading / error / offline / empty / ready states for a query so
 * every page handles them consistently:
 * - Skeletons while loading
 * - Recoverable fallback card with retry on first-load failure or offline pause
 * - Non-blocking stale banner when a background refetch fails with cached data
 * - Optional illustrated empty state, then the content
 */
export function QueryBoundary<T>({
  query,
  loading,
  children,
  isEmpty,
  empty,
  onRetry,
  compact = false,
}: QueryBoundaryProps<T>) {
  const isOffline = useOfflineStatus();
  const data = query.data;
  const hasData = data !== undefined && data !== null;
  const isPausedOffline =
    !isMockMode && query.isPending && (query.fetchStatus === 'paused' || isOffline);

  const retry = () => {
    onRetry?.();
    void query.refetch();
  };

  const staleBanner = (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-card border border-warning/30 bg-warning-soft/40 px-3 py-2 text-2xs text-foreground-secondary"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span className="flex-1">
        Couldn’t refresh — showing the last data loaded.
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={retry}
        loading={query.isFetching}
      >
        Retry
      </Button>
    </div>
  );

  return (
    <div className={query.isError && hasData ? 'space-y-2' : undefined}>
      {query.isError && hasData && staleBanner}
      <AnimatePresence mode="wait">
        {isPausedOffline ? (
          <Fade keyName="offline">
            <QueryErrorFallback
              isOffline
              compact={compact}
              isRetrying={query.isFetching}
              onRetry={retry}
            />
          </Fade>
        ) : query.isPending ? (
          <Fade keyName="loading">{loading}</Fade>
        ) : !hasData ? (
          <Fade keyName="error">
            <QueryErrorFallback
              error={query.error}
              isOffline={isOffline}
              compact={compact}
              isRetrying={query.isFetching}
              onRetry={retry}
            />
          </Fade>
        ) : isEmpty && empty && isEmpty(data) ? (
          <Fade keyName="empty">{empty}</Fade>
        ) : (
          <Fade keyName="content">{children(data)}</Fade>
        )}
      </AnimatePresence>
    </div>
  );
}

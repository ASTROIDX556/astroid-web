'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { isMockMode } from '@/lib/env';
import {
  QueryErrorFallback,
  useOfflineStatus,
} from '@/components/dashboard/query-error-fallback';

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** Skeleton shown while the first fetch is in flight. */
  loading: React.ReactNode;
  /** Rendered with the resolved, non-nullish data. */
  children: (data: T) => React.ReactNode;
  /** Optional custom empty predicate + node (e.g. empty arrays). */
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  /** Tighter padding for card-sized dashboard widgets. */
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
 * every page handles them consistently: skeletons while loading, a recoverable
 * fallback card with retry on failure or offline pause, an optional illustrated
 * empty state, then the content.
 */
export function QueryBoundary<T>({
  query,
  loading,
  children,
  isEmpty,
  empty,
  compact = false,
}: QueryBoundaryProps<T>) {
  const isOffline = useOfflineStatus();
  const isPausedOffline =
    !isMockMode && query.isPending && (query.fetchStatus === 'paused' || isOffline);

  return (
    <AnimatePresence mode="wait">
      {isPausedOffline ? (
        <Fade keyName="offline">
          <QueryErrorFallback
            isOffline
            compact={compact}
            isRetrying={query.isFetching}
            onRetry={() => query.refetch()}
          />
        </Fade>
      ) : query.isPending ? (
        <Fade keyName="loading">{loading}</Fade>
      ) : query.isError || query.data === undefined || query.data === null ? (
        <Fade keyName="error">
          <QueryErrorFallback
            error={query.error}
            isOffline={isOffline}
            compact={compact}
            isRetrying={query.isFetching}
            onRetry={() => query.refetch()}
          />
        </Fade>
      ) : isEmpty && empty && isEmpty(query.data) ? (
        <Fade keyName="empty">{empty}</Fade>
      ) : (
        <Fade keyName="content">{children(query.data!)}</Fade>
      )}
    </AnimatePresence>
  );
}

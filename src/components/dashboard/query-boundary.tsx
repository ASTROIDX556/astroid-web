'use client';

import { useEffect, useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getQueryErrorMessage } from '@/lib/query-error-handling';
import { AnimatePresence, motion } from 'framer-motion';

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

/** SSR-safe browser connectivity read used to explain failures honestly. */
function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => {
      setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    };

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return offline;
}

/**
 * Standardizes the loading / error / empty / ready states for a query so every
 * page handles them consistently.
 *
 * Resilience rules (issue #521):
 * - A failed **first** fetch renders a recoverable error card with retry.
 * - A failed **background** refetch keeps the last good payload on screen and
 *   adds a non-blocking "could not refresh" banner, so a transient Stellar RPC
 *   blip never replaces a working dashboard with an error page.
 * - Offline and deterministic failures are explained instead of showing a raw
 *   exception message.
 */
export function QueryBoundary<T>({
  query,
  loading,
  children,
  isEmpty,
  empty,
  errorTitle = 'Something went wrong',
  onRetry,
  compact = false,
}: QueryBoundaryProps<T>) {
  const offline = useOfflineStatus();
  const data = query.data;
  const hasData = data !== undefined && data !== null;
  const message = query.error
    ? getQueryErrorMessage(query.error)
    : 'The data could not be loaded.';

  const retry = () => {
    onRetry?.();
    void query.refetch();
  };

  const errorCard = (
    <div
      role="alert"
      aria-live="polite"
      className={
        compact
          ? 'flex flex-col items-center gap-3 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-5 text-center'
          : 'flex flex-col items-center gap-4 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-10 text-center'
      }
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-danger-soft text-danger">
        {offline ? (
          <WifiOff className="h-5 w-5" aria-hidden />
        ) : (
          <AlertTriangle className="h-5 w-5" aria-hidden />
        )}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className={compact ? 'font-display text-sm font-semibold tracking-tight' : 'font-display text-lg font-semibold tracking-tight'}>
          {offline ? 'You are offline' : errorTitle}
        </h3>
        <p className="max-w-sm text-xs text-foreground-secondary">
          {offline
            ? 'This widget will refresh automatically once your connection is back.'
            : message}
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={retry}
        loading={query.isFetching}
        leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
        aria-label="Retry loading this data"
      >
        Try again
      </Button>
    </div>
  );

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
        {query.isPending ? (
          <Fade keyName="loading">{loading}</Fade>
        ) : !hasData ? (
          <Fade keyName="error">{errorCard}</Fade>
        ) : isEmpty && empty && isEmpty(data) ? (
          <Fade keyName="empty">{empty}</Fade>
        ) : (
          <Fade keyName="content">{children(data)}</Fade>
        )}
      </AnimatePresence>
    </div>
  );
}

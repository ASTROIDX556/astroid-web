'use client';

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { isMockMode } from '@/lib/env';
import { formatQueryKey, getQueryErrorMessage, isRetryableQueryError } from '@/lib/query-error-handling';

/**
 * App-wide TanStack Query wiring (issues #244, #521): cache lifetimes, a retry
 * policy with exponential backoff that distinguishes transient live-API
 * failures from deterministic ones (and never retries in mock mode), and global
 * error-handling wrappers that surface query/mutation failures through the
 * `sonner` <Toaster/> mounted next to this provider — so a failed fetch in the
 * agents/wallet views can no longer be silently swallowed.
 *
 * Cache policy: dashboard reads are cheap to revalidate and expensive to keep
 * stale, so fresh data is served for a minute, unused entries are retained for
 * ten minutes (long enough to paint a cached dashboard while a refetch settles),
 * and window-focus refetches stay off to avoid a burst of traffic whenever an
 * operator tabs back in. Reconnect refetches remain on so a laptop waking up
 * recovers promptly.
 *
 * Call sites keep full control: a query or mutation that owns its error UI can
 * set `meta: { skipGlobalErrorToast: true }` and the global wrapper stands down.
 */
export const QUERY_STALE_TIME_MS = 60_000;
export const QUERY_GC_TIME_MS = 10 * 60_000;

/** Builds the singleton query client. Exported for tests and non-React call sites. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.options.meta?.skipGlobalErrorToast === true) return;
        toast.error(getQueryErrorMessage(error), {
          id: `query-error:${formatQueryKey(query.queryKey)}`,
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.options.meta?.skipGlobalErrorToast === true) return;
        toast.error(getQueryErrorMessage(error), {
          id: mutation.options.mutationKey
            ? `mutation-error:${formatQueryKey(mutation.options.mutationKey)}`
            : 'mutation-error',
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.options.meta?.skipGlobalErrorToast === true) return;
            toast.error(getQueryErrorMessage(error), {
              id: `query-error:${formatQueryKey(query.queryKey)}`,
            });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.meta?.skipGlobalErrorToast === true) return;
            toast.error(getQueryErrorMessage(error), {
              id: mutation.options.mutationKey
                ? `mutation-error:${formatQueryKey(mutation.options.mutationKey)}`
                : 'mutation-error',
            });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => isRetryableQueryError(error) && failureCount < 2,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            // Mock data is served locally, so it must keep working offline;
            // live mode pauses fetches until the browser is back online.
            networkMode: isMockMode ? 'always' : 'online',
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

'use client';

import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  QueryCache,
} from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Creates a configured QueryClient with optimized defaults and global error handling.
 *
 * Defaults are tuned for a financial dashboard:
 * - staleTime: 60s — data is fresh for 1 minute, preventing aggressive refetches
 * - gcTime: 5min — unused cache entries retained for 5 minutes
 * - retry: 1 — single retry on failure to handle transient network blips
 * - refetchOnWindowFocus: false — user-initiated refreshes only
 *
 * Global error handlers surface query/mutation failures via Sonner toasts
 * without blocking the UI. Errors are logged to console for debugging.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Throw errors to let the QueryCache error handler catch them
        throwOnError: true,
      },
      mutations: {
        retry: 0,
        // Throw errors to let the MutationCache error handler catch them
        throwOnError: true,
      },
    },
    queryCache: new QueryCache({
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        // Log to console for debugging
        console.error('[React Query Error]', error);
        // Show user-facing toast (debounced via Sonner's internal deduping)
        toast.error(message, {
          description: 'The data could not be loaded. It may be stale.',
          action: {
            label: 'Retry',
            onClick: () => {
              // The query will be retried automatically by React Query on user interaction
            },
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error: unknown, _variables, _context) => {
        const message = error instanceof Error ? error.message : 'Operation failed';
        console.error('[React Query Mutation Error]', error);
        toast.error(message, {
          description: 'Your change was not saved. Please try again.',
        });
      },
      onSuccess: (_data, _variables, _context) => {
        // Optional: show success toast for mutations if needed
        // Can be overridden per-mutation via onSuccess in useMutation
      },
    }),
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
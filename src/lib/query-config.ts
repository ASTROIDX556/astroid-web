/**
 * Central TanStack Query timing configuration.
 *
 * Defaults are deliberately conservative: dashboard data is refetched in the
 * background by the Supabase realtime subscription, so focus refetches mostly
 * duplicate RPC calls to Stellar and the backend.
 */

/** Default freshness window for read-only dashboard queries. */
export const QUERY_STALE_TIME_MS = 5 * 60_000;

/** How long unused query data stays in memory before garbage collection. */
export const QUERY_GC_TIME_MS = 30 * 60_000;

/** Wallet balances move with on-chain activity; poll gently instead of on focus. */
export const WALLET_BALANCE_STALE_TIME_MS = 15_000;
export const WALLET_BALANCE_REFETCH_INTERVAL_MS = 30_000;

/** Agent status is also pushed over realtime, so polling is a safety net. */
export const AGENT_STATUS_STALE_TIME_MS = 10_000;
export const AGENT_STATUS_REFETCH_INTERVAL_MS = 30_000;

/** Asset rates are the one genuinely high-frequency dataset. */
export const ASSET_RATE_STALE_TIME_MS = 15_000;
export const ASSET_RATE_REFETCH_INTERVAL_MS = 30_000;

/** Shared query client defaults, spread into `defaultOptions.queries`. */
export const QUERY_CLIENT_QUERY_DEFAULTS = {
  staleTime: QUERY_STALE_TIME_MS,
  gcTime: QUERY_GC_TIME_MS,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

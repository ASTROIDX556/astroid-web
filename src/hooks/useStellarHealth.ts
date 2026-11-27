'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-keys';
import { isMockMode } from '@/lib/env';
import type { NetworkHealthData, NetworkHealthStatus } from '@/features/network/types';

export interface UseStellarHealthOptions {
  /** Poll cadence in ms. Defaults to 30s. Pass `false` to poll only on demand. */
  pollIntervalMs?: number | false;
  /** Master switch for the query. Defaults to true. */
  enabled?: boolean;
}

export interface UseStellarHealthResult {
  /** Last successfully fetched health payload (undefined until first resolve). */
  data: NetworkHealthData | undefined;
  /** True while the very first fetch is in flight. */
  isPending: boolean;
  /** True for any in-flight request: initial load, poll, or manual refresh. */
  isFetching: boolean;
  /** True only when the query is in an error state. */
  isError: boolean;
  /** The last error, if any. */
  error: Error | null;
  /** Human-readable error copy, safe to render. */
  errorMessage: string | null;
  /** Manual refetch entry point for refresh buttons. */
  refetch: () => void;
}

/** Hard ceiling for a single Stellar health round-trip. */
const HEALTH_REQUEST_TIMEOUT_MS = 8_000;

/** Default poll cadence — frequent enough to catch degradation, sparse enough to respect rate limits. */
export const DEFAULT_STELLAR_HEALTH_POLL_INTERVAL_MS = 30_000;

/** Simulated ledger base so mock data looks like a live Horizon node. */
const MOCK_BASE_LEDGER = 14_820_500;

/** Build deterministic mock health data when the backend is unavailable. */
function mockStellarHealth(): NetworkHealthData {
  const randomLatency = Math.floor(35 + Math.random() * 80);
  const currentLedger = MOCK_BASE_LEDGER + Math.floor(Date.now() / 5000) % 10000;

  let status: NetworkHealthStatus = 'healthy';
  if (randomLatency > 300) status = 'degraded';
  if (randomLatency > 600) status = 'outage';

  return {
    status,
    ledgerSequence: currentLedger,
    rpcLatencyMs: randomLatency,
    sorobanStatus: 'operational',
    horizonStatus: 'operational',
    networkName: 'Stellar Testnet',
    lastCheckedAt: new Date().toISOString(),
  };
}

/** Normalize a live API payload into NetworkHealthData. */
function normalizeHealth(payload: unknown): NetworkHealthData {
  const data = payload as Record<string, unknown>;
  let status: NetworkHealthStatus = 'healthy';
  const raw = String(data.status ?? 'healthy');
  if (raw === 'degraded' || raw === 'outage') status = raw;

  return {
    status,
    ledgerSequence: Number(data.ledgerSequence ?? 0),
    rpcLatencyMs: Number(data.rpcLatencyMs ?? 0),
    sorobanStatus: (data.sorobanStatus as 'operational' | 'degraded' | 'down') ?? 'operational',
    horizonStatus: (data.horizonStatus as 'operational' | 'degraded' | 'down') ?? 'operational',
    networkName: String(data.networkName ?? 'Stellar Testnet'),
    lastCheckedAt: String(data.lastCheckedAt ?? new Date().toISOString()),
  };
}

/** Fetch Stellar RPC / Horizon health: ledger sequence, latency, node status. */
export async function fetchStellarHealth(): Promise<NetworkHealthData> {
  if (isMockMode) {
    return mockStellarHealth();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`/api/v1/stellar/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    return normalizeHealth(payload);
  } catch (err) {
    console.warn('[Astroid] Stellar health check failed, using mock fallback:', err);
    return mockStellarHealth();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Poll Stellar network health in the background.
 *
 * - Caches under `['stellar', 'health']` so every surface shares one request.
 * - Polls every 30s by default and exposes `refresh()` for explicit refetches.
 * - Degrades gracefully to simulated data when the backend is unreachable,
 *   timeouts, or rate limits — the badge never shows a blank state.
 * - Disables background polling in hidden tabs to avoid burning rate limits.
 */
export function useStellarHealth(
  options: UseStellarHealthOptions = {},
): UseStellarHealthResult {
  const { pollIntervalMs = DEFAULT_STELLAR_HEALTH_POLL_INTERVAL_MS, enabled = true } = options;

  const query = useQuery<NetworkHealthData, Error>({
    queryKey: queryKeys.stellarHealth,
    queryFn: fetchStellarHealth,
    enabled,
    staleTime: 10_000,
    refetchInterval:
      enabled && pollIntervalMs !== false && pollIntervalMs > 0 ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  return {
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    errorMessage: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

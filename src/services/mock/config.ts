import { env } from '@/lib/env';

/**
 * Configurable mock-network behaviour.
 *
 * The mock provider mirrors a real backend closely enough that loading,
 * error, and retry paths are exercised in offline development:
 *
 * - `latencyMs` – base "server think time" applied to every mock request.
 * - `jitterMs`  – uniform random jitter added on top of the base latency so
 *   optimistic UI and skeletons do not resolve in lockstep.
 * - `failureRate` – probability that a request fails the way a flaky network
 *   would, letting developers verify TanStack Query retry/error states.
 *
 * All three are driven by `NEXT_PUBLIC_MOCK_*` environment variables (see
 * `.env.example`); zero latency disables the timers entirely.
 */
export interface MockProviderConfig {
  latencyMs: number;
  jitterMs: number;
  failureRate: number;
}

export function getMockConfig(): MockProviderConfig {
  return {
    latencyMs: env.mockLatencyMs,
    jitterMs: env.mockLatencyJitterMs,
    failureRate: env.mockFailureRate,
  };
}

/** Draw a delay for a single request: base latency plus uniform random jitter. */
export function nextMockLatencyMs(config: MockProviderConfig = getMockConfig()): number {
  if (config.latencyMs <= 0) return 0;
  const jitter = config.jitterMs > 0 ? Math.random() * config.jitterMs : 0;
  return Math.round(config.latencyMs + jitter);
}

/** Resolve after the simulated mock latency (no-op when latency is disabled). */
export function simulateMockLatency(config?: MockProviderConfig): Promise<void> {
  const delay = nextMockLatencyMs(config);
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** True when this request should fail like a flaky network. */
export function shouldSimulateMockFailure(config: MockProviderConfig = getMockConfig()): boolean {
  if (config.failureRate <= 0) return false;
  return Math.random() < config.failureRate;
}

/**
 * Runtime environment configuration.
 *
 * When `NEXT_PUBLIC_API_URL` is empty the client runs in mock mode and every
 * screen renders realistic data without a backend. Set the variable to point the
 * typed API client at a live Astroid API.
 */

/** Read an optional numeric env var, falling back when unset or invalid. */
function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  apiVersion: process.env.NEXT_PUBLIC_API_VERSION ?? '/api/v1',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Base simulated network latency (ms) for mock requests. Defaults to 320. */
  mockLatencyMs: readNumber(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS, 320),
  /** Random jitter (ms) added on top of the base mock latency. Defaults to 80. */
  mockLatencyJitterMs: readNumber(process.env.NEXT_PUBLIC_MOCK_LATENCY_JITTER_MS, 80),
  /** Probability in [0, 1] that a mock request fails transiently. Defaults to 0. */
  mockFailureRate: Math.min(1, readNumber(process.env.NEXT_PUBLIC_MOCK_FAILURE_RATE, 0)),
} as const;

/** True when no API base is configured — the app serves mock data. */
export const isMockMode = env.apiUrl.trim().length === 0;

/** True when Supabase credentials are configured — enables real-time subscriptions. */
export const isSupabaseConfigured =
  env.supabaseUrl.trim().length > 0 && env.supabaseAnonKey.trim().length > 0;

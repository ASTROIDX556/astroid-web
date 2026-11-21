/**
 * Runtime environment configuration.
 *
 * When `NEXT_PUBLIC_API_URL` is empty the client runs in mock mode and every
 * screen renders realistic data without a backend. Set the variable to point the
 * typed API client at a live Astroid API.
 */
import { z } from 'zod';

/** Parses a comma-separated env var into trimmed, non-empty values. */
function readList(value: string | undefined): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be a valid HTTP(S) URL');

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().trim().optional(),
  NEXT_PUBLIC_API_VERSION: z.string().trim().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().optional(),
  NEXT_PUBLIC_HORIZON_URL: z.string().trim().optional(),
});

export interface EnvironmentInput {
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_API_VERSION?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_HORIZON_URL?: string;
  NODE_ENV?: string;
}

export interface ValidatedEnvironment {
  apiUrl: string;
  apiVersion: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  horizonUrl: string;
  mockMode: boolean;
}

function validateOptionalUrl(
  name: string,
  value: string | undefined,
  malformed: string[],
): void {
  if (!value?.trim()) return;
  const result = httpUrlSchema.safeParse(value);
  if (!result.success) malformed.push(name);
}

export function validateEnvironment(input: EnvironmentInput): ValidatedEnvironment {
  const parsed = publicEnvironmentSchema.safeParse(input);
  if (!parsed.success) {
    const names = parsed.error.issues
      .map((issue) => issue.path.join('.'))
      .filter((name) => name.length > 0);
    throw new Error(`Invalid environment configuration: ${Array.from(new Set(names)).join(', ')}`);
  }

  const apiUrl = parsed.data.NEXT_PUBLIC_API_URL?.trim() ?? '';
  const supabaseUrl = parsed.data.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const supabaseAnonKey = parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  const horizonUrl =
    parsed.data.NEXT_PUBLIC_HORIZON_URL?.trim() || 'https://horizon.stellar.org';
  const missing: string[] = [];
  const malformed: string[] = [];

  validateOptionalUrl('NEXT_PUBLIC_API_URL', apiUrl || undefined, malformed);
  validateOptionalUrl('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl || undefined, malformed);
  validateOptionalUrl('NEXT_PUBLIC_HORIZON_URL', horizonUrl, malformed);

  if (input.NODE_ENV === 'production') {
    if (!apiUrl) missing.push('NEXT_PUBLIC_API_URL');
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`missing required variables: ${Array.from(new Set(missing)).join(', ')}`);
  }
  if (malformed.length > 0) {
    problems.push(`malformed variables: ${Array.from(new Set(malformed)).join(', ')}`);
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration (${problems.join('; ')})`);
  }

  return {
    apiUrl,
    apiVersion: parsed.data.NEXT_PUBLIC_API_VERSION?.trim() || '/api/v1',
    supabaseUrl,
    supabaseAnonKey,
    horizonUrl,
    mockMode: apiUrl.length === 0,
  };
}

export const validatedEnvironment = validateEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_VERSION: process.env.NEXT_PUBLIC_API_VERSION,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const env = {
  apiUrl: validatedEnvironment.apiUrl,
  apiVersion: validatedEnvironment.apiVersion,
  supabaseUrl: validatedEnvironment.supabaseUrl,
  supabaseAnonKey: validatedEnvironment.supabaseAnonKey,
  /** Stellar Horizon node used for live account balance polling. */
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon.stellar.org',
  /**
   * Same-network Horizon fallbacks tried when the primary is unreachable.
   * Comma-separated in `NEXT_PUBLIC_HORIZON_FALLBACK_URLS`.
   */
  horizonFallbackUrls: readList(process.env.NEXT_PUBLIC_HORIZON_FALLBACK_URLS),
  mockLatencyMs: readNumber(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS, 320),
  mockLatencyJitterMs: readNumber(process.env.NEXT_PUBLIC_MOCK_LATENCY_JITTER_MS, 80),
  mockFailureRate: Math.min(1, readNumber(process.env.NEXT_PUBLIC_MOCK_FAILURE_RATE, 0)),
} as const;

/** True when no API base is configured — the app serves mock data. */
export const isMockMode = env.apiUrl.trim().length === 0;

/** True when Supabase credentials are configured — enables real-time subscriptions. */
export const isSupabaseConfigured =
  env.supabaseUrl.trim().length > 0 && env.supabaseAnonKey.trim().length > 0;

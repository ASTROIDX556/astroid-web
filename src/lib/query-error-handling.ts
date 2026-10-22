import { AstroidApiError } from '@/services/client';
import { isMockMode } from '@/lib/env';

/**
 * Error contracts for the TanStack Query layer (issue #244).
 *
 * The provider wires these into global `QueryCache` / `MutationCache` handlers
 * so every async data fetch across the agent-management and wallet views gets
 * the same user-visible failure behaviour, instead of each screen inventing its
 * own. Keeping the classification logic here makes it reusable (and testable)
 * without importing the client component tree.
 *
 * Opt-out convention for call sites that own their error UI: pass
 * `meta: { skipGlobalErrorToast: true }` to `useQuery` / `useMutation` and the
 * global wrapper stands down. (`QueryMeta` is `Record<string, unknown>` in
 * this TanStack build, so no declaration merging is needed.)
 */

/**
 * Machine-readable `error.code` values from the API envelope
 * (`src/types/api.ts`) that describe a transient failure worth retrying.
 * Anything else (validation, auth, not-found) fails immediately.
 */
const RETRYABLE_API_ERROR_CODES = new Set([
  'NETWORK',
  'NETWORK_ERROR',
  'TIMEOUT',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'RATE_LIMIT',
  'RATE_LIMITED',
  'TOO_MANY_REQUESTS',
  'SERVER_ERROR',
  'INTERNAL_ERROR',
  'BAD_GATEWAY',
  'SERVICE_UNAVAILABLE',
]);

/**
 * Turns an unknown thrown value from a queryFn/mutationFn into a message that
 * is safe to show a user. `AstroidApiError` messages are already server-authored
 * copy; a `TypeError` is what `fetch` throws when the network itself is
 * unreachable; everything else falls back to a generic sentence rather than
 * leaking `undefined` or an object into the UI.
 */
export function getQueryErrorMessage(error: unknown): string {
  if (error instanceof AstroidApiError) {
    return error.message || 'The Astroid API returned an unexpected error.';
  }
  if (error instanceof TypeError) {
    return 'Cannot reach the Astroid API. Check your connection and try again.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong while loading this data.';
}

/**
 * Retry policy input: only transient failures are retried, and never in mock
 * mode (`NEXT_PUBLIC_API_URL` unset), where the resource layer already serves
 * fixture data and a rejection is deterministic app logic, not a blip.
 */
export function isRetryableQueryError(error: unknown): boolean {
  if (isMockMode) {
    return false;
  }
  if (error instanceof AstroidApiError) {
    return RETRYABLE_API_ERROR_CODES.has(error.code.toUpperCase());
  }
  // fetch() rejects with TypeError on DNS/connection failures — retry those.
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

/** Stable, human-readable string for a query/mutation key, used for toast ids. */
export function formatQueryKey(key: readonly unknown[]): string {
  return key.map((part) => String(part)).join('/');
}

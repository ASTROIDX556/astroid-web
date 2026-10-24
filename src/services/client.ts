import { env, isMockMode } from '@/lib/env';
import { AstroidApiError } from './errors';
import { resolveMockRequest } from './mock/handlers';
import type { ApiMeta, ApiResponse, ListQuery } from '@/types/api';

export { AstroidApiError } from './errors';

/** Extra query parameters the client serializes into the request URL. */
export type ApiRequestInit = RequestInit & { query?: ListQuery };

/** Unwrapped API response: the typed payload plus its pagination/context meta. */
export interface ApiResult<T> {
  data: T;
  meta: ApiMeta;
}

const TOKEN_KEY = 'astroid_token';

/** Read the stored JWT access token (client-side only). */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist a JWT access token after login. */
export function storeToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

/** Clear the stored token on logout. */
export function clearToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

function buildQuery(query?: ListQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.search) params.set('search', query.search);
  for (const [key, value] of Object.entries(query.filter ?? {})) {
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * The typed Astroid API client.
 *
 * Every method transparently switches transport:
 * - mock mode (`NEXT_PUBLIC_API_URL` unset) → the local handler registry in
 *   `services/mock/handlers` resolves the request with simulated latency;
 * - configured base URL → a real fetch against `${apiUrl}${apiVersion}` that
 *   unwraps the standard `{ success, data, meta, requestId }` envelope.
 *
 * The UI is agnostic to which path is active, and both paths throw the same
 * `AstroidApiError` for failed requests.
 *
 * Authorization: live requests automatically include
 * `Authorization: Bearer <token>` when a token is stored.
 */
export const apiClient = {
  isMock: isMockMode,

  async request<T>(path: string, init: ApiRequestInit = {}): Promise<ApiResult<T>> {
    if (isMockMode) {
      return resolveMockRequest<T>(path, init);
    }

    const { query, ...rest } = init;
    const url = `${env.apiUrl}${env.apiVersion}${path}${buildQuery(query)}`;

    const token = getStoredToken();
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
          ...(rest.headers ?? {}),
        },
      });
    } catch (err) {
      throw new AstroidApiError(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : `Unable to reach ${url}`,
      );
    }

    let body: ApiResponse<T>;
    try {
      body = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new AstroidApiError(
        'INVALID_RESPONSE',
        `Malformed API response from ${url} (HTTP ${res.status}).`,
      );
    }

    if (!body.success) {
      throw new AstroidApiError(body.error.code, body.error.message, body.requestId);
    }
    return { data: body.data, meta: body.meta };
  },
};

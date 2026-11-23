import { env, isMockMode } from '@/lib/env';
import { buildMockStellarAccountSnapshot } from '@/services/mock/stellar-account';
import type { StellarAccountBalance, StellarAccountSnapshot } from '@/types/stellar';

/**
 * Live Stellar account data source.
 *
 * `fetchStellarAccountSnapshot` reads an account from Horizon (balances, ledger
 * sequence, recent transaction activity) and normalizes it into the flat shape
 * the dashboard renders. Requests are abortable and bounded by a timeout so a
 * hanging node can never pin the wallet UI in a loading state. Failures are
 * raised as typed `StellarAccountError`s: the query layer decides whether to
 * retry, keep cached data, or fall back to fixtures.
 */

/** Public mainnet Horizon node; override with `NEXT_PUBLIC_HORIZON_URL`. */
export const DEFAULT_HORIZON_URL = 'https://horizon.stellar.org';

/** Hard ceiling for a single Horizon round-trip. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

/** Horizon caps a transactions page at 200 records. */
export const TRANSACTION_PAGE_LIMIT = 200;

/** Simulated latency for mock-mode snapshots so skeletons are exercised. */
const MOCK_LATENCY_MS = 220;

/** A Stellar public key: `G` + 55 base32 characters. */
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

export type StellarAccountErrorKind =
  | 'invalid_key'
  | 'not_found'
  | 'timeout'
  | 'network'
  | 'malformed';

export interface StellarAccountErrorOptions {
  retryable?: boolean;
  cause?: unknown;
}

export class StellarAccountError extends Error {
  readonly kind: StellarAccountErrorKind;

  /** True when retrying the same request has a chance of succeeding. */
  readonly retryable: boolean;

  constructor(
    kind: StellarAccountErrorKind,
    message: string,
    options: StellarAccountErrorOptions = {},
  ) {
    super(message);
    this.name = 'StellarAccountError';
    this.kind = kind;
    this.retryable = options.retryable ?? (kind === 'timeout' || kind === 'network');
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** Horizon balance entry (only the fields the wallet needs). */
interface HorizonBalanceRecord {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
}

/** Horizon account record (only the fields the wallet needs). */
interface HorizonAccountRecord {
  id?: string;
  sequence?: string;
  balances?: HorizonBalanceRecord[];
}

/** Horizon paginated transaction collection. */
interface HorizonTransactionsPage {
  _embedded?: { records?: unknown[] };
}

export interface FetchStellarAccountOptions {
  /** Caller-controlled cancellation, typically React Query's query signal. */
  signal?: AbortSignal;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

function isAbortError(error: unknown): boolean {
  // Fetch throws a DOMException (not an Error subclass in browsers/Node), so
  // detect cancellation by name instead of relying on `instanceof`.
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

function abortError(): DOMException {
  return new DOMException('The Stellar account request was cancelled.', 'AbortError');
}

/** Resolve after `ms`, rejecting early (and clearing the timer) on abort. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** GET a Horizon resource, mapping HTTP, network and timeout failures to typed errors. */
async function requestJson<T>(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const forwardAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      const isMissing = response.status === 404;
      throw new StellarAccountError(
        isMissing ? 'not_found' : 'network',
        isMissing
          ? 'The Stellar account does not exist on this network yet.'
          : `The Stellar network responded with HTTP ${response.status}.`,
        { retryable: !isMissing && (response.status >= 500 || response.status === 429) },
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof StellarAccountError) throw error;
    if (timedOut) {
      throw new StellarAccountError(
        'timeout',
        'The Stellar network request timed out before the account could be loaded.',
        { cause: error },
      );
    }
    // Caller cancellation is not a failure — let React Query discard it.
    if (signal?.aborted || isAbortError(error)) throw error;
    throw new StellarAccountError(
      'network',
      'Could not reach the Stellar network. Check your connection and try again.',
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/** Normalize Horizon balance entries into ledger amounts, native asset first. */
function toAccountBalances(
  records: HorizonBalanceRecord[] | undefined,
): StellarAccountBalance[] {
  if (!Array.isArray(records)) return [];

  const balances: StellarAccountBalance[] = [];

  for (const record of records) {
    const isNative = record.asset_type === 'native';
    const asset = isNative ? 'XLM' : record.asset_code?.toUpperCase();
    const amount = Number.parseFloat(record.balance ?? '');

    if (!asset || !Number.isFinite(amount)) continue;

    balances.push({
      asset,
      issuer: isNative ? null : record.asset_issuer ?? null,
      balance: amount,
    });
  }

  return balances.sort((a, b) => {
    if (a.asset === b.asset) return 0;
    if (a.asset === 'XLM') return -1;
    if (b.asset === 'XLM') return 1;
    return a.asset.localeCompare(b.asset);
  });
}

/**
 * Read recent transaction activity.
 *
 * Horizon has no aggregate counter, so the dashboard reports the size of the
 * most recent page and flags it as a lower bound once the page is full. A
 * failure here is non-fatal: balances still render with `transactionCount: null`.
 */
async function fetchRecentTransactionCount(
  publicKey: string,
  horizonUrl: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ count: number; isLowerBound: boolean } | null> {
  try {
    const page = await requestJson<HorizonTransactionsPage>(
      `${horizonUrl}/accounts/${encodeURIComponent(publicKey)}/transactions` +
        `?order=desc&limit=${TRANSACTION_PAGE_LIMIT}&include_failed=true`,
      timeoutMs,
      signal,
    );

    const records = page._embedded?.records;
    if (!Array.isArray(records)) return null;

    return {
      count: records.length,
      isLowerBound: records.length >= TRANSACTION_PAGE_LIMIT,
    };
  } catch (error) {
    // A cancelled request must still propagate; anything else degrades.
    if (signal?.aborted || isAbortError(error)) throw error;
    return null;
  }
}

function emptySnapshot(publicKey: string): StellarAccountSnapshot {
  return {
    publicKey,
    balances: [],
    sequence: null,
    transactionCount: 0,
    transactionCountIsLowerBound: false,
    source: 'horizon',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch a complete account snapshot for `publicKey`.
 *
 * In mock mode the deterministic fixture provider answers after a short delay;
 * otherwise the account is read from Horizon. An unfunded account (HTTP 404)
 * resolves to an empty snapshot rather than an error, so newly created wallets
 * render instead of failing.
 */
export async function fetchStellarAccountSnapshot(
  publicKey: string,
  options: FetchStellarAccountOptions = {},
): Promise<StellarAccountSnapshot> {
  const key = publicKey.trim();
  const { signal } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (!key) {
    throw new StellarAccountError(
      'invalid_key',
      'Connect a Stellar wallet before loading account balances.',
      { retryable: false },
    );
  }

  // Mock mode serves fixture wallets, whose addresses are illustrative rather
  // than checksum-valid — so only live reads enforce the key format.
  if (isMockMode) {
    await delay(MOCK_LATENCY_MS, signal);
    return buildMockStellarAccountSnapshot(key);
  }

  if (!STELLAR_PUBLIC_KEY_RE.test(key)) {
    throw new StellarAccountError(
      'invalid_key',
      'This wallet address is not a valid Stellar public key.',
      { retryable: false },
    );
  }

  const horizonUrl = (env.horizonUrl.trim() || DEFAULT_HORIZON_URL).replace(/\/+$/, '');
  const startedAt = Date.now();

  let account: HorizonAccountRecord;

  try {
    account = await requestJson<HorizonAccountRecord>(
      `${horizonUrl}/accounts/${encodeURIComponent(key)}`,
      timeoutMs,
      signal,
    );
  } catch (error) {
    // Unfunded accounts are a valid state, not a failure.
    if (error instanceof StellarAccountError && error.kind === 'not_found') {
      return emptySnapshot(key);
    }
    throw error;
  }

  if (account === null || typeof account !== 'object') {
    throw new StellarAccountError(
      'malformed',
      'The Stellar network returned an unexpected account payload.',
      { retryable: false },
    );
  }

  // Share one timeout budget across both reads so a slow node cannot double
  // the worst-case wait before the UI sees an error.
  const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
  const activity = await fetchRecentTransactionCount(key, horizonUrl, remainingMs, signal);

  return {
    publicKey: key,
    balances: toAccountBalances(account.balances),
    sequence: typeof account.sequence === 'string' ? account.sequence : null,
    transactionCount: activity?.count ?? null,
    transactionCountIsLowerBound: activity?.isLowerBound ?? false,
    source: 'horizon',
    fetchedAt: new Date().toISOString(),
  };
}

/** Coerce any account-fetch failure into one sentence that is safe to toast. */
export function describeStellarAccountError(error: unknown): string {
  if (error instanceof StellarAccountError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Wallet balances could not be refreshed. Check your connection and try again.';
}

import type { Transaction, TransactionStatus } from '@/types/domain';

/**
 * Pure, immutable filter + sort utilities for transaction history records.
 *
 * Nothing here mutates its inputs: `filterTransactions` always returns a new
 * array and `sortTransactions` sorts a copy, so the helpers are safe to call
 * from `useMemo` and against TanStack Query cache data.
 */

export interface TransactionFilterValues {
  /** Free-text search. Every whitespace-separated term must match some field. */
  query: string;
  /** A single status, or `'all'` for no constraint. */
  status: 'all' | TransactionStatus;
  /** A single asset code, or `'all'` for no constraint. */
  asset: string;
  agentId: string;
  /** Inclusive lower bound, `YYYY-MM-DD` (local time). Empty = unbounded. */
  dateFrom: string;
  /** Inclusive upper bound, `YYYY-MM-DD` (local time). Empty = unbounded. */
  dateTo: string;
  /**
   * Optional multi-select status filter (e.g. `['approved', 'pending']`).
   * When non-empty it takes precedence over the single `status` value.
   */
  statuses?: readonly TransactionStatus[];
  /** Optional multi-select asset filter; takes precedence over `asset` when non-empty. */
  assets?: readonly string[];
  /** Inclusive lower bound on `usdValue`. */
  minUsdValue?: number;
  /** Inclusive upper bound on `usdValue`. */
  maxUsdValue?: number;
}

export type TransactionSortKey = 'createdAt' | 'amount' | 'usdValue' | 'riskScore' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface TransactionSort {
  key: TransactionSortKey;
  direction: SortDirection;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Start-of-day (local) for a `YYYY-MM-DD` string, or null when empty/invalid. */
function parseBoundary(value: string, endOfDay: boolean): number | null {
  const match = DATE_ONLY_RE.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = endOfDay
    ? new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
    : new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Resolve the active status constraint (multi-select wins over single). */
function activeStatuses(filters: TransactionFilterValues): ReadonlySet<TransactionStatus> | null {
  if (filters.statuses && filters.statuses.length > 0) return new Set(filters.statuses);
  if (filters.status !== 'all') return new Set([filters.status]);
  return null;
}

function activeAssets(filters: TransactionFilterValues): ReadonlySet<string> | null {
  if (filters.assets && filters.assets.length > 0) return new Set(filters.assets);
  if (filters.asset !== 'all') return new Set([filters.asset]);
  return null;
}

function searchableText(transaction: Transaction): string {
  return [
    transaction.id,
    transaction.stellarHash,
    transaction.counterparty,
    transaction.counterpartyAddress,
    transaction.agentId,
    transaction.agentName,
    transaction.asset,
    transaction.amount,
    transaction.purpose,
    transaction.memo,
    transaction.status,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join('\u0000');
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  if (transactions.length === 0) return [];

  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const statuses = activeStatuses(filters);
  const assets = activeAssets(filters);
  let dateFrom = parseBoundary(filters.dateFrom, false);
  let dateTo = parseBoundary(filters.dateTo, true);

  // A reversed range (from > to) is treated as the same range the user meant,
  // rather than silently hiding every record.
  if (dateFrom !== null && dateTo !== null && dateFrom > dateTo) {
    const fromDay = parseBoundary(filters.dateTo, false);
    const toDay = parseBoundary(filters.dateFrom, true);
    dateFrom = fromDay;
    dateTo = toDay;
  }

  const { minUsdValue, maxUsdValue } = filters;

  return transactions.filter((transaction) => {
    if (statuses && !statuses.has(transaction.status)) return false;
    if (assets && !assets.has(transaction.asset)) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId) return false;

    if (dateFrom !== null || dateTo !== null) {
      const createdAt = Date.parse(transaction.createdAt);
      // Records with an unparseable timestamp can't be placed in a range.
      if (!Number.isFinite(createdAt)) return false;
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
    }

    if (isFiniteNumber(minUsdValue) && transaction.usdValue < minUsdValue) return false;
    if (isFiniteNumber(maxUsdValue) && transaction.usdValue > maxUsdValue) return false;

    if (terms.length === 0) return true;
    const haystack = searchableText(transaction);
    return terms.every((term) => haystack.includes(term));
  });
}

function compareValues(a: Transaction, b: Transaction, key: TransactionSortKey): number {
  switch (key) {
    case 'createdAt': {
      // Unparseable timestamps sort as the oldest records.
      const left = Number.isFinite(Date.parse(a.createdAt)) ? Date.parse(a.createdAt) : -Infinity;
      const right = Number.isFinite(Date.parse(b.createdAt)) ? Date.parse(b.createdAt) : -Infinity;
      if (left === right) return 0;
      return left < right ? -1 : 1;
    }
    case 'status':
      return a.status.localeCompare(b.status);
    default:
      return a[key] - b[key];
  }
}

/**
 * Returns a sorted copy. Ties fall back to id so the order is deterministic
 * (Array.prototype.sort is stable, but ids make cross-run output predictable).
 */
export function sortTransactions(
  transactions: readonly Transaction[],
  sort: TransactionSort,
): Transaction[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...transactions].sort((a, b) => {
    const result = compareValues(a, b, sort.key) * factor;
    return result !== 0 ? result : a.id.localeCompare(b.id);
  });
}

/** Convenience: filter then sort in one pass over a fresh array. */
export function filterAndSortTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilterValues,
  sort: TransactionSort,
): Transaction[] {
  return sortTransactions(filterTransactions(transactions, filters), sort);
}

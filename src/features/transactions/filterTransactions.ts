import type { Transaction, TransactionStatus } from '@/types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Presets that can be tagged onto the transaction filter state. */
export type TransactionPresetId = 'last-24h' | 'pending-approvals' | 'high-value';

export interface TransactionFilterPreset {
  id: TransactionPresetId;
  label: string;
  description: string;
}

/** Display metadata for the presets; matching itself lives in `matchesTransactionPreset`. */
export const TRANSACTION_FILTER_PRESETS: readonly TransactionFilterPreset[] = [
  {
    id: 'last-24h',
    label: 'Last 24 hours',
    description: 'Transactions created in the 24 hours up to now.',
  },
  {
    id: 'pending-approvals',
    label: 'Pending approvals',
    description: 'Transactions still waiting for a decision.',
  },
  {
    id: 'high-value',
    label: 'High value',
    description: 'Transactions worth at least 10,000 USD.',
  },
];

/** USD value at or above which a transaction counts as high value. */
export const HIGH_VALUE_USD_THRESHOLD = 10_000;

export interface TransactionFilterValues {
  query: string | null | undefined;
  status: 'all' | TransactionStatus;
  /**
   * Optional multi-status filter. When non-empty, only transactions whose status is
   * in this list are kept. An empty (or omitted) list applies no status restriction.
   * Combined with `status` using AND semantics.
   */
  statuses?: readonly TransactionStatus[];
  asset: string;
  agentId: string;
  /** Inclusive lower bound — `YYYY-MM-DD` (start of day, local time) or full ISO timestamp. */
  dateFrom: string;
  /** Inclusive upper bound — `YYYY-MM-DD` (end of day, local time) or full ISO timestamp. */
  dateTo: string;
  /** Optional multi-select asset filter; takes precedence over `asset` when non-empty. */
  assets?: readonly string[];
  /** Inclusive lower bound on `usdValue`. */
  minUsdValue?: number;
  /** Inclusive upper bound on `usdValue`. */
  maxUsdValue?: number;
  /**
   * Preset tags to apply alongside the explicit filters. Every active preset must
   * match, so selecting "last 24h" and "high value" narrows to high-value
   * transactions from the last day. Omitted or empty means no preset constraint.
   */
  presets?: readonly TransactionPresetId[];
}

export type TransactionSortKey = 'createdAt' | 'amount' | 'usdValue' | 'riskScore' | 'status';
export type SortDirection = 'asc' | 'desc';
export type TransactionSortDirection = SortDirection;
export type TransactionSortField = 'amount' | 'timestamp';

/**
 * Sort descriptors may name a domain field directly (`key`) or use the
 * chart/table vocabulary (`field: 'timestamp'`). Both forms are accepted so
 * callers written against either API keep working.
 */
export type TransactionSort =
  | { key: TransactionSortKey; direction: SortDirection; field?: never }
  | { field: TransactionSortField; direction: SortDirection; key?: never };

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function activeAssets(filters: TransactionFilterValues): ReadonlySet<string> | null {
  if (filters.assets && filters.assets.length > 0) {
    return new Set(filters.assets.map((asset) => asset.toLowerCase()));
  }
  if (filters.asset !== 'all') return new Set([filters.asset.toLowerCase()]);
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
    transaction.usdValue,
    transaction.purpose,
    transaction.memo,
    transaction.status,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join('\u0000');
}

export interface DateRangeBounds {
  from: number | null;
  to: number | null;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a date filter boundary. Date-only values snap to the start or end of that
 * local day; full timestamps are used as-is. Returns `null` for empty or invalid input
 * (including impossible calendar dates such as `2026-02-31`) so a malformed value never
 * silently filters out every row.
 */
export function parseDateBoundary(
  value: string | undefined,
  edge: 'start' | 'end',
): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date =
      edge === 'start'
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);
    const isRealDate =
      date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isRealDate ? date.getTime() : null;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Resolves the inclusive date range for the given filter boundaries. Invalid or empty
 * boundaries resolve to `null` (open-ended). A reversed range is preserved as-is and
 * therefore matches nothing.
 */
export function resolveDateRange(dateFrom: string, dateTo: string): DateRangeBounds {
  return {
    from: parseDateBoundary(dateFrom, 'start'),
    to: parseDateBoundary(dateTo, 'end'),
  };
}

/** Pure matcher for a single preset tag. */
export function matchesTransactionPreset(
  transaction: Transaction,
  preset: TransactionPresetId,
  now: number,
): boolean {
  switch (preset) {
    case 'last-24h': {
      const createdAt = Date.parse(transaction.createdAt);
      return Number.isFinite(createdAt) && createdAt >= now - DAY_MS && createdAt <= now;
    }
    case 'pending-approvals':
      return transaction.status === 'pending';
    case 'high-value':
      return transaction.usdValue >= HIGH_VALUE_USD_THRESHOLD;
  }
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilterValues,
  now: number = Date.now(),
): Transaction[] {
  if (transactions.length === 0) return [];

  const terms = (filters.query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const statusSet =
    filters.statuses && filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const assets = activeAssets(filters);
  const { from: dateFrom, to: dateTo } = resolveDateRange(filters.dateFrom, filters.dateTo);
  const hasDateRange = dateFrom !== null || dateTo !== null;
  const { minUsdValue, maxUsdValue } = filters;
  const presets = filters.presets ?? [];

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (statusSet && !statusSet.has(transaction.status)) return false;
    if (assets && !assets.has(transaction.asset.toLowerCase())) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId) return false;

    if (hasDateRange) {
      const createdAt = Date.parse(transaction.createdAt);
      if (!Number.isFinite(createdAt)) return false;
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
    }

    for (const preset of presets) {
      if (!matchesTransactionPreset(transaction, preset, now)) return false;
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

function resolveSortKey(sort: TransactionSort): TransactionSortKey {
  if ('key' in sort && sort.key) return sort.key;
  return sort.field === 'amount' ? 'amount' : 'createdAt';
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
  const key = resolveSortKey(sort);
  return [...transactions].sort((a, b) => {
    const result = compareValues(a, b, key) * factor;
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

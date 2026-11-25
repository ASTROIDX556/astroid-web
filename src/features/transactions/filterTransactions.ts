import type { Transaction, TransactionStatus } from '@/types/domain';

/**
 * Transaction history filtering and sorting (issue #548).
 *
 * The table owns presentation and `@tanstack/react-table` owns the interactive
 * sort state; this module is the single pure source of truth for the filter
 * vocabulary, the date-boundary maths, the search projection and the column
 * comparators. Keeping it framework-free makes every edge case testable.
 */

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/** Canonical lifecycle order: used for status sorting and dropdown options. */
export const TRANSACTION_STATUS_OPTIONS = [
  'draft',
  'pending',
  'approved',
  'submitting',
  'confirmed',
  'completed',
  'rejected',
  'expired',
  'cancelled',
  'failed',
] as const satisfies readonly TransactionStatus[];

export function isTransactionStatus(value: string | null): value is TransactionStatus {
  return (
    value !== null &&
    (TRANSACTION_STATUS_OPTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export interface TransactionFilterValues {
  query: string;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
}

/** Unconstrained state: every transaction is visible. */
export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterValues = {
  query: '',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
};

/** The minimal shape `URLSearchParams` and Next's read-only variant satisfy. */
export interface TransactionFilterParams {
  get(name: string): string | null;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a `YYYY-MM-DD` date-only value into a UTC timestamp, or `null` when it
 * is malformed or names an impossible day (e.g. `2026-02-30`). UTC keeps the
 * range identical for operators in every timezone.
 */
function parseDateOnly(value: string): number | null {
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  if (!yearText || !monthText || !dayText) return null;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

function dateBoundary(value: string, edge: 'start' | 'end'): number | null {
  const start = parseDateOnly(value);
  if (start === null) return null;
  return edge === 'end' ? start + DAY_IN_MS - 1 : start;
}

/** A date-only input that round-trips; otherwise `''` so the bound is ignored. */
function normalizeDateParam(value: string | null): string {
  if (!value || parseDateOnly(value) === null) return '';
  return value.trim();
}

/**
 * Validate and normalise a composite filter query string. Unknown statuses,
 * blank dropdown values and impossible calendar dates fall back to the
 * unconstrained defaults instead of silently hiding every row.
 */
export function parseTransactionFilters(
  params: TransactionFilterParams,
): TransactionFilterValues {
  const status = params.get('status');
  return {
    query: params.get('q') ?? '',
    status: isTransactionStatus(status) ? status : 'all',
    asset: params.get('asset')?.trim() || 'all',
    agentId: params.get('agent')?.trim() || 'all',
    dateFrom: normalizeDateParam(params.get('from')),
    dateTo: normalizeDateParam(params.get('to')),
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Every field the search box should reach. The table exposes only a subset as
 * columns, so the projection is explicit rather than derived from visible cells.
 */
function searchableValues(transaction: Transaction): string[] {
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
    transaction.direction,
  ]
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase());
}

/**
 * Apply every active criterion with AND semantics: search terms, status, asset,
 * agent and an inclusive UTC date range. An empty result is a valid outcome.
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  const terms = filters.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  const dateFrom = filters.dateFrom ? dateBoundary(filters.dateFrom, 'start') : null;
  const dateTo = filters.dateTo ? dateBoundary(filters.dateTo, 'end') : null;

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (filters.asset !== 'all' && transaction.asset !== filters.asset) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId) return false;

    const createdAt = Date.parse(transaction.createdAt);
    if (dateFrom !== null && (Number.isNaN(createdAt) || createdAt < dateFrom)) return false;
    if (dateTo !== null && (Number.isNaN(createdAt) || createdAt > dateTo)) return false;

    if (terms.length === 0) return true;
    const haystack = searchableValues(transaction);
    // Multi-word queries are composite: every term must appear somewhere.
    return terms.every((term) => haystack.some((value) => value.includes(term)));
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export const TRANSACTION_SORT_IDS = [
  'createdAt',
  'counterparty',
  'purpose',
  'agentName',
  'amount',
  'status',
  'riskScore',
] as const;

export type TransactionSortId = (typeof TRANSACTION_SORT_IDS)[number];

export type TransactionSortDirection = 'asc' | 'desc';

/** Newest first, matching the default transaction history view. */
export const DEFAULT_TRANSACTION_SORT: TransactionSort = {
  id: 'createdAt',
  desc: true,
};

export interface TransactionSort {
  id: TransactionSortId;
  desc: boolean;
}

function compareText(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** Unparseable timestamps sort as oldest so they sink to the bottom of a list. */
function transactionTimestamp(transaction: Transaction): number {
  const timestamp = Date.parse(transaction.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function statusRank(status: TransactionStatus): number {
  const rank = (TRANSACTION_STATUS_OPTIONS as readonly TransactionStatus[]).indexOf(status);
  return rank === -1 ? TRANSACTION_STATUS_OPTIONS.length : rank;
}

/**
 * Ascending comparator for one column, suitable for TanStack's `sortingFn` —
 * the table flips the sign itself for descending order. The `id` tie-break
 * keeps equal amounts, statuses and dates in a deterministic order.
 */
export function compareTransactionRows(
  a: Transaction,
  b: Transaction,
  id: TransactionSortId,
): number {
  let result = 0;
  switch (id) {
    case 'createdAt':
      result = transactionTimestamp(a) - transactionTimestamp(b);
      break;
    case 'counterparty':
      result = compareText(a.counterparty, b.counterparty);
      break;
    case 'purpose':
      result = compareText(a.purpose, b.purpose);
      break;
    case 'agentName':
      result = compareText(a.agentName, b.agentName);
      break;
    case 'amount':
      result = a.amount - b.amount;
      break;
    case 'status':
      result = statusRank(a.status) - statusRank(b.status);
      break;
    case 'riskScore':
      result = a.riskScore - b.riskScore;
      break;
  }
  return result !== 0 ? result : a.id.localeCompare(b.id);
}

/** Sort a copy of the collection in the requested direction; never mutates. */
export function sortTransactions(
  transactions: Transaction[],
  sort: TransactionSort = DEFAULT_TRANSACTION_SORT,
): Transaction[] {
  const factor = sort.desc ? -1 : 1;
  return [...transactions].sort(
    (a, b) => factor * compareTransactionRows(a, b, sort.id),
  );
}

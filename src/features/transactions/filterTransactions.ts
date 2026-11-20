import type { Transaction, TransactionStatus } from '@/types/domain';

export interface TransactionFilterValues {
  query: string;
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
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return isRealDate ? date.getTime() : null;
  }

  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Resolves the inclusive date range for the given filter boundaries. A reversed range
 * (from after to) is normalised by swapping the bounds rather than matching nothing.
 */
export function resolveDateRange(dateFrom: string, dateTo: string): DateRangeBounds {
  const from = parseDateBoundary(dateFrom, 'start');
  const to = parseDateBoundary(dateTo, 'end');
  if (from !== null && to !== null && from > to) {
    return {
      from: parseDateBoundary(dateTo, 'start'),
      to: parseDateBoundary(dateFrom, 'end'),
    };
  }
  return { from, to };
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  const statusSet =
    filters.statuses && filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const { from: dateFrom, to: dateTo } = resolveDateRange(
    filters.dateFrom,
    filters.dateTo,
  );
  const hasDateRange = dateFrom !== null || dateTo !== null;

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (statusSet && !statusSet.has(transaction.status)) return false;
    if (filters.asset !== 'all' && transaction.asset !== filters.asset) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId)
      return false;

    if (hasDateRange) {
      const createdAt = Date.parse(transaction.createdAt);
      if (!Number.isFinite(createdAt)) return false;
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
    }

    if (!query) return true;
    const searchableValues = [
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
    ];
    return searchableValues.some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(query),
    );
  });
}

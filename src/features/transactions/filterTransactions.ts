import type { Transaction, TransactionStatus } from '@/types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  query: string;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  /**
   * Preset tags to apply alongside the explicit filters. Every active preset must
   * match, so selecting "last 24h" and "high value" narrows to high-value
   * transactions from the last day. Omitted or empty means no preset constraint.
   */
  presets?: readonly TransactionPresetId[];
}

export interface TransactionDateRange {
  /** Inclusive lower bound in epoch milliseconds, or null when unbounded. */
  from: number | null;
  /** Inclusive upper bound in epoch milliseconds, or null when unbounded. */
  to: number | null;
}

/**
 * Parse a single date bound. Date-only values (`YYYY-MM-DD`) cover the whole UTC
 * day, so `from` starts at 00:00:00.000 and `to` ends at 23:59:59.999. Full
 * timestamps are used as-is. Empty or unparseable values become unbounded.
 */
function parseDateBoundary(value: string, edge: 'start' | 'end'): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const edgeTime = edge === 'start' ? '00:00:00.000' : '23:59:59.999';
  const normalized = DATE_ONLY_PATTERN.test(trimmed)
    ? `${trimmed}T${edgeTime}Z`
    : trimmed;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/** Resolve the picker's date inputs into inclusive epoch bounds without side effects. */
export function resolveTransactionDateRange(
  dateFrom: string,
  dateTo: string,
): TransactionDateRange {
  return {
    from: parseDateBoundary(dateFrom, 'start'),
    to: parseDateBoundary(dateTo, 'end'),
  };
}

/** Returns false for timestamps outside the inclusive range; invalid dates never match. */
export function isWithinTransactionDateRange(
  createdAt: string,
  range: TransactionDateRange,
): boolean {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return false;
  if (range.from !== null && timestamp < range.from) return false;
  if (range.to !== null && timestamp > range.to) return false;
  return true;
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
      return (
        Number.isFinite(createdAt) &&
        createdAt >= now - DAY_MS &&
        createdAt <= now
      );
    }
    case 'pending-approvals':
      return transaction.status === 'pending';
    case 'high-value':
      return transaction.usdValue >= HIGH_VALUE_USD_THRESHOLD;
  }
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
  now: number = Date.now(),
): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  const dateRange = resolveTransactionDateRange(filters.dateFrom, filters.dateTo);
  const presets = filters.presets ?? [];

  // An inverted range can never match; bail out before scanning the list.
  if (
    dateRange.from !== null &&
    dateRange.to !== null &&
    dateRange.from > dateRange.to
  ) {
    return [];
  }

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (filters.asset !== 'all' && transaction.asset !== filters.asset) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId)
      return false;

    if (!isWithinTransactionDateRange(transaction.createdAt, dateRange)) return false;

    for (const preset of presets) {
      if (!matchesTransactionPreset(transaction, preset, now)) return false;
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

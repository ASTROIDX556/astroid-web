import type { Transaction, TransactionStatus } from '@/types/domain';

/** Sentinel meaning "no constraint" for the dropdown-style filters. */
export const TRANSACTION_FILTER_ALL = 'all';

export interface TransactionFilterValues {
  query: string;
  status: 'all' | TransactionStatus;
  /** Asset code constraint; `'all'` or an empty string means no constraint. */
  asset: string;
  agentId: string;
  /** Inclusive lower bound (legacy name). A `YYYY-MM-DD` value is parsed as UTC midnight. */
  dateFrom: string;
  /** Inclusive upper bound (legacy name). A `YYYY-MM-DD` value is parsed as UTC end-of-day. */
  dateTo: string;
  /**
   * Inclusive lower bound for the date range (`YYYY-MM-DD`, or any ISO-8601
   * timestamp). When set it takes precedence over `dateFrom`.
   */
  startDate?: string;
  /**
   * Inclusive upper bound for the date range (`YYYY-MM-DD`, or any ISO-8601
   * timestamp). When set it takes precedence over `dateTo`.
   */
  endDate?: string;
  /**
   * Asset code constraint — `XLM`, `USDC`, or a custom Stellar asset. `'all'`
   * or an empty string means no constraint. When set it takes precedence over
   * `asset`.
   */
  assetType?: string;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the first non-empty, trimmed string from the candidates. */
function firstNonEmpty(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

/**
 * Parses one edge of the date range into a UTC epoch millisecond value.
 *
 * Day-only values (`YYYY-MM-DD`) are anchored in UTC — the lower edge at
 * `00:00:00.000Z` and the upper edge at `23:59:59.999Z` — so a transaction
 * stored with a `Z` timestamp can never drift out of a day because of the
 * viewer's time zone. Full ISO-8601 timestamps are honoured as-is. Malformed
 * values return `null`, which callers treat as "no bound" rather than
 * "matches nothing".
 */
export function parseTransactionDateBound(
  value: string | undefined,
  edge: 'start' | 'end',
): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const isoLike = DATE_ONLY_PATTERN.test(trimmed)
    ? `${trimmed}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`
    : trimmed;
  const timestamp = Date.parse(isoLike);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Resolves the asset constraint from the new and legacy filter fields. */
export function resolveTransactionAssetFilter(
  filters: Pick<TransactionFilterValues, 'asset' | 'assetType'>,
): string {
  const asset = firstNonEmpty(filters.assetType, filters.asset);
  return asset || TRANSACTION_FILTER_ALL;
}

/** Resolves the inclusive date range from the new and legacy filter fields. */
export function resolveTransactionDateRange(
  filters: Pick<TransactionFilterValues, 'dateFrom' | 'dateTo' | 'startDate' | 'endDate'>,
): { start: number | null; end: number | null } {
  return {
    start: parseTransactionDateBound(firstNonEmpty(filters.startDate, filters.dateFrom), 'start'),
    end: parseTransactionDateBound(firstNonEmpty(filters.endDate, filters.dateTo), 'end'),
  };
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  const assetType = resolveTransactionAssetFilter(filters);
  const { start: startTimestamp, end: endTimestamp } = resolveTransactionDateRange(filters);
  const hasDateBounds = startTimestamp !== null || endTimestamp !== null;

  return transactions.filter((transaction) => {
    if (filters.status !== TRANSACTION_FILTER_ALL && transaction.status !== filters.status) {
      return false;
    }
    if (
      assetType !== TRANSACTION_FILTER_ALL &&
      transaction.asset.trim() !== assetType
    ) {
      return false;
    }
    if (filters.agentId !== TRANSACTION_FILTER_ALL && transaction.agentId !== filters.agentId) {
      return false;
    }

    if (hasDateBounds) {
      const createdAt = Date.parse(transaction.createdAt);
      // A timestamp we cannot place on the timeline cannot satisfy a bounded
      // range; surface it as excluded instead of silently including it.
      if (!Number.isFinite(createdAt)) return false;
      if (startTimestamp !== null && createdAt < startTimestamp) return false;
      if (endTimestamp !== null && createdAt > endTimestamp) return false;
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

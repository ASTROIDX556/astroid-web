import type { Transaction, TransactionStatus } from '@/types/domain';

export interface TransactionFilterValues {
  query: string;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  /**
   * Alternate range bounds for callers that model the window as
   * start/end. When both spellings are present, `startDate`/`endDate` win.
   */
  startDate?: string;
  endDate?: string;
  /**
   * Alternate asset criterion (e.g. 'XLM', 'USDC', or a trustline code).
   * A concrete code takes precedence over `asset`; 'all'/empty defers to it.
   */
  assetType?: string;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  const rangeStart = filters.startDate || filters.dateFrom;
  const rangeEnd = filters.endDate || filters.dateTo;
  const assetFilter =
    filters.assetType && filters.assetType !== 'all'
      ? filters.assetType
      : filters.asset;
  // Date-only filters (`YYYY-MM-DD` from the date inputs) are interpreted as
  // UTC day boundaries so results do not depend on the operator's timezone.
  const dateFrom = rangeStart
    ? new Date(`${rangeStart}T00:00:00.000Z`).getTime()
    : null;
  const dateTo = rangeEnd
    ? new Date(`${rangeEnd}T23:59:59.999Z`).getTime()
    : null;

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (assetFilter !== 'all' && transaction.asset !== assetFilter) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId)
      return false;

    const createdAt = new Date(transaction.createdAt).getTime();
    if (Number.isFinite(dateFrom) && createdAt < dateFrom!) return false;
    if (Number.isFinite(dateTo) && createdAt > dateTo!) return false;

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

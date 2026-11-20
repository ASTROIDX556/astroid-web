import type { Transaction, TransactionStatus } from '@/types/domain';

export interface TransactionFilterValues {
  query: string | null | undefined;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
): Transaction[] {
  const query = (filters.query ?? '').trim().toLowerCase();
  const dateFrom = filters.dateFrom
    ? new Date(`${filters.dateFrom}T00:00:00`).getTime()
    : null;
  const dateTo = filters.dateTo
    ? new Date(`${filters.dateTo}T23:59:59.999`).getTime()
    : null;

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (
      filters.asset !== 'all' &&
      transaction.asset.toLowerCase() !== filters.asset.toLowerCase()
    ) return false;
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

export type TransactionSortField = 'amount' | 'timestamp';
export type TransactionSortDirection = 'asc' | 'desc';

export interface TransactionSort {
  field: TransactionSortField;
  direction: TransactionSortDirection;
}

/** Sort a copy of the transaction dataset without mutating the source array. */
export function sortTransactions(
  transactions: readonly Transaction[],
  sort: TransactionSort,
): Transaction[] {
  const direction = sort.direction === 'desc' ? -1 : 1;
  return [...transactions].sort((left, right) => {
    if (sort.field === 'amount') {
      return (left.amount - right.amount) * direction;
    }
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    const leftSafe = Number.isFinite(leftTime) ? leftTime : 0;
    const rightSafe = Number.isFinite(rightTime) ? rightTime : 0;
    return (leftSafe - rightSafe) * direction;
  });
}

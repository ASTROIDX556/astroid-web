import type { Transaction, TransactionStatus } from '@/types/domain';

export interface TransactionFilterValues {
  query: string;
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
  const query = filters.query.trim().toLowerCase();
  // YYYY-MM-DD filters describe UTC calendar days; parsing them as local time
  // would shift the boundaries and drop timestamps at the end of the day.
  const dateFrom = filters.dateFrom
    ? new Date(`${filters.dateFrom}T00:00:00.000Z`).getTime()
    : null;
  const dateTo = filters.dateTo
    ? new Date(`${filters.dateTo}T23:59:59.999Z`).getTime()
    : null;

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (filters.asset !== 'all' && transaction.asset !== filters.asset) return false;
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

/**
 * CSV export for transaction histories.
 *
 * Uses the shared serializer in `./csv`, so memos and asset codes containing
 * commas, quotes or newlines stay inside one column. Text cells beginning with
 * a spreadsheet formula character are neutralised on export.
 */

import type { Transaction } from '@/types/domain';
import { downloadCsv, serializeCsv, type CsvColumn } from './csv';

/** Inclusive `YYYY-MM-DD` boundaries used by the export date range picker. */
export interface TransactionDateRange {
  from: string;
  to: string;
}

function boundary(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const time = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Return only transactions created inside the inclusive date range. Either
 * boundary may be empty, in which case that side is unbounded.
 */
export function filterTransactionsByDateRange(
  transactions: readonly Transaction[],
  range: TransactionDateRange,
): Transaction[] {
  const from = boundary(range.from, false);
  const to = boundary(range.to, true);

  return transactions.filter((transaction) => {
    const createdAt = new Date(transaction.createdAt).getTime();
    if (from !== null && createdAt < from) return false;
    if (to !== null && createdAt > to) return false;
    return true;
  });
}

function isoTimestamp(value: string): string {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : value;
}

/**
 * Column order requested by finance/compliance: when, which hash, who sent,
 * who received, how much, which asset and the settlement status. `walletId`
 * stands in for Astroid's side of the transfer; the counterparty address is
 * the other side, depending on the transaction direction.
 */
export const TRANSACTION_CSV_COLUMNS: CsvColumn<Transaction>[] = [
  { header: 'Timestamp', value: (transaction) => isoTimestamp(transaction.createdAt) },
  { header: 'Hash', value: (transaction) => transaction.stellarHash ?? '' },
  {
    header: 'Sender',
    value: (transaction) =>
      transaction.direction === 'outbound'
        ? transaction.walletId
        : transaction.counterpartyAddress,
  },
  {
    header: 'Recipient',
    value: (transaction) =>
      transaction.direction === 'outbound'
        ? transaction.counterpartyAddress
        : transaction.walletId,
  },
  {
    header: 'Amount',
    value: (transaction) =>
      transaction.direction === 'outbound' ? -transaction.amount : transaction.amount,
  },
  { header: 'Asset', value: (transaction) => transaction.asset },
  { header: 'Status', value: (transaction) => transaction.status },
  { header: 'Memo', value: (transaction) => transaction.memo ?? '' },
];

/** Build the CSV string for a set of transactions, including the header row. */
export function serializeTransactionCsv(transactions: readonly Transaction[]): string {
  return serializeCsv(transactions, TRANSACTION_CSV_COLUMNS);
}

/** Trigger a browser download of the transactions as `text/csv`. */
export function downloadTransactionCsv(
  transactions: readonly Transaction[],
  filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
): void {
  downloadCsv(transactions, TRANSACTION_CSV_COLUMNS, filename);
}

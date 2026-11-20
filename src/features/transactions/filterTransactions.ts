import type { Transaction, TransactionStatus } from '@/types/domain';

export const TRANSACTION_FILTER_PRESETS = {
  all: 'All transactions',
  'last-24-hours': 'Last 24 hours',
  'pending-approvals': 'Pending approvals',
  'high-value': 'High value ($1,000+)',
} as const;

export type TransactionFilterPreset = keyof typeof TRANSACTION_FILTER_PRESETS;

export const TRANSACTION_FILTER_PRESET_IDS = Object.keys(
  TRANSACTION_FILTER_PRESETS,
) as TransactionFilterPreset[];

export const HIGH_VALUE_TRANSACTION_THRESHOLD_USD = 1_000;

export interface TransactionFilterValues {
  query: string;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
  preset: TransactionFilterPreset;
}

function parseDateBoundary(value: string, endOfDay: boolean): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;

  const timestamp = new Date(
    `${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`,
  ).getTime();
  const parsed = new Date(timestamp);
  const [year, month, day] = value.split('-').map(Number);
  return parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
    ? timestamp
    : Number.NaN;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilterValues,
  now: number = Date.now(),
): Transaction[] {
  const query = filters.query.trim().toLowerCase();
  const dateFrom = filters.dateFrom
    ? parseDateBoundary(filters.dateFrom, false)
    : null;
  const dateTo = filters.dateTo ? parseDateBoundary(filters.dateTo, true) : null;

  if (
    (filters.dateFrom && !Number.isFinite(dateFrom)) ||
    (filters.dateTo && !Number.isFinite(dateTo)) ||
    (dateFrom !== null && dateTo !== null && dateFrom > dateTo)
  ) {
    return [];
  }

  return transactions.filter((transaction) => {
    if (filters.status !== 'all' && transaction.status !== filters.status) return false;
    if (filters.asset !== 'all' && transaction.asset !== filters.asset) return false;
    if (filters.agentId !== 'all' && transaction.agentId !== filters.agentId)
      return false;

    if (filters.preset === 'pending-approvals' && transaction.status !== 'pending') {
      return false;
    }
    if (
      filters.preset === 'high-value' &&
      !(transaction.usdValue >= HIGH_VALUE_TRANSACTION_THRESHOLD_USD)
    ) {
      return false;
    }

    const hasDateConstraint =
      filters.preset === 'last-24-hours' || dateFrom !== null || dateTo !== null;
    const createdAt = hasDateConstraint
      ? new Date(transaction.createdAt).getTime()
      : null;
    if (hasDateConstraint && !Number.isFinite(createdAt)) return false;
    const timestamp = createdAt ?? Number.NaN;
    if (
      filters.preset === 'last-24-hours' &&
      (timestamp < now - 24 * 60 * 60 * 1000 || timestamp > now)
    ) {
      return false;
    }
    if (dateFrom !== null && timestamp < dateFrom) return false;
    if (dateTo !== null && timestamp > dateTo) return false;

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

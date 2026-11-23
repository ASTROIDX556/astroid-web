import type { Transaction, TransactionStatus } from '../../types/domain';

/**
 * Filtering primitives for the wallet transaction history table (#307).
 *
 * Status filters use the three audit buckets reviewers care about — success,
 * pending and failed — instead of exposing the raw Stellar lifecycle states.
 * Keeping the mapping here makes the table state, the empty-state copy and the
 * tests share one definition.
 */

export type TransactionStatusFilter = 'all' | 'success' | 'pending' | 'failed';

export type TransactionDateRange = 'all' | '24h' | '7d' | '30d' | '90d';

export interface TransactionFilters {
  status: TransactionStatusFilter;
  /** Agent id when available, otherwise the agent name. */
  agent: 'all' | string;
  asset: 'all' | string;
  dateRange: TransactionDateRange;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  status: 'all',
  agent: 'all',
  asset: 'all',
  dateRange: 'all',
};

export const TRANSACTION_STATUS_FILTERS: {
  value: TransactionStatusFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export const TRANSACTION_DATE_RANGES: {
  value: TransactionDateRange;
  label: string;
}[] = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const DATE_RANGE_MS: Record<Exclude<TransactionDateRange, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

export type TransactionStatusCategory = 'success' | 'pending' | 'failed';

const SUCCESS_STATUSES: ReadonlySet<TransactionStatus> = new Set<TransactionStatus>([
  'completed',
  'confirmed',
  'approved',
]);

const PENDING_STATUSES: ReadonlySet<TransactionStatus> = new Set<TransactionStatus>([
  'draft',
  'pending',
  'submitting',
]);

/** Map a raw transaction lifecycle status to an audit filter bucket. */
export function transactionStatusCategory(
  status: TransactionStatus,
): TransactionStatusCategory {
  if (SUCCESS_STATUSES.has(status)) return 'success';
  if (PENDING_STATUSES.has(status)) return 'pending';
  return 'failed';
}

export function transactionAgentKey(transaction: Transaction): string | null {
  return transaction.agentId ?? transaction.agentName ?? null;
}

export function matchesTransactionFilters(
  transaction: Transaction,
  filters: TransactionFilters,
  now: number = Date.now(),
): boolean {
  if (
    filters.status !== 'all' &&
    transactionStatusCategory(transaction.status) !== filters.status
  ) {
    return false;
  }

  if (filters.agent !== 'all') {
    const matchesId = transaction.agentId === filters.agent;
    const matchesName = transaction.agentName === filters.agent;
    if (!matchesId && !matchesName) return false;
  }

  if (filters.asset !== 'all' && transaction.asset !== filters.asset) {
    return false;
  }

  if (filters.dateRange !== 'all') {
    const timestamp = Date.parse(transaction.createdAt);
    if (Number.isNaN(timestamp)) return false;
    if (timestamp < now - DATE_RANGE_MS[filters.dateRange]) return false;
  }

  return true;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  now: number = Date.now(),
): Transaction[] {
  return transactions.filter((transaction) =>
    matchesTransactionFilters(transaction, filters, now),
  );
}

export function countActiveTransactionFilters(filters: TransactionFilters): number {
  return (
    (filters.status !== 'all' ? 1 : 0) +
    (filters.agent !== 'all' ? 1 : 0) +
    (filters.asset !== 'all' ? 1 : 0) +
    (filters.dateRange !== 'all' ? 1 : 0)
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Distinct agents in first-seen order; falls back to the name when no id. */
export function collectTransactionAgentOptions(
  transactions: Transaction[],
): FilterOption[] {
  const options = new Map<string, string>();
  for (const transaction of transactions) {
    const value = transactionAgentKey(transaction);
    if (!value || options.has(value)) continue;
    options.set(value, transaction.agentName ?? transaction.agentId ?? value);
  }
  return Array.from(options, ([value, label]) => ({ value, label }));
}

/** Distinct asset codes in first-seen order. */
export function collectTransactionAssetOptions(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((transaction) => transaction.asset)));
}

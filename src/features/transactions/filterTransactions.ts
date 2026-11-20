import type { Transaction, TransactionStatus } from '@/types/domain';

/**
 * Multi-criteria filtering for the transaction history dashboard (#531, #523).
 *
 * This module is the single source of truth for which transactions a set of
 * filter values matches. The dashboard keeps its filter-bar state in the
 * `TransactionFilterValues` shape and passes it straight to
 * `filterTransactions`; the UI never re-implements any of these rules.
 *
 * Criteria (all optional, all combined with AND):
 * - `asset`   — exact asset code (`'USDC'`, `'XLM'`, ...). `'all'` = any.
 * - `outcome` — broad status bucket: `'success'`, `'pending'` or `'failed'`
 *               (see `TRANSACTION_STATUS_OUTCOMES`). `'all'` = any.
 * - `status`  — one exact lifecycle status. `'all'` = any. When both `outcome`
 *               and `status` are set, a row must satisfy both.
 * - `agentId` — calling agent id. `'all'` = any.
 * - `query`   — free text, trimmed and matched case-insensitively as a
 *               substring of the id, hash, counterparty (name and address),
 *               agent, asset, amount, purpose, memo and status.
 * - `dateFrom` / `dateTo` — calendar days as `YYYY-MM-DD`, read in the
 *               viewer's local time zone. Both ends are inclusive: `dateFrom`
 *               starts at 00:00:00.000 and `dateTo` ends at 23:59:59.999.
 *               A value that is not a real `YYYY-MM-DD` date (empty, partial,
 *               `2026-02-30`, ...) is ignored rather than treated as an error.
 *               If `dateFrom` is after `dateTo` the two are swapped. While a
 *               date bound is active, transactions whose `createdAt` cannot be
 *               parsed are excluded, because they cannot be shown to be inside
 *               the range.
 *
 * Every field may be omitted, `null` or `undefined`, and the filters object
 * itself may be missing: unset criteria never exclude anything, so calling
 * with no filters returns every transaction (as a new array, in input order).
 */

export type TransactionStatusOutcome = 'success' | 'pending' | 'failed';

/** Which lifecycle statuses fall into each outcome bucket offered by the filter bar. */
export const TRANSACTION_STATUS_OUTCOMES: Record<
  TransactionStatusOutcome,
  readonly TransactionStatus[]
> = {
  success: ['approved', 'confirmed', 'completed'],
  pending: ['draft', 'pending', 'submitting'],
  failed: ['failed', 'rejected', 'expired', 'cancelled'],
};

export const TRANSACTION_STATUS_OUTCOME_LABELS: Record<TransactionStatusOutcome, string> = {
  success: 'Success',
  pending: 'Pending',
  failed: 'Failed',
};

export const TRANSACTION_STATUS_OUTCOME_IDS = Object.keys(
  TRANSACTION_STATUS_OUTCOMES,
) as TransactionStatusOutcome[];

/** Every lifecycle status, in workflow order. */
export const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
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
];

/** Filter-bar state. `'all'` / `''` mean "no constraint". */
export interface TransactionFilterValues {
  query: string;
  outcome: 'all' | TransactionStatusOutcome;
  status: 'all' | TransactionStatus;
  asset: string;
  agentId: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * Input accepted by `filterTransactions`: any subset of the filter-bar state,
 * where each field may also be `null` or `undefined`.
 */
export type TransactionFilterOptions = {
  [Key in keyof TransactionFilterValues]?: TransactionFilterValues[Key] | null;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterValues = {
  query: '',
  outcome: 'all',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
};

export function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && (TRANSACTION_STATUSES as readonly string[]).includes(value);
}

export function isTransactionStatusOutcome(value: unknown): value is TransactionStatusOutcome {
  return typeof value === 'string' && Object.hasOwn(TRANSACTION_STATUS_OUTCOMES, value);
}

export function getTransactionStatusOutcome(status: TransactionStatus): TransactionStatusOutcome {
  return (
    TRANSACTION_STATUS_OUTCOME_IDS.find((outcome) =>
      TRANSACTION_STATUS_OUTCOMES[outcome].includes(status),
    ) ?? 'pending'
  );
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` calendar day into a local-time timestamp at the start
 * (`'start'`) or the last millisecond (`'end'`) of that day. Returns `null`
 * for anything that is not a real calendar date.
 */
export function parseFilterDate(
  value: string | null | undefined,
  boundary: 'start' | 'end',
): number | null {
  if (typeof value !== 'string') return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date =
    boundary === 'start'
      ? new Date(year, monthIndex, day, 0, 0, 0, 0)
      : new Date(year, monthIndex, day, 23, 59, 59, 999);

  // `new Date` rolls invalid days over (2026-02-30 → 2026-03-02); reject those.
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date.getTime();
}

/** Normalises a select value: missing, blank or `'all'` all mean "no constraint". */
function constraint(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'all' ? null : trimmed;
}

function searchableText(transaction: Transaction): string {
  return [
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
  ]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase())
    .join('\u0000');
}

export function filterTransactions(
  transactions: readonly Transaction[] | null | undefined,
  filters?: TransactionFilterOptions | null,
): Transaction[] {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const query = typeof filters?.query === 'string' ? filters.query.trim().toLowerCase() : '';
  const asset = constraint(filters?.asset);
  const agentId = constraint(filters?.agentId);
  const status = isTransactionStatus(filters?.status) ? filters.status : null;
  const outcome = isTransactionStatusOutcome(filters?.outcome) ? filters.outcome : null;

  let dateFrom = parseFilterDate(filters?.dateFrom, 'start');
  let dateTo = parseFilterDate(filters?.dateTo, 'end');
  if (dateFrom !== null && dateTo !== null && dateFrom > dateTo) {
    // An inverted range is read as the same span typed the other way round.
    dateFrom = parseFilterDate(filters?.dateTo, 'start');
    dateTo = parseFilterDate(filters?.dateFrom, 'end');
  }

  return transactions.filter((transaction) => {
    if (asset !== null && transaction.asset !== asset) return false;
    if (status !== null && transaction.status !== status) return false;
    if (outcome !== null && !TRANSACTION_STATUS_OUTCOMES[outcome].includes(transaction.status)) {
      return false;
    }
    if (agentId !== null && transaction.agentId !== agentId) return false;

    if (dateFrom !== null || dateTo !== null) {
      const createdAt = Date.parse(transaction.createdAt);
      if (Number.isNaN(createdAt)) return false;
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
    }

    return query === '' || searchableText(transaction).includes(query);
  });
}

// ---------------------------------------------------------------------------
// Filter-bar helpers (shared by the dashboard UI and its URL state)
// ---------------------------------------------------------------------------

/** Number of criteria that currently narrow the list. */
export function countActiveTransactionFilters(filters: TransactionFilterOptions): number {
  let count = 0;
  if (typeof filters.query === 'string' && filters.query.trim() !== '') count += 1;
  if (isTransactionStatusOutcome(filters.outcome)) count += 1;
  if (isTransactionStatus(filters.status)) count += 1;
  if (constraint(filters.asset) !== null) count += 1;
  if (constraint(filters.agentId) !== null) count += 1;
  if (parseFilterDate(filters.dateFrom, 'start') !== null) count += 1;
  if (parseFilterDate(filters.dateTo, 'end') !== null) count += 1;
  return count;
}

/** URL search-param keys used to persist the filter bar. */
const PARAM_KEYS: Record<keyof TransactionFilterValues, string> = {
  query: 'q',
  outcome: 'outcome',
  status: 'status',
  asset: 'asset',
  agentId: 'agent',
  dateFrom: 'from',
  dateTo: 'to',
};

interface SearchParamsReader {
  get: (key: string) => string | null;
}

/** Reads filter values from URL params, dropping anything unrecognised. */
export function parseTransactionFilterParams(
  params: SearchParamsReader,
): TransactionFilterValues {
  const outcome = params.get(PARAM_KEYS.outcome);
  const status = params.get(PARAM_KEYS.status);
  const dateFrom = params.get(PARAM_KEYS.dateFrom) ?? '';
  const dateTo = params.get(PARAM_KEYS.dateTo) ?? '';
  return {
    query: params.get(PARAM_KEYS.query) ?? '',
    outcome: isTransactionStatusOutcome(outcome) ? outcome : 'all',
    status: isTransactionStatus(status) ? status : 'all',
    asset: constraint(params.get(PARAM_KEYS.asset)) ?? 'all',
    agentId: constraint(params.get(PARAM_KEYS.agentId)) ?? 'all',
    dateFrom: parseFilterDate(dateFrom, 'start') !== null ? dateFrom : '',
    dateTo: parseFilterDate(dateTo, 'end') !== null ? dateTo : '',
  };
}

/**
 * Writes filter values into a copy of `current`, removing keys whose value is
 * the "no constraint" default so shared URLs stay short.
 */
export function writeTransactionFilterParams(
  current: URLSearchParams,
  filters: TransactionFilterValues,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  (Object.keys(PARAM_KEYS) as (keyof TransactionFilterValues)[]).forEach((field) => {
    const value = field === 'query' ? filters.query.trim() : filters[field];
    if (value && value !== EMPTY_TRANSACTION_FILTERS[field]) params.set(PARAM_KEYS[field], value);
    else params.delete(PARAM_KEYS[field]);
  });
  return params;
}

/**
 * The status `<select>` offers outcome buckets and exact statuses in one list.
 * Its option values are prefixed so the two never collide (`pending` is both).
 */
export type TransactionStatusSelectValue =
  | 'all'
  | `outcome:${TransactionStatusOutcome}`
  | `status:${TransactionStatus}`;

export function toStatusSelectValue(
  filters: Pick<TransactionFilterValues, 'outcome' | 'status'>,
): TransactionStatusSelectValue {
  if (filters.status !== 'all') return `status:${filters.status}`;
  if (filters.outcome !== 'all') return `outcome:${filters.outcome}`;
  return 'all';
}

/** Maps a status `<select>` value back onto the `outcome`/`status` fields. */
export function fromStatusSelectValue(
  value: string,
): Pick<TransactionFilterValues, 'outcome' | 'status'> {
  const [kind, raw] = value.split(':');
  if (kind === 'outcome' && isTransactionStatusOutcome(raw)) return { outcome: raw, status: 'all' };
  if (kind === 'status' && isTransactionStatus(raw)) return { outcome: 'all', status: raw };
  return { outcome: 'all', status: 'all' };
}

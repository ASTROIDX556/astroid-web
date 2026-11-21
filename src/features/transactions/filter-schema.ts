/**
 * Runtime validation and localStorage persistence for the transaction history
 * filters (issue #573).
 *
 * Stored filters are untrusted input: a stale key from an older release, a
 * hand-edited devtools value or a partially written payload must never reach
 * the table. Every read is parsed as JSON and checked with a strict Zod schema
 * before it is applied, with defaults used whenever validation fails.
 */

import { z } from 'zod';
import type { TransactionStatus } from '@/types/domain';
import type { TransactionFilterValues } from './filterTransactions';

/** Namespaced, versioned key so unrelated app data cannot collide with filters. */
export const TRANSACTION_FILTER_STORAGE_KEY = 'astroid:transactions:filters:v1';

/** Every selectable status plus the "no constraint" sentinel. */
export const TRANSACTION_FILTER_STATUSES = [
  'all',
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
] as const satisfies readonly ('all' | TransactionStatus)[];

/**
 * Date inputs use the native `<input type="date">` format. Accept the empty
 * string for an unbounded side, otherwise require a real calendar date.
 */
const dateInputSchema = z.string().refine(
  (value) => {
    if (value === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  },
  { message: 'Expected a YYYY-MM-DD date' },
);

/**
 * Strict schema for one filter snapshot. Unknown keys are rejected so that an
 * outdated payload (for example a renamed `agent` field) cannot be silently
 * restored as an empty filter set.
 */
export const transactionFilterSchema = z
  .object({
    query: z.string().max(200),
    status: z.enum(TRANSACTION_FILTER_STATUSES),
    asset: z.string().max(120),
    agentId: z.string().max(120),
    dateFrom: dateInputSchema,
    dateTo: dateInputSchema,
  })
  .strict()
  .refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { message: 'dateFrom must not be after dateTo', path: ['dateTo'] },
  );

export type ValidatedTransactionFilters = z.infer<typeof transactionFilterSchema>;

/** Defaults applied whenever storage is unavailable, corrupt or invalid. */
export const DEFAULT_TRANSACTION_FILTER_VALUES: Readonly<TransactionFilterValues> =
  Object.freeze({
    query: '',
    status: 'all',
    asset: 'all',
    agentId: 'all',
    dateFrom: '',
    dateTo: '',
  });

/** Minimal storage contract, implemented by `localStorage` and test doubles. */
export interface TransactionFilterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): TransactionFilterStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Storage access can throw in private mode or when cookies are disabled.
    return null;
  }
}

/** Validate an already-read string. Returns `null` for any invalid payload. */
export function parseStoredTransactionFilters(
  raw: string | null | undefined,
): TransactionFilterValues | null {
  if (!raw) return null;
  try {
    const result = transactionFilterSchema.safeParse(JSON.parse(raw) as unknown);
    return result.success ? result.data : null;
  } catch {
    // Malformed JSON, including `undefined`/partial writes.
    return null;
  }
}

/**
 * Read the persisted filters without ever throwing. Corrupt payloads are also
 * removed so the next write starts from a clean key.
 */
export function readStoredTransactionFilters(
  storage: TransactionFilterStorage | null | undefined = browserStorage(),
): TransactionFilterValues | null {
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(TRANSACTION_FILTER_STORAGE_KEY);
  } catch {
    return null;
  }

  const filters = parseStoredTransactionFilters(raw);
  if (!filters && raw !== null) {
    try {
      storage.removeItem(TRANSACTION_FILTER_STORAGE_KEY);
    } catch {
      // Best-effort cleanup; defaults are still returned below.
    }
  }
  return filters;
}

/** Read valid stored filters, falling back to the caller's defaults. */
export function loadTransactionFilters(
  fallback: TransactionFilterValues = DEFAULT_TRANSACTION_FILTER_VALUES as TransactionFilterValues,
  storage: TransactionFilterStorage | null | undefined = browserStorage(),
): TransactionFilterValues {
  return readStoredTransactionFilters(storage) ?? fallback;
}

/** Persist a filter snapshot. Invalid state and storage failures are ignored. */
export function saveTransactionFilters(
  filters: TransactionFilterValues,
  storage: TransactionFilterStorage | null | undefined = browserStorage(),
): void {
  if (!storage) return;
  const result = transactionFilterSchema.safeParse(filters);
  if (!result.success) return;
  try {
    storage.setItem(TRANSACTION_FILTER_STORAGE_KEY, JSON.stringify(result.data));
  } catch {
    // Quota exceeded or storage disabled: filtering still works in memory.
  }
}

/** Explicitly clear the persisted snapshot (e.g. from a "Reset filters" action). */
export function clearStoredTransactionFilters(
  storage: TransactionFilterStorage | null | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(TRANSACTION_FILTER_STORAGE_KEY);
  } catch {
    // Nothing to do; persistence is best-effort.
  }
}

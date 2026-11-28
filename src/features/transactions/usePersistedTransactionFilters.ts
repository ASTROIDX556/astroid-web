'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { readStoredTransactionFilters, saveTransactionFilters } from './filter-schema';
import type { TransactionFilterValues } from './filterTransactions';

/**
 * React state for the transaction filters, backed by validated localStorage.
 *
 * The first render uses the URL-derived fallback so server and client markup
 * match; the stored snapshot is applied after mount, and every later change is
 * written back. Invalid or missing storage transparently keeps the fallback.
 */
export function usePersistedTransactionFilters(
  fallback: TransactionFilterValues,
): [TransactionFilterValues, Dispatch<SetStateAction<TransactionFilterValues>>] {
  const [filters, setFilters] = useState<TransactionFilterValues>(fallback);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const stored = readStoredTransactionFilters();
    if (stored) setFilters(stored);
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    saveTransactionFilters(filters);
  }, [filters, restored]);

  return [filters, setFilters];
}

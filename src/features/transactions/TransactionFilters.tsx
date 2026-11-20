'use client';

import { useId, useRef } from 'react';
import { FileSpreadsheet, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { transactionStatus } from '@/lib/status';
import type { Transaction } from '@/types/domain';
import {
  EMPTY_TRANSACTION_FILTERS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_OUTCOME_IDS,
  TRANSACTION_STATUS_OUTCOME_LABELS,
  countActiveTransactionFilters,
  fromStatusSelectValue,
  parseFilterDate,
  toStatusSelectValue,
  type TransactionFilterValues,
} from './filterTransactions';

interface TransactionFiltersProps {
  transactions: Transaction[];
  visibleTransactions: Transaction[];
  value: TransactionFilterValues;
  filteredCount: number;
  onChange: (value: TransactionFilterValues) => void;
  onExportCSV?: (transactions: Transaction[]) => void;
}

/**
 * Filter bar for the transaction history table (#523).
 *
 * Every control is a native, explicitly labelled form element (`<input
 * type="search">`, `<select>`, `<input type="date">`), so keyboard and screen
 * reader support come from the platform: Tab moves between controls, arrow
 * keys change a select, and the date inputs expose the browser's accessible
 * date picker. This component only edits filter state; matching rows is done
 * by `filterTransactions`, the single source of truth for the rules.
 */
export function TransactionFilters({
  transactions,
  visibleTransactions,
  value,
  filteredCount,
  onChange,
  onExportCSV,
}: TransactionFiltersProps) {
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const searchRef = useRef<HTMLInputElement>(null);

  const assets = Array.from(new Set(transactions.map((transaction) => transaction.asset))).sort();
  const agents = Array.from(
    new Map(
      transactions
        .filter((transaction) => transaction.agentId)
        .map((transaction) => [
          transaction.agentId as string,
          transaction.agentName ?? (transaction.agentId as string),
        ]),
    ),
  );
  const presentStatuses = TRANSACTION_STATUSES.filter((status) =>
    transactions.some((transaction) => transaction.status === status),
  );

  const activeCount = countActiveTransactionFilters(value);
  const hasFilters = activeCount > 0;
  const dateRangeInverted =
    (parseFilterDate(value.dateFrom, 'start') ?? -Infinity) >
    (parseFilterDate(value.dateTo, 'end') ?? Infinity);

  const update = (patch: Partial<TransactionFilterValues>) => onChange({ ...value, ...patch });

  const clearFilters = () => {
    onChange(EMPTY_TRANSACTION_FILTERS);
    // The Clear button unmounts once nothing is filtered; keep keyboard focus
    // in the filter bar instead of letting it fall back to <body>.
    searchRef.current?.focus();
  };

  const resultSummary =
    filteredCount === 0 && transactions.length > 0
      ? `No transactions match the ${activeCount === 1 ? 'active filter' : `${activeCount} active filters`}.`
      : `Showing ${filteredCount} of ${transactions.length} transactions${
          hasFilters ? ` (${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} active)` : ''
        }.`;

  return (
    <section aria-labelledby={fieldId('heading')} className="space-y-3">
      <h2 id={fieldId('heading')} className="sr-only">
        Filter transactions
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-3 xl:col-span-2">
          <label htmlFor={fieldId('query')} className="text-xs font-medium text-foreground">
            Search transactions
          </label>
          <Input
            ref={searchRef}
            id={fieldId('query')}
            type="search"
            value={value.query}
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Memo, counterparty, hash, agent..."
            leftIcon={<Search className="h-4 w-4" aria-hidden />}
            autoComplete="off"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={fieldId('asset')} className="text-xs font-medium text-foreground">
            Asset
          </label>
          <Select
            id={fieldId('asset')}
            value={value.asset}
            onChange={(event) => update({ asset: event.target.value })}
          >
            <option value="all">All assets</option>
            {assets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={fieldId('status')} className="text-xs font-medium text-foreground">
            Status
          </label>
          <Select
            id={fieldId('status')}
            value={toStatusSelectValue(value)}
            onChange={(event) => update(fromStatusSelectValue(event.target.value))}
          >
            <option value="all">All statuses</option>
            <optgroup label="Outcome">
              {TRANSACTION_STATUS_OUTCOME_IDS.map((outcome) => (
                <option key={outcome} value={`outcome:${outcome}`}>
                  {TRANSACTION_STATUS_OUTCOME_LABELS[outcome]}
                </option>
              ))}
            </optgroup>
            {presentStatuses.length > 0 && (
              <optgroup label="Exact status">
                {presentStatuses.map((status) => (
                  <option key={status} value={`status:${status}`}>
                    {transactionStatus(status).label}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor={fieldId('agent')} className="text-xs font-medium text-foreground">
            Agent
          </label>
          <Select
            id={fieldId('agent')}
            value={value.agentId}
            onChange={(event) => update({ agentId: event.target.value })}
          >
            <option value="all">All agents</option>
            {agents.map(([agentId, agentName]) => (
              <option key={agentId} value={agentId}>
                {agentName}
              </option>
            ))}
          </Select>
        </div>

        <fieldset
          className="grid min-w-0 grid-cols-2 gap-3 sm:col-span-2 lg:col-span-3 xl:col-span-2"
          aria-describedby={dateRangeInverted ? fieldId('date-note') : undefined}
        >
          <legend className="sr-only">Date range</legend>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={fieldId('from')} className="text-xs font-medium text-foreground">
              From date
            </label>
            <Input
              id={fieldId('from')}
              type="date"
              value={value.dateFrom}
              max={value.dateTo || undefined}
              onChange={(event) => update({ dateFrom: event.target.value })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={fieldId('to')} className="text-xs font-medium text-foreground">
              To date
            </label>
            <Input
              id={fieldId('to')}
              type="date"
              value={value.dateTo}
              min={value.dateFrom || undefined}
              onChange={(event) => update({ dateTo: event.target.value })}
            />
          </div>
          {dateRangeInverted && (
            <p
              id={fieldId('date-note')}
              className="col-span-2 text-2xs text-foreground-secondary"
            >
              The start date is after the end date, so the range is applied in reverse.
            </p>
          )}
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-muted">
          <p role="status" aria-live="polite" aria-atomic="true">
            {resultSummary}
          </p>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              leftIcon={<X className="h-3.5 w-3.5" aria-hidden />}
            >
              Clear filters
            </Button>
          )}
        </div>
        {onExportCSV && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onExportCSV(visibleTransactions)}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />
            Export CSV
          </Button>
        )}
      </div>
    </section>
  );
}

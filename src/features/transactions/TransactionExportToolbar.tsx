'use client';

import { Input } from '@/components/ui/input';
import {
  downloadTransactionCsv,
  filterTransactionsByDateRange,
} from '@/lib/transaction-csv';
import type { Transaction } from '@/types/domain';
import { downloadTransactionExport } from './exportUtils';
import { TransactionExportActions } from './TransactionExportActions';

interface TransactionExportToolbarProps {
  /** Transactions that already match the active table filters. */
  transactions: readonly Transaction[];
  dateFrom: string;
  dateTo: string;
  onDateRangeChange: (range: { dateFrom: string; dateTo: string }) => void;
}

/**
 * Header toolbar for the transaction history: the date range narrows both the
 * table below and the rows written to the downloaded files. CSV uses the
 * shared serializer in `@/lib/csv`; JSON reuses the upstream export pipeline.
 * Surface, border, gold and shadow utilities all resolve to tokens in
 * `src/styles/tokens.css`.
 */
export function TransactionExportToolbar({
  transactions,
  dateFrom,
  dateTo,
  onDateRangeChange,
}: TransactionExportToolbarProps) {
  const exportable = filterTransactionsByDateRange(transactions, {
    from: dateFrom,
    to: dateTo,
  });

  return (
    <section
      id="transaction-export"
      aria-label="Transaction export"
      className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-surface p-4 shadow-soft-1"
    >
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export transactions</h2>
          <p className="mt-1 text-xs text-foreground-secondary">
            Choose a date range to filter the table and download an auditable
            CSV or JSON file of those records.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="gap-1.5 flex min-w-0 flex-col">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">
              From
            </span>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) =>
                onDateRangeChange({ dateFrom: event.target.value, dateTo })
              }
              aria-label="Export transactions from date"
            />
          </label>
          <label className="gap-1.5 flex min-w-0 flex-col">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">
              To
            </span>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) =>
                onDateRangeChange({ dateFrom, dateTo: event.target.value })
              }
              aria-label="Export transactions to date"
            />
          </label>
        </div>

        <p className="tabular text-2xs text-foreground-muted" aria-live="polite">
          {exportable.length} {exportable.length === 1 ? 'transaction' : 'transactions'}{' '}
          in range
        </p>
      </div>

      <TransactionExportActions
        rows={exportable}
        onExportCSV={(rows) => downloadTransactionCsv(rows)}
        onExportJSON={(rows) =>
          downloadTransactionExport(rows, { format: 'json' })
        }
      />
    </section>
  );
}

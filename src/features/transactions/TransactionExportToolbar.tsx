'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  downloadTransactionCsv,
  filterTransactionsByDateRange,
} from '@/lib/transaction-csv';
import type { Transaction } from '@/types/domain';

interface TransactionExportToolbarProps {
  transactions: readonly Transaction[];
  dateFrom: string;
  dateTo: string;
  onDateRangeChange: (range: { dateFrom: string; dateTo: string }) => void;
}

/**
 * Header toolbar for the transaction history: the date range filters both the
 * table below and the rows written to the downloaded CSV. Surface, border,
 * gold and shadow utilities all resolve to tokens in `src/styles/tokens.css`.
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
            Choose a date range to filter the table and download an auditable CSV of
            those records.
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

      <Button
        type="button"
        variant="gold"
        size="sm"
        leftIcon={<Download className="h-4 w-4" aria-hidden />}
        disabled={exportable.length === 0}
        onClick={() => downloadTransactionCsv(exportable)}
      >
        Export CSV
      </Button>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import type { Transaction } from '@/types/domain';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionHistoryTableProps {
  transactions: Transaction[];
  className?: string;
}

type StatusFilterValue = 'all' | 'success' | 'failed' | 'pending';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusFilterMap: Record<StatusFilterValue, string[]> = {
  all: [],
  success: ['completed', 'confirmed', 'approved'],
  failed: ['failed', 'rejected', 'cancelled', 'expired'],
  pending: ['pending', 'draft', 'submitting'],
};

function matchesStatusFilter(tx: Transaction, filter: StatusFilterValue): boolean {
  if (filter === 'all') return true;
  return statusFilterMap[filter].includes(tx.status);
}

function exportCSV(transactions: Transaction[]) {
  const headers = ['Hash', 'Timestamp', 'Agent', 'Amount', 'Asset', 'Status', 'Risk'];
  const rows = transactions.map((t) => [
    t.stellarHash ?? t.id,
    t.createdAt,
    t.agentName ?? '',
    t.amount.toString(),
    t.asset,
    t.status,
    t.riskScore.toString(),
  ]);
  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-transactions-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionHistoryTable({ transactions, className }: TransactionHistoryTableProps) {
  // --- Filter state ---
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 8;

  // --- Derived agent list ---
  const agentNames = useMemo(() => {
    const names = new Set(transactions.map((t) => t.agentName).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [transactions]);

  // --- Filtered data ---
  const filtered = useMemo(() => {
    let result = transactions;

    if (agentFilter) {
      const lower = agentFilter.toLowerCase();
      result = result.filter((t) => t.agentName?.toLowerCase().includes(lower));
    }

    if (statusFilter !== 'all') {
      result = result.filter((t) => matchesStatusFilter(t, statusFilter));
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      result = result.filter((t) => new Date(t.createdAt).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo).setHours(23, 59, 59, 999);
      result = result.filter((t) => new Date(t.createdAt).getTime() <= to);
    }

    return result;
  }, [transactions, agentFilter, statusFilter, dateFrom, dateTo]);

  // --- Pagination ---
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const summaryStart = filtered.length === 0 ? 0 : currentPage * pageSize + 1;
  const summaryEnd = Math.min(summaryStart + pageSize - 1, filtered.length);

  // Reset to first page when filters change
  const resetFilters = () => {
    setAgentFilter('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(0);
  };

  const hasActiveFilters = Boolean(agentFilter || statusFilter !== 'all' || dateFrom || dateTo);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
            leftIcon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          >
            Filters
            {hasActiveFilters && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold text-2xs font-bold text-gold-foreground">
                !
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-2xs font-semibold text-gold-strong hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => exportCSV(filtered)}
          leftIcon={<Download className="h-3.5 w-3.5" aria-hidden />}
        >
          Export CSV
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-card border border-border bg-surface-secondary/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Agent filter */}
            <div className="space-y-1.5">
              <label
                htmlFor="txn-agent-filter"
                className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
              >
                Agent
              </label>
              <select
                id="txn-agent-filter"
                value={agentFilter}
                onChange={(e) => {
                  setAgentFilter(e.target.value);
                  setCurrentPage(0);
                }}
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All agents</option>
                {agentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <label
                htmlFor="txn-status-filter"
                className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
              >
                Status
              </label>
              <select
                id="txn-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilterValue);
                  setCurrentPage(0);
                }}
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Date from */}
            <div className="space-y-1.5">
              <label
                htmlFor="txn-date-from"
                className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
              >
                From
              </label>
              <input
                id="txn-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(0);
                }}
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Date to */}
            <div className="space-y-1.5">
              <label
                htmlFor="txn-date-to"
                className="text-2xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
              >
                To
              </label>
              <input
                id="txn-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(0);
                }}
                className="h-9 w-full rounded-button border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/40">
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Hash
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Timestamp
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Agent
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary"
                >
                  Risk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-foreground-secondary">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                paged.map((tx) => {
                  const outbound = tx.direction === 'outbound';
                  const DirectionIcon = outbound ? ArrowUpRight : ArrowDownLeft;
                  const statusMeta = transactionStatus(tx.status);

                  return (
                    <tr
                      key={tx.id}
                      className="transition-colors duration-fast hover:bg-surface-secondary/30"
                    >
                      {/* Hash */}
                      <td className="px-4 py-3 align-middle">
                        <p className="truncate font-medium text-foreground">
                          {tx.stellarHash ? truncateHash(tx.stellarHash, 6, 6) : tx.id}
                        </p>
                        {tx.stellarHash && (
                          <p className="tabular text-2xs text-foreground-muted">{truncateHash(tx.stellarHash, 10, 8)}</p>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 align-middle">
                        <span className="text-2xs text-foreground-muted">
                          {formatRelativeTime(tx.createdAt)}
                        </span>
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3 align-middle">
                        <span className="text-foreground-secondary">{tx.agentName ?? '—'}</span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 align-middle text-right">
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 font-medium tabular',
                            outbound ? 'text-foreground' : 'text-success',
                          )}
                        >
                          <DirectionIcon className="h-3.5 w-3.5" aria-hidden />
                          {outbound ? '−' : '+'}
                          {formatCurrency(tx.amount, tx.asset)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={statusMeta.variant} size="sm">
                          {statusMeta.label}
                        </Badge>
                      </td>

                      {/* Risk */}
                      <td className="px-4 py-3 align-middle">
                        <RiskBadge score={tx.riskScore} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3 text-xs text-foreground-secondary sm:flex-row sm:items-center sm:justify-between">
            <p>
              {filtered.length === 0
                ? '0 rows'
                : `${summaryStart}–${summaryEnd} of ${filtered.length}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                Prev
              </Button>
              <span className="tabular-nums">
                {currentPage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistoryTable;

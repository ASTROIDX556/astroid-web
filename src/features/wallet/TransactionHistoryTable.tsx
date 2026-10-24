'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileText,
  Calendar,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { transactionStatus } from '@/lib/status';
import type { Transaction } from '@/types/domain';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import {
  collectTransactionAgentOptions,
  collectTransactionAssetOptions,
  countActiveTransactionFilters,
  matchesTransactionFilters,
  TRANSACTION_DATE_RANGES,
  TRANSACTION_STATUS_FILTERS,
  type TransactionDateRange,
  type TransactionFilters,
  type TransactionStatusFilter,
} from './transactionFilters';

interface TransactionHistoryTableProps {
  transactions: Transaction[];
  className?: string;
}

/** Shared focus ring for every filter and sort control (WCAG AA). */
const CONTROL_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const SELECT_CLASS = cn(
  'h-9 rounded-md border border-border bg-surface py-2 px-3 text-sm text-foreground transition-colors hover:border-border-strong',
  CONTROL_FOCUS,
);

export function TransactionHistoryTable({ transactions, className }: TransactionHistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<TransactionStatusFilter>('all');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<TransactionDateRange>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const filters: TransactionFilters = useMemo(
    () => ({
      status: statusFilter,
      asset: assetFilter,
      agent: agentFilter,
      dateRange,
    }),
    [statusFilter, assetFilter, agentFilter, dateRange],
  );

  const agents = useMemo(
    () => collectTransactionAgentOptions(transactions),
    [transactions],
  );

  const assets = useMemo(
    () => collectTransactionAssetOptions(transactions),
    [transactions],
  );

  const activeFilterCount = countActiveTransactionFilters(filters);

  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      {
        accessorKey: 'counterparty',
        enableSorting: false,
        header: 'Counterparty',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.counterparty}</p>
            <p className="tabular text-2xs text-foreground-muted">{truncateHash(row.original.counterpartyAddress)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'agentName',
        enableSorting: false,
        header: 'Agent',
        cell: ({ row }) => <span className="text-foreground-secondary">{row.original.agentName ?? '—'}</span>,
      },
      {
        accessorKey: 'amount',
        enableSorting: true,
        sortingFn: (a, b) => a.original.amount - b.original.amount,
        header: 'Amount',
        cell: ({ row }) => {
          const tx = row.original;
          const outbound = tx.direction === 'outbound';
          return (
            <span className={`inline-flex items-center justify-end gap-1 font-medium tabular ${outbound ? 'text-foreground' : 'text-success'}`}>
              {outbound ? '−' : '+'}
              {formatCurrency(tx.amount, tx.asset)}
            </span>
          );
        },
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'status',
        enableSorting: false,
        header: 'Status',
        cell: ({ row }) => {
          const status = transactionStatus(row.original.status);
          return (
            <Badge variant={status.variant} size="sm">
              {status.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        enableSorting: true,
        sortingFn: (a, b) =>
          new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
        header: 'When',
        cell: ({ row }) => (
          <span
            className="text-2xs text-foreground-muted"
            title={new Date(row.original.createdAt).toLocaleString()}
          >
            {formatRelativeTime(row.original.createdAt)}
          </span>
        ),
        meta: { className: 'text-right' },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue ?? '').toString().trim().toLowerCase();
      if (!search) return true;

      const candidates = [row.original, row.getVisibleCells().map((cell) => cell.getValue())]
        .flat()
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return candidates.some((v) => v.includes(search));
    },
    filterFns: {},
  });

  // Apply UI-level filters (agent + status + asset + date range) on top of the
  // table's own search-filtered rows.
  const filteredRows = useMemo(
    () =>
      table
        .getFilteredRowModel()
        .rows.filter((row) =>
          matchesTransactionFilters(row.original, filters),
        ),
    [table, filters],
  );

  // Keep the current page in bounds whenever the filter set shrinks the rows.
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / pagination.pageSize) - 1);
    if (pagination.pageIndex > maxPage) {
      setPagination((p) => ({ ...p, pageIndex: maxPage }));
    }
  }, [filteredRows.length, pagination.pageIndex, pagination.pageSize]);

  const resetFilters = () => {
    setStatusFilter('all');
    setAssetFilter('all');
    setDateRange('all');
    setAgentFilter('all');
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  function exportCSV() {
    const headers = columns.map((c) => (typeof c.header === 'string' ? c.header : ''));
    const rows = filteredRows.map((r) =>
      columns.map((c) => {
        const key = (c as unknown as { accessorKey?: string }).accessorKey;
        return String(key ? r.getValue(key) : '');
      }),
    );
    const csv = [headers.join(','), ...rows.map((r) => r.map((cell) => JSON.stringify(cell)).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const data = filteredRows.map((r) => r.original);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pagination.pageSize));

  return (
    <div className={cn('overflow-hidden rounded-card border border-border bg-surface', className)}>
      {/* Filter toolbar --------------------------------------------------- */}
      <div className="space-y-3 border-b border-border bg-surface-secondary/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter selects */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-2xs text-foreground-secondary">Status</span>
              <select
                aria-label="Filter by transaction status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as TransactionStatusFilter);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className={SELECT_CLASS}
              >
                {TRANSACTION_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-2xs text-foreground-secondary">Asset</span>
              <select
                aria-label="Filter by asset type"
                value={assetFilter}
                onChange={(e) => {
                  setAssetFilter(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className={SELECT_CLASS}
              >
                <option value="all">All assets</option>
                {assets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
              <span className="sr-only">Filter by date range</span>
              <select
                aria-label="Filter by date range"
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as TransactionDateRange);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className={SELECT_CLASS}
              >
                {TRANSACTION_DATE_RANGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-2xs text-foreground-secondary">Agent</span>
              <select
                aria-label="Filter by agent"
                value={agentFilter}
                onChange={(e) => {
                  setAgentFilter(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className={SELECT_CLASS}
              >
                <option value="all">All agents</option>
                {agents.map((agent) => (
                  <option key={agent.value} value={agent.value}>
                    {agent.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Search + exports */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block">
              <input
                aria-label="Search transactions"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search counterparty, purpose, or asset"
                className={cn(
                  'h-9 w-full min-w-[200px] rounded-md border border-border bg-surface py-2 px-3 text-sm text-foreground placeholder:text-foreground-muted',
                  CONTROL_FOCUS,
                )}
              />
            </label>

            <Button type="button" variant="secondary" size="sm" onClick={exportCSV} leftIcon={<FileText className="h-4 w-4" />}>
              CSV
            </Button>

            <Button type="button" variant="secondary" size="sm" onClick={exportJSON} leftIcon={<Download className="h-4 w-4" />}>
              JSON
            </Button>
          </div>
        </div>

        {/* Active filter summary + reset */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-2xs text-foreground-secondary">
            <SlidersHorizontal className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
            <span>
              {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active ·{' '}
              {filteredRows.length} of {transactions.length} transactions
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className={cn(
                'inline-flex items-center gap-1 rounded-xs px-2 py-0.5 font-medium text-gold-strong transition-colors hover:bg-gold-soft',
                CONTROL_FOCUS,
              )}
            >
              <XCircle className="h-3 w-3" aria-hidden />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table ------------------------------------------------------------ */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface-secondary/40">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDirection = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDirection === 'asc'
                          ? 'ascending'
                          : sortDirection === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                      className={cn('px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-foreground-secondary',
                        canSort && 'cursor-pointer select-none')}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          disabled={!canSort}
                          aria-label={
                            canSort
                              ? `Sort by ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id}${
                                  sortDirection === 'asc' ? ', currently sorted ascending' : sortDirection === 'desc' ? ', currently sorted descending' : ''
                                }`
                              : undefined
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 text-left font-medium transition-colors hover:text-foreground rounded-xs',
                            canSort && CONTROL_FOCUS,
                            !canSort && 'cursor-default',
                          )}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {canSort && (
                            <span className="text-foreground-muted" aria-hidden>
                              {sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : sortDirection === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5 opacity-50" />}
                            </span>
                          )}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-border">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6">
                  <EmptyState
                    compact
                    title="No transactions match your filters"
                    description={
                      activeFilterCount > 0
                        ? `Nothing found for the ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}. Try widening the date range or clearing a filter.`
                        : 'No transactions have been recorded for this wallet yet.'
                    }
                    action={
                      activeFilterCount > 0 ? (
                        <Button type="button" variant="secondary" size="sm" onClick={resetFilters}>
                          Clear all filters
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              filteredRows.slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize).map((row) => (
                <tr
                  key={row.id}
                  role="row"
                  tabIndex={0}
                  className="transition-colors duration-fast hover:bg-surface-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn('px-4 py-3 align-middle text-foreground', (cell.column.columnDef.meta as { className?: string } | undefined)?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination ------------------------------------------------------- */}
      <div className="flex flex-col gap-3 border-t border-border bg-surface-secondary/20 px-4 py-3 text-xs text-foreground-secondary sm:flex-row sm:items-center sm:justify-between">
        <p className="tabular-nums">
          {filteredRows.length === 0 ? '0 rows' : `${pagination.pageIndex * pagination.pageSize + 1}-${Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredRows.length)} of ${filteredRows.length}`}
        </p>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={pagination.pageIndex === 0} onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.max(p.pageIndex - 1, 0) }))}>
            Prev
          </Button>
          <span className="tabular-nums">{pagination.pageIndex + 1} / {pageCount}</span>
          <Button type="button" variant="secondary" size="sm" disabled={pagination.pageIndex >= pageCount - 1} onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.min(p.pageIndex + 1, pageCount - 1) }))}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TransactionHistoryTable;

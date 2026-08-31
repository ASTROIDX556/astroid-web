'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, SearchX } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import type { Transaction } from '@/types/domain';

interface TransactionTableProps {
  transactions: Transaction[];
  onSelect?: (transaction: Transaction) => void;
  className?: string;
  isLoading?: boolean;
}

export function TransactionTable({ transactions, className, isLoading = false }: TransactionTableProps) {
  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      {
        accessorKey: 'counterparty',
        header: 'Counterparty',
        cell: ({ row }) => {
          const tx = row.original;
          return (
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{tx.counterparty}</p>
              <p className="tabular text-2xs text-foreground-muted">{truncateHash(tx.counterpartyAddress)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: 'purpose',
        header: 'Purpose',
        cell: ({ row }) => <span className="text-foreground-secondary">{row.original.purpose}</span>,
      },
      {
        accessorKey: 'agentName',
        header: 'Agent',
        cell: ({ row }) => <span className="text-foreground-secondary">{row.original.agentName ?? '—'}</span>,
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => {
          const tx = row.original;
          const outbound = tx.direction === 'outbound';
          const Icon = outbound ? ArrowUpRight : ArrowDownLeft;
          return (
            <span
              className={`inline-flex items-center justify-end gap-1 font-medium tabular ${
                outbound ? 'text-foreground' : 'text-success'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {outbound ? '−' : '+'}
              {formatCurrency(tx.amount, tx.asset)}
            </span>
          );
        },
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'status',
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
        accessorKey: 'riskScore',
        header: 'Risk',
        cell: ({ row }) => <RiskBadge score={row.original.riskScore} />, 
      },
      {
        accessorKey: 'createdAt',
        header: 'When',
        cell: ({ row }) => (
          <span className="text-2xs text-foreground-muted">{formatRelativeTime(row.original.createdAt)}</span>
        ),
        meta: { className: 'text-right' },
      },
    ],
    [],
  );

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assetFilter, setAssetFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(handler);
  }, [query]);

  const assets = useMemo(() => Array.from(new Set(transactions.map(tx => tx.asset))), [transactions]);
  const statuses = useMemo(() => Array.from(new Set(transactions.map(tx => tx.status))), [transactions]);

  const filteredTransactions = useMemo(() => {
    const terms = debouncedQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return transactions.filter((tx) => {
      const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
      const matchesAsset = assetFilter === 'all' || tx.asset === assetFilter;
      const searchable = [tx.id, tx.counterparty, tx.counterpartyAddress, tx.purpose, tx.asset, tx.agentName].join(' ').toLowerCase();
      const matchesQuery = terms.every((term) => searchable.includes(term));
      return matchesStatus && matchesAsset && matchesQuery;
    });
  }, [transactions, debouncedQuery, statusFilter, assetFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTransactions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, assetFilter, pageSize]);

  return (
    <div className={className}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search asset, public key, or agent"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search transactions"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>{transactionStatus(status).label}</option>
          ))}
        </select>
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by asset"
        >
          <option value="all">All assets</option>
          {assets.map((asset) => (
            <option key={asset} value={asset}>{asset}</option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Page size"
        >
          {[8, 16, 24].map((size) => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-card border border-border bg-surface p-8 text-center text-sm text-foreground-secondary"
        >
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" aria-hidden />
          Loading transactions…
        </div>
      ) : (
        <DataTable
          data={pagedTransactions}
          columns={columns}
          getRowId={(row) => row.id}
          className={className}
          caption="Transactions"
          emptyState={
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground-secondary">
              <SearchX className="mb-2 h-8 w-8 text-foreground-muted" aria-hidden />
              No matching transactions.
            </div>
          }
          searchable={false}
          pageSize={Number.MAX_SAFE_INTEGER}
        />
      )}

      {!isLoading && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground-muted" aria-live="polite">
            Page {safePage} of {totalPages} · {filteredTransactions.length} results
          </p>
          <nav className="flex gap-2" aria-label="Pagination">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}

export default TransactionTable;

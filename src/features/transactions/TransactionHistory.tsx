'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Inbox, Loader2, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import type { Transaction } from '@/types/domain';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';

export function TransactionHistory({ transactions, isLoading = false }: { transactions: Transaction[]; isLoading?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assetFilter, setAssetFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, assetFilter, agentFilter]);

  const selectedTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedId) ?? null,
    [selectedId, transactions],
  );

  const summary = useMemo(
    () => ({
      totalValue: transactions.reduce((sum, tx) => sum + tx.usdValue, 0),
      successful: transactions.filter((tx) => ['completed', 'confirmed', 'approved'].includes(tx.status)).length,
      flagged: transactions.filter((tx) => tx.riskScore >= 80).length,
    }),
    [transactions],
  );

  // Unique filter options
  const statusOptions = useMemo(() => Array.from(new Set(transactions.map((tx) => tx.status))), [transactions]);
  const assetOptions = useMemo(() => Array.from(new Set(transactions.map((tx) => tx.asset))), [transactions]);
  const agentOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.agentName).filter(Boolean))),
    [transactions],
  );

  // Filter transactions based on search and dropdowns
  const filteredTransactions = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (assetFilter !== 'all' && tx.asset !== assetFilter) return false;
      if (agentFilter !== 'all' && tx.agentName !== agentFilter) return false;

      if (query) {
        const assetMatch = tx.asset.toLowerCase().includes(query);
        const addressMatch = tx.counterpartyAddress.toLowerCase().includes(query);
        if (!assetMatch && !addressMatch) return false;
      }

      return true;
    });
  }, [transactions, debouncedSearch, statusFilter, assetFilter, agentFilter]);

  // Pagination calculations
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, safePage, pageSize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">USD volume</span>
            <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight tabular">
            {formatCurrency(summary.totalValue, 'USDC', { compact: true })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">Settled</span>
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight tabular">{summary.successful}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">High risk</span>
            <Search className="h-4 w-4 text-warning" aria-hidden />
          </div>
          <p className="mt-3 font-display text-2xl font-semibold tracking-tight tabular">{summary.flagged}</p>
        </Card>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by asset code or address..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Search transactions"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Filter by asset"
        >
          <option value="all">All assets</option>
          {assetOptions.map((asset) => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Filter by agent"
        >
          <option value="all">All agents</option>
          {agentOptions.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </div>

      {/* Data table or empty state */}
      {filteredTransactions.length > 0 ? (
        <>
          <DataTable
            data={paginatedTransactions}
            searchable={false}
            pageSize={paginatedTransactions.length}
            caption="Transaction activity"
            onRowClick={(transaction) => setSelectedId(transaction.id)}
            getRowId={(row) => row.id}
            columns={[
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
                      className="inline-flex items-center justify-end gap-1 font-medium tabular"
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
                  return <Badge variant={status.variant}>{status.label}</Badge>;
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
            ]}
          />

          {/* Pagination controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-2xs text-foreground-muted tabular">
              Showing {filteredTransactions.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
              {Math.min(safePage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-2xs text-foreground-muted" htmlFor="page-size">
                Rows per page
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {[5, 8, 10, 15, 20].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage === pageCount}
                className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-medium text-foreground">No transactions found</p>
          <p className="mt-1 text-2xs text-foreground-muted">Try adjusting your search or filters.</p>
        </div>
      )}
    </div>
  );
}on"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover*text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-2xs text-foreground-muted tabular">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="mt-4 font-medium text-foreground">No transactions found</p>
          <p className="mt-1 text-sm text-foreground-muted">Try adjusting your search or filters.</p>
        </div>
      )}

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={Boolean(selectedTransaction)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

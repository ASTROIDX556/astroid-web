'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import type { Transaction } from '@/types/domain';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';
import {
  DEFAULT_TRANSACTION_FILTERS,
  TRANSACTION_DATE_RANGE_IDS,
  TRANSACTION_DATE_RANGE_LABELS,
  buildTransactionSearchText,
  collectAgentOptions,
  collectAssetOptions,
  collectStatusOptions,
  countActiveTransactionFilters,
  filterTransactions,
  type TransactionFilters,
} from './transactionFilters';

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const FILTER_LABEL_CLASS = 'text-2xs text-foreground-secondary';

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_TRANSACTION_FILTERS);

  const agentOptions = useMemo(() => collectAgentOptions(transactions), [transactions]);
  const statusOptions = useMemo(() => collectStatusOptions(transactions), [transactions]);
  const assetOptions = useMemo(() => collectAssetOptions(transactions), [transactions]);

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  );

  const activeFilterCount = countActiveTransactionFilters(filters);

  const setFilter = <TKey extends keyof TransactionFilters>(key: TKey, value: TransactionFilters[TKey]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const selectedTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedId) ?? null,
    [selectedId, transactions],
  );

  const summary = useMemo(
    () => ({
      totalValue: filteredTransactions.reduce((sum, tx) => sum + tx.usdValue, 0),
      successful: filteredTransactions.filter((tx) =>
        ['completed', 'confirmed', 'approved'].includes(tx.status),
      ).length,
      flagged: filteredTransactions.filter((tx) => tx.riskScore >= 80).length,
    }),
    [filteredTransactions],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">
              USD volume
            </span>
            <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          </div>
          <p className="tabular mt-3 font-display text-2xl font-semibold tracking-tight">
            {formatCurrency(summary.totalValue, 'USDC', { compact: true })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">
              Settled
            </span>
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          </div>
          <p className="tabular mt-3 font-display text-2xl font-semibold tracking-tight">
            {summary.successful}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-[0.18em] text-foreground-secondary">
              High risk
            </span>
            <Search className="h-4 w-4 text-warning" aria-hidden />
          </div>
          <p className="tabular mt-3 font-display text-2xl font-semibold tracking-tight">
            {summary.flagged}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Status</span>
          <select
            aria-label="Filter transactions by status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value as TransactionFilters['status'])}
            className={SELECT_CLASS}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status} className="capitalize">
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Asset</span>
          <select
            aria-label="Filter transactions by asset type"
            value={filters.asset}
            onChange={(event) => setFilter('asset', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All assets</option>
            {assetOptions.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Date</span>
          <select
            aria-label="Filter transactions by date range"
            value={filters.dateRange}
            onChange={(event) =>
              setFilter('dateRange', event.target.value as TransactionFilters['dateRange'])
            }
            className={SELECT_CLASS}
          >
            {TRANSACTION_DATE_RANGE_IDS.map((range) => (
              <option key={range} value={range}>
                {TRANSACTION_DATE_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className={FILTER_LABEL_CLASS}>Agent</span>
          <select
            aria-label="Filter transactions by agent"
            value={filters.agent}
            onChange={(event) => setFilter('agent', event.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All agents</option>
            {agentOptions.map(([agentId, agentName]) => (
              <option key={agentId} value={agentId}>
                {agentName}
              </option>
            ))}
          </select>
        </label>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_TRANSACTION_FILTERS)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Clear filters
            <span className="sr-only">({activeFilterCount} active)</span>
          </button>
        )}
      </div>

      <p aria-live="polite" className="text-2xs text-foreground-muted">
        {filteredTransactions.length === transactions.length
          ? `${transactions.length} transactions`
          : `${filteredTransactions.length} of ${transactions.length} transactions match the filters`}
      </p>

      <DataTable
        data={filteredTransactions}
        searchable
        searchPlaceholder="Search recipient address, memo, asset, or status"
        enableMultiSort
        getRowSearchText={buildTransactionSearchText}
        pageSize={8}
        caption="Transaction activity"
        onRowClick={(transaction) => setSelectedId(transaction.id)}
        getRowId={(row) => row.id}
        emptyState={
          <div className="rounded-card border border-dashed border-border bg-surface p-8 text-center text-sm text-foreground-secondary">
            No matching transactions.
          </div>
        }
        columns={[
          {
            accessorKey: 'counterparty',
            header: 'Counterparty',
            cell: ({ row }) => {
              const tx = row.original;
              return (
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {tx.counterparty}
                  </p>
                  <p className="tabular text-2xs text-foreground-muted">
                    {truncateHash(tx.counterpartyAddress)}
                  </p>
                </div>
              );
            },
          },
          {
            accessorKey: 'purpose',
            header: 'Purpose',
            cell: ({ row }) => (
              <span className="text-foreground-secondary">
                {row.original.purpose}
                {row.original.memo && (
                  <span className="block text-2xs text-foreground-muted">{row.original.memo}</span>
                )}
              </span>
            ),
          },
          {
            accessorKey: 'agentName',
            header: 'Agent',
            cell: ({ row }) => (
              <span className="text-foreground-secondary">
                {row.original.agentName ?? '—'}
              </span>
            ),
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
                  className={`tabular inline-flex items-center justify-end gap-1 font-medium ${
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
              <span className="text-2xs text-foreground-muted">
                {formatRelativeTime(row.original.createdAt)}
              </span>
            ),
            meta: { className: 'text-right' },
          },
        ]}
      />

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        open={Boolean(selectedTransaction)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

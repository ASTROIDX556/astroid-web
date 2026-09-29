'use client';

import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import type { Transaction } from '@/types/domain';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';

type StatusFilter = 'all' | Transaction['status'];

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const agentOptions = useMemo(() => {
    const unique = Array.from(
      new Map(
        transactions
          .filter((tx) => tx.agentId)
          .map((tx) => [tx.agentId as string, tx.agentName ?? tx.agentId] as const),
      ).entries(),
    );
    return unique;
  }, [transactions]);

  const statusOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.status))),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
        if (agentFilter !== 'all' && tx.agentId !== agentFilter) return false;
        return true;
      }),
    [transactions, statusFilter, agentFilter],
  );

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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-2xs text-foreground-secondary">Status</span>
          <select
            aria-label="Filter transactions by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="h-9 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <span className="text-2xs text-foreground-secondary">Agent</span>
          <select
            aria-label="Filter transactions by agent"
            value={agentFilter}
            onChange={(event) => setAgentFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All agents</option>
            {agentOptions.map(([agentId, agentName]) => (
              <option key={agentId} value={agentId}>
                {agentName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        data={filteredTransactions}
        searchable
        searchPlaceholder="Search with counterparty, asset, or status"
        pageSize={8}
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
              <span className="text-foreground-secondary">{row.original.purpose}</span>
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

'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDownLeft, ArrowUpRight, Bot, History } from 'lucide-react';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { VaultIllustration } from '@/components/illustrations';
import { useTransactions } from '@/hooks/use-queries';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatRelativeTime, truncateHash } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  selectWalletTransactions,
  sumByDirection,
} from '@/features/wallet/utils/walletTransactions';
import type { Transaction } from '@/types/domain';

export interface WalletTransactionHistoryProps {
  /** Wallet whose transfers should be listed. Matches `Transaction.walletId`. */
  walletId: string;
  className?: string;
}

/** Inbound / outgoing transfer indicators shared by the summary chips and rows. */
function DirectionIcon({ direction }: { direction: Transaction['direction'] }) {
  return direction === 'inbound' ? (
    <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
  ) : (
    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
  );
}

function useWalletTransactionColumns(): ColumnDef<Transaction, unknown>[] {
  return useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      {
        accessorKey: 'counterparty',
        header: 'Counterparty',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.counterparty}</p>
            <p className="tabular text-2xs text-foreground-muted">
              {truncateHash(row.original.counterpartyAddress)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'agentName',
        header: 'Agent',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.agentName ? (
            <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
              <Bot className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
              {row.original.agentName}
            </span>
          ) : (
            <span className="text-foreground-muted">—</span>
          ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        sortingFn: (a, b) => a.original.amount - b.original.amount,
        cell: ({ row }) => {
          const tx = row.original;
          const inbound = tx.direction === 'inbound';
          return (
            <span
              className={cn(
                'inline-flex items-center justify-end gap-1.5 font-medium tabular',
                inbound ? 'text-success' : 'text-foreground',
              )}
            >
              <DirectionIcon direction={tx.direction} />
              {inbound ? '+' : '−'}
              {formatCurrency(tx.amount, tx.asset)}
              <span className="sr-only">
                {inbound ? 'Incoming transfer' : 'Outgoing transfer'}
              </span>
            </span>
          );
        },
        meta: { className: 'text-right' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const status = transactionStatus(row.original.status);
          return (
            <Badge variant={status.variant} size="sm" dot>
              {status.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'When',
        sortingFn: (a, b) =>
          new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
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
}

/**
 * Wallet-scoped transaction history for the Stellar wallet dashboard.
 *
 * Reads transfers through `useTransactions` (same resource layer as the
 * /transactions page), filters them to the wallet, and renders a compact
 * TanStack-Table view with explicit incoming / outgoing indicators, signed
 * amounts and per-status badges. Loading, error and empty states are handled
 * by the shared `QueryBoundary` + `EmptyState` primitives.
 */
export function WalletTransactionHistory({ walletId, className }: WalletTransactionHistoryProps) {
  const transactionsQuery = useTransactions();
  const columns = useWalletTransactionColumns();

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-secondary/40 px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-gold" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Transaction history</p>
            <p className="text-2xs text-foreground-muted">
              Agent-driven transfers for this wallet
            </p>
          </div>
        </div>
        <Link
          href="/transactions"
          className="text-2xs font-medium text-gold-strong transition-colors hover:text-foreground"
        >
          View all
        </Link>
      </div>

      <div className="p-5">
        <QueryBoundary
          query={transactionsQuery}
          loading={<div className="skeleton h-72 w-full rounded-card" />}
        >
          {(all) => {
            const rows = selectWalletTransactions(all, walletId);

            if (rows.length === 0) {
              return (
                <EmptyState
                  compact
                  illustration={<VaultIllustration />}
                  title="No transactions yet"
                  description="Agent-driven Stellar transfers for this wallet will appear here once value starts moving."
                />
              );
            }

            const { inbound, outbound } = sumByDirection(rows);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-2xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">
                    <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
                    Incoming {formatCurrency(inbound, 'USDC', { compact: true })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-secondary px-2.5 py-1 font-medium text-foreground-secondary">
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    Outgoing {formatCurrency(outbound, 'USDC', { compact: true })}
                  </span>
                </div>
                <DataTable
                  data={rows}
                  columns={columns}
                  getRowId={(row) => row.id}
                  pageSize={8}
                  searchable
                  searchPlaceholder="Search counterparty, agent, or asset"
                />
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </Card>
  );
}

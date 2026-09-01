'use client';

import Link from 'next/link';
import { ArrowLeft, Bot } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { DataTable, type Column } from '@/components/dashboard/data-table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWallet, useTransactions } from '@/hooks/use-queries';
import { walletStatus } from '@/lib/status';
import { formatCurrency, formatNumber, formatDateTime, truncateHash } from '@/lib/format';
import { TransactionHistoryTable } from '@/features/wallet/components/TransactionHistoryTable';
import type { AssetBalance } from '@/types/domain';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { XdrInspector } from '@/features/wallet/components/XdrInspector';
import { SigningQueue, type SigningQueueItem } from '@/features/wallet/SigningQueue';

const signingQueueItems: SigningQueueItem[] = [
  {
    id: 'agent-payment-001',
    title: 'Orion payroll transfer',
    description: 'Agent-proposed USDC payment requiring an operator signature.',
    amount: '1,250.00 USDC',
    sourceAccount: 'GCFQ4I7ZTW5W3K7CSW2USSQK6AZW5KTQH7QA2S5JS5EIUJF2EZRD3E6E',
    network: 'Testnet',
    status: 'pending',
    xdr: 'AAAAAgAAAABOcm90LWEtdmFsaWQtc3RlbGxhci14ZHItZm9yLWRlbW8=',
  },
];

const balanceColumns: Column<AssetBalance>[] = [
  { header: 'Asset', cell: (b) => <span className="font-medium">{b.asset}</span> },
  {
    header: 'Balance',
    align: 'right',
    cell: (b) => <span className="tabular"><AnimatedNumber value={b.balance} formatter={(v) => formatNumber(v)} /></span>,
  },
  {
    header: 'USD value',
    align: 'right',
    cell: (b) => (
      <span className="tabular"><AnimatedNumber value={b.usdValue} formatter={(v) => formatCurrency(v, 'USDC')} /></span>
    ),
  },
];

export default function WalletDetailPage({ params }: { params: { id: string } }) {
  const wallet = useWallet(params.id);
  const allTransactions = useTransactions();

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/wallets"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to wallets
      </Link>

      <QueryBoundary
        query={wallet}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const status = walletStatus(data.status);
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={data.walletType}
                title={data.name}
                description={truncateHash(data.stellarAddress, 6, 6)}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                    <RiskBadge score={data.riskScore} showScore />
                  </div>
                }
              />

              <Card className="p-5">
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <KeyValue label="Network">
                    <Badge
                      variant={data.network === 'public' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {data.network}
                    </Badge>
                  </KeyValue>
                  <KeyValue label="Type">
                    <span className="capitalize">{data.walletType}</span>
                  </KeyValue>
                  <KeyValue label="Stellar address" mono>
                    {truncateHash(data.stellarAddress, 6, 6)}
                  </KeyValue>
                  <KeyValue label="Total value">
                    <AnimatedNumber value={data.totalUsdValue} formatter={(v) => formatCurrency(v, 'USDC')} />
                  </KeyValue>
                  <KeyValue label="Risk">
                    <RiskBadge score={data.riskScore} showScore />
                  </KeyValue>
                  <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                  {data.agentId && (
                    <KeyValue label="Controlled by">
                      <Link
                        href={`/agents/${data.agentId}`}
                        className="inline-flex items-center gap-1 text-gold-strong hover:underline"
                      >
                        <Bot className="h-3.5 w-3.5" aria-hidden /> View agent
                      </Link>
                    </KeyValue>
                  )}
                </dl>
              </Card>

              <div className="space-y-4">
                <SectionLabel>Balances</SectionLabel>
                <DataTable<AssetBalance>
                  columns={balanceColumns}
                  rows={data.balances}
                  rowKey={(b) => b.asset}
                />
              </div>

              {/* Transaction history for this wallet */}
              <QueryBoundary
                query={allTransactions}
                loading={<div className="skeleton h-48 w-full rounded-card" />}
              >
                {(txns) => {
                  const walletTxns = txns.filter((t) => t.walletId === data.id);
                  return (
                    <div className="space-y-4">
                      <SectionLabel>Transaction history</SectionLabel>
                      {walletTxns.length === 0 ? (
                        <p className="text-sm text-foreground-secondary">
                          No transactions recorded for this wallet yet.
                        </p>
                      ) : (
                        <TransactionHistoryTable transactions={walletTxns} />
                      )}
                    </div>
                  );
                }}
              </QueryBoundary>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

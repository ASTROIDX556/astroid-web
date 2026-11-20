'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Wallet as WalletIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTransaction } from '@/hooks/use-queries';
import { transactionStatus } from '@/lib/status';
import { formatCurrency, formatDateTime, truncateHash } from '@/lib/format';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';

export default function TransactionDetailPage({ params }: { params: { id: string } }) {
  const transaction = useTransaction(params.id);

  return (
    <PageTransition className="space-y-8">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1 text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to transactions
      </Link>

      <QueryBoundary
        query={transaction}
        loading={
          <div className="space-y-6">
            <div className="skeleton h-24 w-full rounded-card" />
            <div className="skeleton h-64 w-full rounded-card" />
          </div>
        }
      >
        {(data) => {
          const status = transactionStatus(data.status);
          const outbound = data.direction === 'outbound';
          const Icon = outbound ? ArrowUpRight : ArrowDownLeft;
          return (
            <div className="space-y-8">
              <PageHeader
                eyebrow={data.direction}
                title={`${outbound ? '−' : '+'}${formatCurrency(data.amount, data.asset)}`}
                description={data.purpose}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                    <RiskBadge score={data.riskScore} showScore />
                  </div>
                }
              />

              <Card className="relative overflow-hidden p-5">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-md ${
                      outbound
                        ? 'bg-surface-secondary text-foreground'
                        : 'bg-success-soft text-success'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="tabular font-display text-2xl font-semibold leading-none tracking-tight">
                      {outbound ? '−' : '+'}
                      <AnimatedNumber
                        value={data.amount}
                        formatter={(v) => formatCurrency(v, data.asset)}
                      />
                    </p>
                    <p className="mt-1 text-2xs capitalize text-foreground-secondary">
                      {data.direction} ·{' '}
                      <AnimatedNumber
                        value={data.usdValue}
                        formatter={(v) => formatCurrency(v, 'USDC')}
                      />{' '}
                      USD value
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <KeyValue label="Counterparty">{data.counterparty}</KeyValue>
                  <KeyValue label="Counterparty address" mono>
                    {truncateHash(data.counterpartyAddress, 6, 6)}
                  </KeyValue>
                  <KeyValue label="Asset">{data.asset}</KeyValue>
                  <KeyValue label="Amount">
                    <AnimatedNumber
                      value={data.amount}
                      formatter={(v) => formatCurrency(v, data.asset)}
                    />
                  </KeyValue>
                  <KeyValue label="USD value">
                    <AnimatedNumber
                      value={data.usdValue}
                      formatter={(v) => formatCurrency(v, 'USDC')}
                    />
                  </KeyValue>
                  <KeyValue label="Direction">
                    <span className="capitalize">{data.direction}</span>
                  </KeyValue>
                  <KeyValue label="Purpose" className="sm:col-span-2 lg:col-span-3">
                    {data.purpose}
                  </KeyValue>
                  {data.memo && (
                    <KeyValue label="Memo" className="sm:col-span-2 lg:col-span-3">
                      {data.memo}
                    </KeyValue>
                  )}
                  <KeyValue label="Created">{formatDateTime(data.createdAt)}</KeyValue>
                  {data.agentId && (
                    <KeyValue label="Agent">
                      <Link
                        href={`/agents/${data.agentId}`}
                        className="inline-flex items-center gap-1 text-gold-strong hover:underline"
                      >
                        <Bot className="h-3.5 w-3.5" aria-hidden />
                        {data.agentName ?? 'View agent'}
                      </Link>
                    </KeyValue>
                  )}
                  <KeyValue label="Wallet">
                    <Link
                      href={`/wallets/${data.walletId}`}
                      className="inline-flex items-center gap-1 text-gold-strong hover:underline"
                    >
                      <WalletIcon className="h-3.5 w-3.5" aria-hidden /> View wallet
                    </Link>
                  </KeyValue>
                  {data.stellarHash && (
                    <KeyValue label="Stellar hash" mono>
                      {truncateHash(data.stellarHash, 6, 6)}
                    </KeyValue>
                  )}
                </dl>
              </Card>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

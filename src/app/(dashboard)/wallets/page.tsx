'use client';

import Link from 'next/link';
import { Wallet as WalletIcon } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { StatCard, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { VaultIllustration } from '@/components/illustrations';
import { useWallets } from '@/hooks/use-queries';
import { walletStatus } from '@/lib/status';
import { formatCurrency, formatNumber, truncateHash } from '@/lib/format';
import { PageTransition } from '@/components/ui/motion';

export default function WalletsPage() {
  const wallets = useWallets();

  return (
    <PageTransition className="space-y-8">
      <PageHeader
        eyebrow="Operate"
        title="Wallets"
        description="Treasury, agent and escrow wallets — balances, network and risk at a glance."
      />

      <QueryBoundary
        query={wallets}
        loading={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={<VaultIllustration />}
            title="No wallets yet"
            description="Provision a wallet to give your agents somewhere to hold and move value."
          />
        }
      >
        {(data) => {
          const totalValue = data.reduce((sum, w) => sum + w.totalUsdValue, 0);
          const activeCount = data.filter((w) => w.status === 'active').length;
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total value"
                  rawNumber={totalValue}
                  formatter={(val) => formatCurrency(val, 'USDC', { compact: true })}
                  accent
                  icon={<WalletIcon className="h-4 w-4" aria-hidden />}
                />
                <StatCard label="Wallets" rawNumber={data.length} formatter={(val) => formatNumber(val)} />
                <StatCard
                  label="Active"
                  rawNumber={activeCount}
                  formatter={(val) => formatNumber(val)}
                  footer="operational now"
                />
              </div>

              <SectionLabel>{data.length} wallets</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.map((wallet) => {
                  const status = walletStatus(wallet.status);
                  const assetNames = wallet.balances.map((balance) => balance.asset).join(', ');
                  const assetSummary = assetNames.length > 0 ? `Assets: ${assetNames}.` : 'No assets.';
                  const cardLabel = `${wallet.name} wallet, ${status.label}. ${wallet.network} network. Total value ${formatCurrency(wallet.totalUsdValue, 'USDC', { compact: true })}. ${assetSummary} ${formatNumber(wallet.balances.length)} ${wallet.balances.length === 1 ? 'asset' : 'assets'}. Open wallet details.`;
                  return (
                    <Link
                      key={wallet.id}
                      href={`/wallets/${wallet.id}`}
                      aria-label={cardLabel}
                      className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Card interactive className="h-full p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{wallet.name}</p>
                            <p className="tabular text-2xs text-foreground-muted">
                              {truncateHash(wallet.stellarAddress)}
                            </p>
                          </div>
                          <Badge variant={status.variant} size="sm" dot>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" size="sm" className="capitalize">
                            {wallet.walletType}
                          </Badge>
                          <Badge
                            variant={wallet.network === 'public' ? 'success' : 'warning'}
                            size="sm"
                          >
                            {wallet.network}
                          </Badge>
                          <RiskBadge score={wallet.riskScore} showScore />
                        </div>

                        <div className="mt-5">
                          <p className="text-2xs uppercase tracking-wide text-foreground-secondary">
                            Total value
                          </p>
                          <p className="font-display text-2xl font-semibold leading-none tracking-tight tabular">
                            {formatCurrency(wallet.totalUsdValue, 'USDC', { compact: true })}
                          </p>
                          <p className="mt-1 text-2xs text-foreground-muted">
                            {formatNumber(wallet.balances.length)}{' '}
                            {wallet.balances.length === 1 ? 'asset' : 'assets'}
                          </p>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </PageTransition>
  );
}

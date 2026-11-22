'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Bot } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { QueryBoundary } from '@/components/dashboard/query-boundary';
import { KeyValue, SectionLabel } from '@/components/dashboard/stat-card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWallet, useWalletTrustlines } from '@/hooks/use-queries';
import { walletStatus } from '@/lib/status';
import { formatCurrency, formatDateTime, truncateHash } from '@/lib/format';
import { PageTransition, AnimatedNumber } from '@/components/ui/motion';
import { XdrInspector } from '@/features/wallet/components/XdrInspector';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { WalletBalanceCards } from '@/features/wallet/components/WalletBalanceCards';
import { AssetBreakdownWidget } from '@/features/wallet/components/AssetBreakdownWidget';
import { AssetSelector } from '@/features/wallet/components/AssetSelector';
import { parseTrustlineBalances } from '@/features/wallet/utils/assetBreakdown';
import { mockAssetPricesUsd } from '@/features/wallet/mock-data';
import type { HorizonBalance } from '@/features/wallet/types';
import { isMockMode } from '@/lib/env';
import { WalletTransactionHistory } from '@/features/wallet/components/WalletTransactionHistory';
import { StellarAccountSyncPanel } from '@/features/wallet/components/StellarAccountSyncPanel';

export default function WalletDetailPage({ params }: { params: { id: string } }) {
  const wallet = useWallet(params.id);
  const trustlines = useWalletTrustlines(params.id);

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
                    <AnimatedNumber
                      value={data.totalUsdValue}
                      formatter={(v) => formatCurrency(v, 'USDC')}
                    />
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
                <SectionLabel>Live account</SectionLabel>
                <StellarAccountSyncPanel publicKey={data.stellarAddress} />
              </div>
            </div>
          );
        }}
      </QueryBoundary>

      <div className="space-y-4">
        <SectionLabel>Balances</SectionLabel>
        <ErrorBoundary section="Wallet balances">
          <WalletBalanceCards walletId={params.id} />
        </ErrorBoundary>
      </div>

      <div className="space-y-4">
        <SectionLabel>Transaction history</SectionLabel>
        <WalletTransactionHistory walletId={params.id} />
      </div>

      <div className="space-y-4">
        <SectionLabel>Multi-currency breakdown</SectionLabel>
        <QueryBoundary
          query={trustlines}
          loading={<div className="skeleton h-96 w-full rounded-card" />}
        >
          {(data) => (
          <AssetBreakdownSection balances={data} />
        )}
        </QueryBoundary>
      </div>

      <div className="space-y-4">
        <SectionLabel>Transaction inspector</SectionLabel>
        <ErrorBoundary section="Wallet transaction inspector">
          <XdrInspector />
        </ErrorBoundary>
      </div>
    </PageTransition>
  );
}

/**
 * Multi-currency breakdown with an asset filter. The selector is fed by the
 * same Horizon balances the widget parses, so options always match the rows
 * on screen; choosing an asset narrows the ribbon and holdings table to that
 * `CODE:ISSUER` holding (or the native XLM entry).
 */
function AssetBreakdownSection({ balances }: { balances: readonly HorizonBalance[] }) {
  const [assetId, setAssetId] = useState<string | null>(null);

  const assets = useMemo(() => {
    const prices = isMockMode ? mockAssetPricesUsd : {};
    return parseTrustlineBalances(balances, prices).map((holding) => ({
      id: holding.id,
      symbol: holding.code,
      issuer: holding.issuer,
      name: holding.name,
      balance: holding.amount,
      hasTrustline: true,
    }));
  }, [balances]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AssetSelector
          assets={assets}
          value={assetId}
          onChange={setAssetId}
          label="Filter breakdown by asset"
          searchPlaceholder="Filter by symbol or issuer…"
        />
        {assetId && (
          <button
            type="button"
            onClick={() => setAssetId(null)}
            className="text-2xs font-medium text-foreground-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Show all assets
          </button>
        )}
      </div>
      <AssetBreakdownWidget balances={balances} assetId={assetId} />
    </div>
  );
}

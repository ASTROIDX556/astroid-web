'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { AssetCard } from './AssetCard';
import type { WalletSummary } from '../types';

interface AssetBalanceGridProps {
  summary: WalletSummary | null;
  isLoading?: boolean;
}

export function AssetBalanceGrid({ summary, isLoading }: AssetBalanceGridProps) {
  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-secondary" />
          <div className="h-4 w-48 animate-pulse rounded-button bg-surface-secondary" />
          <div className="h-3 w-32 animate-pulse rounded-button bg-surface-secondary" />
        </div>
      </Card>
    );
  }

  if (!summary || summary.assets.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Wallet className="h-8 w-8 text-foreground-muted" />
          <h4 className="font-semibold text-sm text-foreground">No assets found</h4>
          <p className="text-xs text-foreground-muted max-w-xs">
            Your wallet does not hold any Stellar assets yet. Once you receive tokens, they will appear here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Asset Balances</CardTitle>
              <CardDescription>
                Multi-asset overview across your Stellar wallet
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold tabular text-foreground">
                {formatCurrency(summary.totalUsdValue, 'USD')}
              </p>
              <p className="text-2xs text-foreground-muted">
                Total Value · {formatRelativeTime(summary.lastUpdated)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summary.assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

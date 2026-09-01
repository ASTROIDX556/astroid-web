'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import type { AssetBalance } from '../types';

interface AssetCardProps {
  asset: AssetBalance;
}

const ASSET_COLORS: Record<string, string> = {
  XLM: 'bg-info-soft text-info',
  USDC: 'bg-success-soft text-success',
  EURC: 'bg-gold-soft text-gold-strong',
  ASTRO: 'bg-warning-soft text-warning',
};

export function AssetCard({ asset }: AssetCardProps) {
  const usdValue = asset.balance * asset.usdPrice;
  const colorClass = ASSET_COLORS[asset.code] ?? 'bg-surface-secondary text-foreground-secondary';

  return (
    <Card interactive className="p-4">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-button text-xs font-bold ${colorClass}`}
            >
              {asset.code}
            </div>
            <div>
              <h4 className="font-semibold text-sm text-foreground">{asset.name}</h4>
              <p className="font-mono text-2xs text-foreground-muted">{asset.code}</p>
            </div>
          </div>
          <Badge variant="outline" size="sm" className="font-mono">
            ${asset.usdPrice.toFixed(2)}
          </Badge>
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-xl font-bold tabular text-foreground">
              {formatCurrency(asset.balance, asset.code)}
            </span>
          </div>
          <p className="text-xs text-foreground-muted">
            {formatCurrency(usdValue, 'USD')} equivalent
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

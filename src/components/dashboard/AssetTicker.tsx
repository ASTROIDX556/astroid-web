'use client';

import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useAssetRates } from '@/hooks/use-queries';
import { formatStellarPrice, sortAssetRates } from '@/lib/stellar';
import { formatRelativeTime } from '@/lib/format';
import type { AssetRate } from '@/types/domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const assetColors: Record<string, string> = {
  XLM: 'bg-info-soft text-info',
  USDC: 'bg-success-soft text-success',
  yUSDF: 'bg-warning-soft text-warning',
  AQUA: 'bg-gold-soft text-gold-strong',
};

function ChangeIndicator({ change24h }: { change24h: number }) {
  const isPositive = change24h > 0;
  const isNeutral = change24h === 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-2xs font-medium tabular',
        isPositive && 'text-success',
        !isPositive && !isNeutral && 'text-danger',
        isNeutral && 'text-foreground-muted',
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" aria-hidden />
      ) : isNeutral ? (
        <Minus className="h-3 w-3" aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden />
      )}
      {isPositive ? '+' : ''}
      {change24h.toFixed(2)}%
    </span>
  );
}

function RateRow({ rate }: { rate: AssetRate }) {
  const colorClass = assetColors[rate.asset] ?? 'bg-surface-secondary text-foreground-secondary';

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary/50">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-md text-xs font-bold',
            colorClass,
          )}
          aria-hidden
        >
          {rate.asset.slice(0, 3)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{rate.asset}</p>
          <p className="text-2xs text-foreground-muted">
            {rate.source}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 tabular">
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">
            {formatStellarPrice(rate.priceUsd)}
          </p>
        </div>
        <div className="w-20 text-right">
          <ChangeIndicator change24h={rate.change24h} />
        </div>
      </div>
    </div>
  );
}

function RateRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" rounded="md" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssetTicker — real-time Stellar asset conversion & exchange rate display
// ---------------------------------------------------------------------------

export interface AssetTickerProps {
  className?: string;
}

/**
 * Displays a live ticker of Stellar-native and custom token exchange rates.
 * Polls every 30 seconds via React Query's `refetchInterval` on the
 * `useAssetRates` hook. Includes skeleton loading states, 24h change
 * indicators, and is fully responsive.
 */
export function AssetTicker({ className }: AssetTickerProps) {
  const rates = useAssetRates();

  return (
    <Card elevation="soft" className={cn('overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Asset rates
          </h2>
          <Badge variant="info" size="sm">Live</Badge>
        </div>
        <div className="flex items-center gap-2 text-2xs text-foreground-muted">
          <RefreshCw
            className={cn(
              'h-3 w-3',
              rates.isFetching && 'animate-spin text-gold',
            )}
            aria-hidden
          />
          <span className="tabular">
            {rates.dataUpdatedAt
              ? `Updated ${formatRelativeTime(new Date(rates.dataUpdatedAt).toISOString())}`
              : 'Fetching…'}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {rates.isPending
          ? Array.from({ length: 4 }).map((_, i) => <RateRowSkeleton key={i} />)
          : sortAssetRates(rates.data ?? []).map((rate) => (
              <RateRow key={rate.asset} rate={rate} />
            ))}
      </div>

      <div className="border-t border-border px-4 py-2.5 text-center text-2xs text-foreground-muted">
        Prices sourced from Stellar DEX &amp; off-chain oracles. 24h change is approximate.
      </div>
    </Card>
  );
}

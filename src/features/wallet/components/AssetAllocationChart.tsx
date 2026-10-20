'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import { ChartFrame } from '@/components/charts/chart-frame';
import { Card } from '@/components/ui/card';
import {
  CATEGORICAL,
  ChartTooltipShell,
  type TooltipPayloadItem,
} from '@/components/charts';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AssetBalance } from '@/types/domain';

interface AllocationSlice {
  asset: string;
  balance: number;
  usdValue: number;
  /** Share of the allocation, 0..100. */
  percent: number;
  /** Value the donut slice is drawn from (fiat when quoted, else token balance). */
  weight: number;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export interface AssetAllocationChartProps {
  balances: AssetBalance[];
  height?: number;
  className?: string;
}

/**
 * Portfolio allocation donut for a Stellar wallet's asset balances.
 *
 * Slices are proportional to fiat (`usdValue`) when quotes exist and fall
 * back to raw token share when every quote is missing. Zero-balance assets
 * are excluded from the ring, a fully-empty portfolio renders an explicit
 * empty state, and a single-asset portfolio renders a full ring at 100%.
 * Colors come from the shared `CATEGORICAL` scale backed by `tokens.css`
 * chart variables, and the custom tooltip shows exact token amount, fiat
 * equivalent and percentage share.
 */
export function AssetAllocationChart({
  balances,
  height = 240,
  className,
}: AssetAllocationChartProps) {
  const mounted = useMounted();

  const { slices, totalUsd, hiddenZeroCount, useFiatWeights } = useMemo(() => {
    const funded = balances.filter((b) => b.balance > 0 || b.usdValue > 0);
    const zeroCount = balances.length - funded.length;
    const fiatTotal = funded.reduce((sum, b) => sum + b.usdValue, 0);
    const balanceTotal = funded.reduce((sum, b) => sum + b.balance, 0);
    const fiatWeights = fiatTotal > 0;
    const weightOf = (b: AssetBalance) =>
      fiatWeights ? b.usdValue : b.balance;
    const total = fiatWeights ? fiatTotal : balanceTotal;

    const sorted = [...funded].sort((a, b) => weightOf(b) - weightOf(a));
    const mapped: AllocationSlice[] = sorted.map((b) => ({
      asset: b.asset,
      balance: b.balance,
      usdValue: b.usdValue,
      weight: weightOf(b),
      percent: total > 0 ? (weightOf(b) / total) * 100 : 0,
    }));

    return {
      slices: mapped,
      totalUsd: fiatTotal,
      hiddenZeroCount: zeroCount,
      useFiatWeights: fiatWeights,
    };
  }, [balances]);

  if (!mounted) {
    return <div className={cn('skeleton w-full rounded-card', className)} style={{ height }} />;
  }

  if (slices.length === 0) {
    return (
      <Card className={cn('p-5', className)}>
        <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
          Asset allocation
        </p>
        <p className="mt-3 text-sm text-foreground-secondary">
          No funded assets yet. The allocation chart appears as soon as this
          wallet holds a non-zero balance.
        </p>
      </Card>
    );
  }

  const chartAriaLabel =
    slices.length === 1
      ? `Asset allocation: 100% ${slices[0]!.asset}`
      : `Asset allocation across ${slices.length} assets: ${slices
          .map((s) => `${s.asset} ${formatPercent(s.percent, 1)}`)
          .join(', ')}`;

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
          Asset allocation
        </p>
        {!useFiatWeights && (
          <p className="text-2xs text-foreground-muted">share by token balance</p>
        )}
      </div>

      <div className="relative mt-4" role="img" aria-label={chartAriaLabel}>
        <ChartFrame label={chartAriaLabel} height={height}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="weight"
              nameKey="asset"
              innerRadius="58%"
              outerRadius="80%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = (payload as TooltipPayloadItem[])[0]?.payload as
                  | AllocationSlice
                  | undefined;
                if (!row) return null;
                return (
                  <ChartTooltipShell label={row.asset}>
                    <span className="tabular font-medium text-foreground">
                      {formatNumber(row.balance)} {row.asset}
                    </span>
                    <span className="text-foreground-secondary">
                      {formatPercent(row.percent, row.percent > 0 && row.percent < 10 ? 1 : 0)} of portfolio
                    </span>
                    {useFiatWeights && (
                      <span className="tabular text-foreground-secondary">
                        {formatCurrency(row.usdValue, 'USDC')}
                      </span>
                    )}
                  </ChartTooltipShell>
                );
              }}
            />
          </PieChart>
        </ChartFrame>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {useFiatWeights ? (
            <>
              <span className="tabular font-display text-xl font-semibold tracking-tight">
                {formatCurrency(totalUsd, 'USDC', { compact: true })}
              </span>
              <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
                Total value
              </span>
            </>
          ) : (
            <span className="text-2xs uppercase tracking-wide text-foreground-secondary">
              {slices.length === 1 ? '100% single asset' : `${slices.length} assets`}
            </span>
          )}
        </div>
      </div>

      <ul
        className="mt-4 flex flex-wrap gap-x-4 gap-y-2"
        aria-label="Asset allocation legend"
      >
        {slices.map((slice, i) => (
          <li key={slice.asset} className="inline-flex items-center gap-1.5 text-2xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }}
              aria-hidden
            />
            <span className="font-medium text-foreground">{slice.asset}</span>
            <span className="tabular text-foreground-muted">
              {formatPercent(slice.percent, slice.percent > 0 && slice.percent < 10 ? 1 : 0)}
            </span>
          </li>
        ))}
        {hiddenZeroCount > 0 && (
          <li className="inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
            +{hiddenZeroCount} zero-balance {hiddenZeroCount === 1 ? 'asset' : 'assets'} hidden
          </li>
        )}
      </ul>
    </Card>
  );
}

export default AssetAllocationChart;

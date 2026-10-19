'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bot,
  Coins,
  DollarSign,
  Layers,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/motion';
import { CATEGORICAL, ChartTooltipShell } from '@/components/charts';
import type { TooltipPayloadItem } from '@/components/charts';
import { cn } from '@/lib/cn';
import { isMockMode } from '@/lib/env';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { formatStellarAddress } from '@/lib/stellar';
import {
  parseTrustlineBalances,
  totalHoldingsValue,
} from '@/features/wallet/utils/assetBreakdown';
import { mockAssetPricesUsd, mockTrustlineBalances } from '@/features/wallet/mock-data';
import type { AssetClass, AssetHolding, HorizonBalance } from '@/features/wallet/types';

/* -------------------------------------------------------------------------- */
/* Presentation metadata                                                       */
/* -------------------------------------------------------------------------- */

const CLASS_META: Record<
  AssetClass,
  { label: string; Icon: LucideIcon; badge: 'gold' | 'info' | 'success' | 'neutral' }
> = {
  native: { label: 'Native', Icon: Coins, badge: 'gold' },
  stablecoin: { label: 'Stablecoin', Icon: DollarSign, badge: 'info' },
  reward: { label: 'Agent reward', Icon: Bot, badge: 'success' },
  custom: { label: 'Custom', Icon: Layers, badge: 'neutral' },
};

/** Chart palette is token-driven (`--chart-1…8`), so both themes stay in range. */
function seriesColor(index: number): string {
  return CATEGORICAL[index % CATEGORICAL.length] ?? 'rgb(var(--chart-1))';
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

export interface AssetBreakdownWidgetProps {
  /**
   * Horizon-shaped account balances. Leave undefined to fall back to the mock
   * treasury when `NEXT_PUBLIC_API_URL` is unset.
   */
  balances?: readonly HorizonBalance[];
  /**
   * Unit prices in USD keyed by asset code. Defaults to the mock price table
   * in mock mode; codes with no price keep their token amount but contribute
   * nothing to the value shares.
   */
  pricesUsd?: Readonly<Record<string, number>>;
  /** Heading rendered above the breakdown. */
  title?: string;
  className?: string;
}

/** Avoids a server/client mismatch on Recharts' measured SVG. */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Multi-currency balance breakdown: a Recharts allocation ribbon over a
 * structured holdings table showing each asset's code, truncated issuer,
 * token amount, unit price, USD value, and share of the portfolio.
 *
 * Parses Stellar trustlines straight from the Horizon `balances[]` shape, so
 * it can be pointed at a live account or at the bundled mock treasury without
 * a backend. Issuer keys are checksum-validated; an unverified issuer or a
 * frozen trustline is flagged in the row rather than hidden.
 */
export function AssetBreakdownWidget({
  balances,
  pricesUsd,
  title = 'Asset breakdown',
  className,
}: AssetBreakdownWidgetProps) {
  const mounted = useMounted();

  // In mock mode everything rendered here is the bundled fixture — whether the
  // caller passed it or the resource layer resolved it.
  const usingMockData = isMockMode;

  // Fallbacks are resolved inside the memo so the empty defaults are not
  // reallocated on every render.
  const holdings = useMemo(() => {
    // Two layers: the resource layer serves the fixture in mock mode, and a
    // prop-less widget falls back on its own so it renders standalone. An
    // empty array from a live API is a real, empty account and stays empty.
    const sourceBalances = balances ?? (isMockMode ? mockTrustlineBalances : []);
    const prices = pricesUsd ?? (isMockMode ? mockAssetPricesUsd : {});
    return parseTrustlineBalances(sourceBalances, prices);
  }, [balances, pricesUsd]);

  const totalUsd = useMemo(() => totalHoldingsValue(holdings), [holdings]);

  /** One stacked row keyed by holding id — each holding becomes a segment. */
  const allocationRow = useMemo<Record<string, number>>(() => {
    const row: Record<string, number> = {};
    for (const holding of holdings) row[holding.id] = holding.share;
    return row;
  }, [holdings]);

  const byId = useMemo(
    () => new Map(holdings.map((holding) => [holding.id, holding])),
    [holdings],
  );

  if (holdings.length === 0) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <p className="text-sm text-foreground-secondary">No asset balances to show.</p>
        <p className="mt-1 text-2xs text-foreground-muted">
          Add a trustline to hold issued assets alongside the native XLM balance.
        </p>
      </Card>
    );
  }

  const hasValue = totalUsd > 0;

  return (
    <Card className={cn('p-5', className)}>
      {/* Header ----------------------------------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
            {title}
          </h3>
          <p className="tabular mt-1 font-display text-3xl font-semibold leading-none tracking-tight">
            <AnimatedNumber
              value={totalUsd}
              formatter={(value) => formatCurrency(value, 'USDC')}
            />
          </p>
          <p className="mt-1.5 text-2xs text-foreground-secondary">
            {holdings.length} {holdings.length === 1 ? 'asset' : 'assets'} across XLM
            and issued trustlines
          </p>
        </div>
        {usingMockData && (
          <Badge variant="outline" size="sm" title="NEXT_PUBLIC_API_URL is unset">
            Mock data
          </Badge>
        )}
      </div>

      {/* Allocation ribbon ------------------------------------------------ */}
      <div className="mt-5">
        {hasValue ? (
          <div className="overflow-hidden rounded-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height={28}>
                <BarChart
                  data={[allocationRow]}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" hide />
                  <RechartsTooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = (payload as TooltipPayloadItem[])[0];
                      const holding = byId.get(String(item?.dataKey ?? ''));
                      if (!holding) return null;
                      return (
                        <ChartTooltipShell label={holding.code}>
                          <span className="tabular font-medium text-foreground">
                            {formatCurrency(holding.usdValue, 'USDC')}
                          </span>
                          <span className="text-foreground-secondary">
                            {formatPercent(holding.share, 1)} of portfolio
                          </span>
                        </ChartTooltipShell>
                      );
                    }}
                  />
                  {holdings.map((holding, index) => (
                    <Bar
                      key={holding.id}
                      dataKey={holding.id}
                      name={holding.code}
                      stackId="allocation"
                      fill={seriesColor(index)}
                      barSize={28}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="skeleton h-7 w-full" />
            )}
          </div>
        ) : (
          <div className="py-1.5 rounded-full border border-dashed border-border px-3 text-center text-2xs text-foreground-muted">
            No priced holdings — allocation shares are unavailable.
          </div>
        )}

        {/* Legend — the chart's accessible equivalent. */}
        <ul className="gap-y-1.5 mt-3 flex flex-wrap gap-x-4">
          {holdings.map((holding, index) => (
            <li
              key={holding.id}
              className="gap-1.5 flex items-center text-2xs text-foreground-secondary"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: seriesColor(index) }}
                aria-hidden
              />
              <span className="font-medium text-foreground">{holding.code}</span>
              <span className="tabular">{formatPercent(holding.share, 1)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Holdings table --------------------------------------------------- */}
      <div
        role="region"
        aria-label="Asset holdings table, scrollable horizontally"
        tabIndex={0}
        className="-mx-5 mt-5 overflow-x-auto px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full min-w-[640px] border-collapse text-left">
          <caption className="sr-only">
            Balance breakdown by asset: code, issuer, amount held, unit price, value in
            US dollars, and share of the portfolio.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="py-2 pr-4 text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Asset
              </th>
              <th
                scope="col"
                className="py-2 pr-4 text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Issuer
              </th>
              <th
                scope="col"
                className="py-2 pr-4 text-right text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Amount
              </th>
              <th
                scope="col"
                className="py-2 pr-4 text-right text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Price
              </th>
              <th
                scope="col"
                className="py-2 pr-4 text-right text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Value
              </th>
              <th
                scope="col"
                className="py-2 text-right text-2xs font-medium uppercase tracking-[0.12em] text-foreground-muted"
              >
                Allocation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.map((holding, index) => (
              <AssetBreakdownRow
                key={holding.id}
                holding={holding}
                color={seriesColor(index)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

function AssetBreakdownRow({
  holding,
  color,
}: {
  holding: AssetHolding;
  color: string;
}) {
  const meta = CLASS_META[holding.assetClass];

  return (
    <tr>
      {/* Asset -------------------------------------------------------- */}
      <td className="py-3 pr-4 align-middle">
        <div className="flex items-center gap-3">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          >
            <meta.Icon className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <div className="gap-1.5 flex items-center">
              <span className="text-sm font-medium text-foreground">
                {holding.code}
              </span>
              <Badge variant={meta.badge} size="sm">
                {meta.label}
              </Badge>
              {!holding.authorized && (
                <span
                  className="inline-flex items-center gap-1 text-2xs font-medium text-warning"
                  title="The issuer has frozen this trustline"
                >
                  <ShieldAlert className="h-3 w-3" aria-hidden />
                  Frozen
                </span>
              )}
            </div>
            <span className="block truncate text-2xs text-foreground-muted">
              {holding.name}
            </span>
          </div>
        </div>
      </td>

      {/* Issuer ------------------------------------------------------- */}
      <td className="py-3 pr-4 align-middle">
        {holding.issuer === null ? (
          <span className="text-2xs text-foreground-muted">Native asset</span>
        ) : (
          <span className="gap-1.5 inline-flex items-center">
            <span
              className="font-mono text-2xs text-foreground-secondary"
              title={holding.issuer}
            >
              {formatStellarAddress(holding.issuer, { lead: 4, tail: 4 })}
            </span>
            {holding.issuerVerified ? (
              <ShieldCheck
                className="h-3 w-3 shrink-0 text-success"
                aria-label="Issuer key passes checksum validation"
              />
            ) : (
              <TriangleAlert
                className="h-3 w-3 shrink-0 text-danger"
                aria-label="Issuer key failed checksum validation"
              />
            )}
          </span>
        )}
      </td>

      {/* Amount ------------------------------------------------------- */}
      <td className="tabular py-3 pr-4 text-right align-middle text-sm text-foreground">
        {formatNumber(holding.amount)}
        {holding.limit !== null && holding.limit > 0 && (
          <span className="block text-2xs text-foreground-muted">
            limit {formatNumber(holding.limit, true)}
          </span>
        )}
      </td>

      {/* Price -------------------------------------------------------- */}
      <td className="tabular py-3 pr-4 text-right align-middle text-2xs text-foreground-secondary">
        {holding.priceUsd > 0
          ? `$${holding.priceUsd.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}`
          : '—'}
      </td>

      {/* Value -------------------------------------------------------- */}
      <td className="tabular py-3 pr-4 text-right align-middle text-sm font-medium text-foreground">
        {holding.priceUsd > 0 ? formatCurrency(holding.usdValue, 'USDC') : '—'}
      </td>

      {/* Allocation --------------------------------------------------- */}
      <td className="py-3 align-middle">
        <div className="flex items-center justify-end gap-2">
          <span
            className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-secondary"
            aria-hidden
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, holding.share)}%`,
                backgroundColor: color,
              }}
            />
          </span>
          <span className="tabular w-11 text-right text-2xs text-foreground-secondary">
            {formatPercent(holding.share, 1)}
          </span>
        </div>
      </td>
    </tr>
  );
}

export default AssetBreakdownWidget;

'use client';

import { useMemo, useState } from 'react';
import { Coins, DollarSign, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimatedNumber } from '@/components/ui/motion';
import { formatCurrency, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AssetBalance } from '@/types/domain';

type AssetFilter = 'all' | 'native' | 'stablecoin' | 'custom';

const STABLECOIN_CODES = new Set(['USDC', 'EURC']);
const NATIVE_CODES = new Set(['XLM']);

/** Shared WCAG AA focus ring for the focusable balance card and asset rows. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const CATEGORY_LABEL: Record<Exclude<AssetFilter, 'all'>, string> = {
  native: 'Native',
  stablecoin: 'Stablecoin',
  custom: 'Custom',
};

function classifyAsset(code: string): Exclude<AssetFilter, 'all'> {
  if (NATIVE_CODES.has(code)) return 'native';
  if (STABLECOIN_CODES.has(code)) return 'stablecoin';
  return 'custom';
}

const filterOptions: { value: AssetFilter; label: string; icon: React.ReactNode }[] = [
  {
    value: 'all',
    label: 'All assets',
    icon: <Layers className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'native',
    label: 'XLM',
    icon: <Coins className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'stablecoin',
    label: 'Stablecoins',
    icon: <DollarSign className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    value: 'custom',
    label: 'Custom',
    icon: <Layers className="h-3.5 w-3.5" aria-hidden />,
  },
];

interface MultiCurrencyBalanceWidgetProps {
  balances: AssetBalance[];
  className?: string;
}

/**
 * Asset-level balance breakdown with toggleable native / stablecoin / custom
 * filters and a zero-balance visibility switch. Filtering is purely client-side
 * over the wallet's existing `balances` array — no layout shift on toggle since
 * rows are hidden, not remeasured.
 */
export function MultiCurrencyBalanceWidget({
  balances,
  className,
}: MultiCurrencyBalanceWidgetProps) {
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [showZeroBalances, setShowZeroBalances] = useState(true);

  const totalUsdValue = useMemo(
    () => balances.reduce((sum, b) => sum + b.usdValue, 0),
    [balances],
  );

  const visibleBalances = useMemo(() => {
    return balances.filter((b) => {
      if (!showZeroBalances && b.balance === 0) return false;
      if (filter === 'all') return true;
      return classifyAsset(b.asset) === filter;
    });
  }, [balances, filter, showZeroBalances]);

  const hasZeroBalances = balances.some((b) => b.balance === 0);

  return (
    <Card
      role="region"
      aria-label="Multi-currency asset balances"
      tabIndex={0}
      className={cn('rounded-card p-5', FOCUS_RING, className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
            Total value
          </p>
          <p className="tabular font-display text-3xl font-semibold tracking-tight">
            <AnimatedNumber
              value={totalUsdValue}
              formatter={(v) => formatCurrency(v, 'USDC')}
            />
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter assets by type"
          className="gap-1.5 flex flex-wrap items-center"
        >
          {filterOptions.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                aria-pressed={active}
                className={cn(
                  'gap-1.5 px-2.5 py-1.5 inline-flex items-center rounded-button border text-2xs font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-gold bg-gold-soft text-gold-strong'
                    : 'border-border text-foreground-secondary hover:border-border-strong hover:text-foreground',
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasZeroBalances && (
        <label className="mt-4 flex w-fit items-center gap-2 text-2xs text-foreground-secondary">
          <input
            type="checkbox"
            checked={showZeroBalances}
            onChange={(e) => setShowZeroBalances(e.target.checked)}
            className="h-3.5 w-3.5 rounded-xs border-border accent-gold"
          />
          Show zero-balance assets
        </label>
      )}

      <ul className="mt-4 divide-y divide-border" aria-label="Asset balances">
        {visibleBalances.length === 0 ? (
          <li className="py-6 text-center text-sm text-foreground-secondary">
            No assets match this filter.
          </li>
        ) : (
          visibleBalances.map((b) => {
            const category = classifyAsset(b.asset);
            const balanceLabel = `${formatNumber(b.balance)} ${b.asset}`;
            const valueLabel = formatCurrency(b.usdValue, 'USDC');
            const rowLabel = `${b.asset}, ${CATEGORY_LABEL[category].toLowerCase()} asset. Balance ${balanceLabel}. Value ${valueLabel}.`;

            return (
              <li
                key={b.asset}
                tabIndex={0}
                aria-label={rowLabel}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-sm py-3 first:pt-0 last:pb-0',
                  FOCUS_RING,
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-secondary text-2xs font-semibold text-foreground-secondary"
                    aria-hidden
                  >
                    {b.asset.slice(0, 2)}
                  </span>
                  <div>
                    <div className="gap-1.5 flex items-center">
                      <span className="text-sm font-medium text-foreground">
                        {b.asset}
                      </span>
                      <Badge
                        variant={
                          category === 'native'
                            ? 'gold'
                            : category === 'stablecoin'
                              ? 'info'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {CATEGORY_LABEL[category]}
                      </Badge>
                    </div>
                    <span className="tabular text-2xs text-foreground-muted">
                      {balanceLabel}
                    </span>
                  </div>
                </div>
                <span className="tabular text-sm font-medium text-foreground">
                  {valueLabel}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

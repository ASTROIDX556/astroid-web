'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWalletBalances } from '@/hooks/use-queries';
import {
  BALANCE_SKELETON_ROWS,
  balanceCardsErrorMessage,
  resolveBalanceCardsState,
} from '@/features/wallet/utils/balanceCards';
import { AssetAllocationChart } from './AssetAllocationChart';
import { MultiCurrencyBalanceWidget } from './MultiCurrencyBalanceWidget';

interface WalletBalanceCardsProps {
  walletId: string;
}

/** Same 200ms cross-fade the dashboard QueryBoundary uses between query states. */
const stateTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

/** The two balance cards share one grid; declared once so skeleton and content never drift. */
const cardsGridClassName =
  'grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_1fr] xl:grid-cols-[minmax(0,420px)_1fr]';

/**
 * Loading placeholder mirroring the two balance cards at their real dimensions:
 * the allocation donut card (240px chart + legend rows) and the multi-currency
 * list card (total value, filter chips, asset rows), so nothing shifts when
 * the balances fetch resolves.
 */
function BalanceCardsSkeleton() {
  return (
    <div
      className={cardsGridClassName}
      role="status"
      aria-label="Loading wallet balances"
    >
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <div className="mt-4 flex h-[240px] items-center justify-center">
          <Skeleton className="h-40 w-40" rounded="full" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-20" />
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-2/3" />
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24" />
          ))}
        </div>
        <div className="mt-4 divide-y divide-border">
          {Array.from({ length: BALANCE_SKELETON_ROWS }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" rounded="full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * Wallet balance card section with a structured lifecycle: skeleton loaders at
 * card dimensions while the balances fetch is in flight, an in-place error
 * card with a retry button when it fails, then the allocation donut and the
 * multi-currency breakdown. Fetches through `useWalletBalances` so the cards
 * no longer ride the page-wide query gate.
 */
export function WalletBalanceCards({ walletId }: WalletBalanceCardsProps) {
  const balances = useWalletBalances(walletId);
  const viewState = resolveBalanceCardsState({
    isPending: balances.isPending,
    isError: balances.isError,
  });

  return (
    <AnimatePresence mode="wait">
      {viewState === 'loading' ? (
        <motion.div key="balances-loading" {...stateTransition}>
          <BalanceCardsSkeleton />
        </motion.div>
      ) : viewState === 'error' ? (
        <motion.div key="balances-error" {...stateTransition}>
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-card border border-dashed border-danger/40 bg-danger-soft/30 p-10 text-center"
          >
            <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                Balances unavailable
              </h3>
              <p className="max-w-sm text-xs text-foreground-secondary">
                {balanceCardsErrorMessage(balances.error)}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => balances.refetch()}
            >
              Retry
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="balances-ready" {...stateTransition}>
          <div className={cardsGridClassName}>
            <AssetAllocationChart balances={balances.data ?? []} />
            <MultiCurrencyBalanceWidget balances={balances.data ?? []} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

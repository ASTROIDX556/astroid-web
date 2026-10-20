'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/ui/motion';
import {
  DEFAULT_WALLET_POLL_INTERVAL_MS,
  useStellarAccount,
} from '@/hooks/useStellarAccount';
import { cn } from '@/lib/cn';
import { formatCurrency, formatNumber, formatRelativeTime, truncateHash } from '@/lib/format';

interface StellarAccountSyncPanelProps {
  /** Stellar account to poll (public key of the wallet being viewed). */
  publicKey: string;
  /** Poll cadence in ms; pass `false` to disable automatic refresh. */
  pollIntervalMs?: number | false;
  className?: string;
}

type SyncState = 'disconnected' | 'error' | 'stale' | 'syncing' | 'live';

const syncBadge: Record<
  SyncState,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; dot?: boolean }
> = {
  live: { label: 'Live', variant: 'success', dot: true },
  syncing: { label: 'Syncing', variant: 'info', dot: true },
  stale: { label: 'Stale', variant: 'warning', dot: true },
  error: { label: 'Offline', variant: 'danger', dot: true },
  disconnected: { label: 'Not connected', variant: 'neutral' },
};

/** One metric block; used by both the skeleton and the resolved grid so heights match. */
function StatBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
        {label}
      </dt>
      <dd className="mt-2 flex h-7 items-center font-display text-2xl font-semibold leading-none tracking-tight tabular">
        {children}
      </dd>
    </div>
  );
}

/**
 * Live account strip for the wallet dashboard.
 *
 * Reads the account through `useStellarAccount`, which polls every 30 seconds
 * and caches the snapshot under `['wallet', publicKey]`. The skeleton mirrors
 * the resolved grid exactly, and in-flight refreshes keep the previous values
 * visible, so polling and retries never move the page around.
 */
export function StellarAccountSyncPanel({
  publicKey,
  pollIntervalMs,
  className,
}: StellarAccountSyncPanelProps) {
  const account = useStellarAccount({ publicKey, pollIntervalMs });

  const syncState: SyncState = !account.hasAccount
    ? 'disconnected'
    : account.isError
      ? account.snapshot
        ? 'stale'
        : 'error'
      : account.isPending
        ? 'syncing'
        : account.isFetching
          ? 'syncing'
          : 'live';

  const badge = syncBadge[syncState];
  const cadenceMs =
    typeof pollIntervalMs === 'number'
      ? pollIntervalMs
      : pollIntervalMs === false
        ? 0
        : DEFAULT_WALLET_POLL_INTERVAL_MS;
  const seconds = Math.round(cadenceMs / 1000);

  const transactionValue =
    account.transactionCount === null
      ? '—'
      : `${formatNumber(account.transactionCount)}${account.transactionCountIsLowerBound ? '+' : ''}`;

  return (
    <Card
      className={cn('p-5', className)}
      aria-busy={account.isPending || account.isFetching}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-2xs font-medium uppercase tracking-[0.12em] text-foreground-secondary">
              Live Stellar account
            </p>
            <Badge variant={badge.variant} size="sm" dot={badge.dot}>
              {badge.label}
            </Badge>
          </div>
          <p className="mt-1 font-mono text-2xs text-foreground-muted">
            {account.hasAccount ? truncateHash(account.publicKey, 6, 6) : 'No wallet address'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="tabular text-2xs text-foreground-muted"
            aria-live="polite"
            aria-atomic="true"
          >
            {account.snapshot
              ? `Synced ${formatRelativeTime(account.snapshot.fetchedAt)}`
              : account.isPending
                ? 'Fetching…'
                : 'Not synced'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            loading={account.isRefreshing}
            disabled={!account.hasAccount}
            onClick={() => void account.refresh()}
            aria-label="Refresh wallet balances now"
            leftIcon={
              <RefreshCw
                className={cn('h-3.5 w-3.5', account.isFetching && !account.isRefreshing && 'animate-spin')}
                aria-hidden
              />
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {!account.hasAccount ? (
        <p className="mt-5 text-xs text-foreground-secondary">
          Connect a Stellar wallet to load its balances, holdings and activity.
        </p>
      ) : account.isPending ? (
        <div aria-label="Loading account summary" role="status">
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatBlock label="Total value">
              <Skeleton className="h-6 w-24" />
            </StatBlock>
            <StatBlock label="Assets held">
              <Skeleton className="h-6 w-10" />
            </StatBlock>
            <StatBlock label="Transactions">
              <Skeleton className="h-6 w-14" />
            </StatBlock>
          </dl>
          {/* Reserves the footer line so the card height matches the ready state. */}
          <Skeleton className="mt-3 h-4 w-40" />
        </div>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatBlock label="Total value">
              <AnimatedNumber
                value={account.totalUsdValue}
                formatter={(value) => formatCurrency(value, 'USDC')}
              />
            </StatBlock>
            <StatBlock label="Assets held">
              <span aria-label={`${account.holdings.length} assets with a balance`}>
                {formatNumber(account.holdings.length)}
              </span>
            </StatBlock>
            <StatBlock label="Transactions">
              <span
                aria-label={
                  account.transactionCount === null
                    ? 'Transaction count unavailable'
                    : `${transactionValue} transactions observed`
                }
              >
                {transactionValue}
              </span>
            </StatBlock>
          </dl>

          {/*
           * Single reserved footer row: the refresh cadence in the healthy
           * state, the failure reason + retry when stale. Keeping both in the
           * same slot means an error never changes the card height.
           */}
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex h-4 items-center gap-1.5 overflow-hidden text-2xs text-foreground-muted"
          >
            {account.isError && account.errorMessage ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <span className="truncate" title={account.errorMessage}>
                  {account.errorMessage}
                </span>
                <button
                  type="button"
                  onClick={() => void account.refresh()}
                  className="shrink-0 font-medium text-warning underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry
                </button>
              </>
            ) : (
              <span>
                {seconds > 0
                  ? `Auto-refreshes every ${seconds}s.`
                  : 'Manual refresh only.'}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

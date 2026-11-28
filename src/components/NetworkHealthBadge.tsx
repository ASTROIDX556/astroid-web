'use client';

import { Activity, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useStellarHealth } from '@/hooks/useStellarHealth';
import type { NetworkHealthData } from '@/features/network/types';
import { cn } from '@/lib/cn';

/** Shared, brand-tinted focus ring for badge controls (WCAG AA). */
const BADGE_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Tooltip content detailing block height, latency, and node status. */
function HealthTooltip({ data }: { data: NetworkHealthData }) {
  if (!data) return null;
  const isHealthy = data.status === 'healthy';
  const isDegraded = data.status === 'degraded';

  return (
    <div className="text-xs leading-none min-w-[180px]">
      <div className="flex justify-between mb-1.5">
        <span className="text-foreground-secondary">Stellar RPC health</span>
        <Badge
          variant={isHealthy ? 'success' : isDegraded ? 'warning' : 'danger'}
          size="sm"
          className="capitalize"
        >
          {data.status}
        </Badge>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-foreground-secondary">Ledger</span>
        <span className="text-foreground font-mono">#{data.ledgerSequence}</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-foreground-secondary">Latency</span>
        <span className="text-foreground font-mono">{data.rpcLatencyMs} ms</span>
      </div>
      <div className="flex justify-between mb-1">
        <span className="text-foreground-secondary">Horizon</span>
        <span className="text-foreground capitalize">{data.horizonStatus}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-foreground-secondary">Soroban</span>
        <span className="text-foreground capitalize">{data.sorobanStatus}</span>
      </div>
    </div>
  );
}

export function NetworkHealthBadge() {
  const { data, isPending, isError, error, refetch } = useStellarHealth();

  // Loading state — no data yet
  if (isPending && !data) {
    return (
      <Tooltip content="Checking Stellar RPC health…">
        <button
          type="button"
          role="status"
          aria-label="Stellar RPC network health: checking"
          aria-busy="true"
          disabled
          className={cn(
            'flex items-center gap-1.5 rounded-button border border-border bg-surface px-2 py-1 text-2xs text-foreground-muted animate-pulse',
            BADGE_FOCUS,
          )}
        >
          <Activity className="h-3.5 w-3.5 text-gold animate-spin" aria-hidden />
          <span>RPC…</span>
        </button>
      </Tooltip>
    );
  }

  // Error state — no data available
  if (isError || !data) {
    return (
      <Tooltip content={error?.message ?? 'Stellar RPC is unreachable. Click to retry.'}>
        <button
          type="button"
          role="status"
          aria-label="Stellar RPC network health: offline"
          onClick={() => void refetch()}
          className={cn(
            'flex items-center gap-1.5 rounded-button border border-danger/30 bg-danger-soft px-2.5 py-1 text-2xs font-semibold text-danger hover:bg-danger/10 transition-colors',
            BADGE_FOCUS,
          )}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          <span>RPC Offline</span>
        </button>
      </Tooltip>
    );
  }

  const isHealthy = data.status === 'healthy';
  const isDegraded = data.status === 'degraded';
  const badgeVariant = isHealthy ? 'success' : isDegraded ? 'warning' : 'danger';

  return (
    <Tooltip content={<HealthTooltip data={data} />} side="top">
      <button
        type="button"
        role="status"
        aria-live="polite"
        aria-label={`Stellar network health: ${data.status}, ledger ${data.ledgerSequence}, ${data.rpcLatencyMs} milliseconds latency`}
        onClick={() => void refetch()}
        className={cn(
          'flex items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1.5 text-2xs font-medium transition-colors hover:border-gold hover:bg-surface-secondary',
          BADGE_FOCUS,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isHealthy ? 'bg-success' : isDegraded ? 'bg-warning' : 'bg-danger'
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isHealthy ? 'bg-success' : isDegraded ? 'bg-warning' : 'bg-danger'
            }`}
          />
        </span>

        <span className="hidden sm:inline-block font-mono text-foreground font-semibold">
          #{data.ledgerSequence}
        </span>

        <span className="font-mono text-foreground-secondary tabular">
          {data.rpcLatencyMs}ms
        </span>

        <Badge variant={badgeVariant} size="sm" className="capitalize text-3xs py-0 px-1.5">
          {data.status}
        </Badge>
      </button>
    </Tooltip>
  );
}

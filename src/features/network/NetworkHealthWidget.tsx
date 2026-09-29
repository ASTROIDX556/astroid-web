'use client';

import React, { useState } from 'react';
import { Activity, Server, Cpu, RefreshCw, XCircle, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNetworkHealth } from './useNetworkHealth';

export function NetworkHealthWidget() {
  const { data, isLoading, isError, refetch, isFetching } = useNetworkHealth(5000);
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1 text-2xs text-foreground-muted animate-pulse">
        <Activity className="h-3.5 w-3.5 text-gold animate-spin" />
        <span>Ping RPC...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-1.5 rounded-button border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-2xs font-semibold text-rose-400">
        <XCircle className="h-3.5 w-3.5" />
        <span>RPC Offline</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-1 text-2xs underline hover:text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const isHealthy = data.status === 'healthy';
  const isDegraded = data.status === 'degraded';

  const badgeVariant = isHealthy ? 'success' : isDegraded ? 'warning' : 'danger';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-button border border-border bg-surface px-2.5 py-1.5 text-2xs font-medium transition-colors hover:border-gold hover:bg-surface-secondary"
        aria-label="Toggle Stellar RPC Network Health Monitor"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              isHealthy ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-rose-400'
            }`}
          />
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'
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

        <ChevronDown className="h-3 w-3 text-foreground-muted" />
      </button>

      {/* Expanded Health Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-card border border-border bg-surface p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Activity className="h-4 w-4 text-gold" />
              <span>{data.networkName} Health</span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-foreground-muted hover:text-foreground transition-colors"
              title="Refresh RPC Latency"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-gold' : ''}`} />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-surface-secondary/60 p-2 rounded-button">
              <span className="flex items-center gap-1.5 text-foreground-secondary text-2xs">
                <Cpu className="h-3.5 w-3.5 text-gold" />
                <span>Soroban RPC Node</span>
              </span>
              <Badge variant="success" size="sm" className="text-3xs uppercase">
                {data.sorobanStatus}
              </Badge>
            </div>

            <div className="flex justify-between items-center bg-surface-secondary/60 p-2 rounded-button">
              <span className="flex items-center gap-1.5 text-foreground-secondary text-2xs">
                <Server className="h-3.5 w-3.5 text-blue-400" />
                <span>Horizon API Node</span>
              </span>
              <Badge variant="success" size="sm" className="text-3xs uppercase">
                {data.horizonStatus}
              </Badge>
            </div>

            <div className="flex justify-between items-center pt-1 text-2xs text-foreground-muted font-mono">
              <span>Ledgers Closed: #{data.ledgerSequence}</span>
              <span>Latency: {data.rpcLatencyMs} ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

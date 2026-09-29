'use client';

import { Radio, RadioTower, WifiOff } from 'lucide-react';
import type { TelemetryConnectionStatus } from '@/hooks/useAgentTelemetrySubscription';

const STATUS_CONFIG: Record<
  TelemetryConnectionStatus,
  { label: string; icon: typeof Radio; dot: string; text: string }
> = {
  connected: { label: 'Live', icon: RadioTower, dot: 'bg-emerald-500', text: 'text-emerald-500' },
  connecting: { label: 'Connecting', icon: Radio, dot: 'bg-amber-500', text: 'text-amber-500' },
  offline: { label: 'Offline', icon: WifiOff, dot: 'bg-foreground-muted', text: 'text-foreground-muted' },
};

export interface TelemetryStatusIndicatorProps {
  status: TelemetryConnectionStatus;
}

/**
 * Compact top-bar indicator for the {@link useAgentTelemetrySubscription}
 * connection state — live socket, negotiating, or simulated/offline fallback.
 */
export function TelemetryStatusIndicator({ status }: TelemetryStatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className="hidden items-center gap-1.5 rounded-button border border-border bg-surface px-2.5 py-1 text-2xs font-medium sm:flex"
      title={`Agent telemetry: ${config.label}`}
      aria-live="polite"
    >
      <span className="relative flex h-1.5 w-1.5">
        {status === 'connected' && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dot}`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`} />
      </span>
      <Icon className={`h-3.5 w-3.5 ${config.text}`} aria-hidden />
      <span className={`hidden md:inline-block ${config.text}`}>{config.label}</span>
    </div>
  );
}

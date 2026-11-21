'use client';

import { Radio, RadioTower, WifiOff } from 'lucide-react';
import type { TelemetryConnectionStatus } from '@/hooks/useAgentTelemetrySubscription';

const STATUS_CONFIG: Record<
  TelemetryConnectionStatus,
  { label: string; icon: typeof Radio; dot: string; text: string }
> = {
  connected: {
    label: 'Live',
    icon: RadioTower,
    dot: 'bg-emerald-500',
    text: 'text-emerald-500',
  },
  connecting: {
    label: 'Connecting',
    icon: Radio,
    dot: 'bg-amber-500',
    text: 'text-amber-500',
  },
  offline: {
    label: 'Offline',
    icon: WifiOff,
    dot: 'bg-foreground-muted',
    text: 'text-foreground-muted',
  },
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
      className="gap-1.5 px-2.5 hidden items-center rounded-button border border-border bg-surface py-1 text-2xs font-medium sm:flex"
      title={`Agent telemetry: ${config.label}`}
      role="status"
      aria-label={`Agent telemetry status: ${config.label}`}
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 relative flex">
        {status === 'connected' && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.dot}`}
          />
        )}
        <span
          className={`h-1.5 w-1.5 relative inline-flex rounded-full ${config.dot}`}
        />
      </span>
      <Icon className={`h-3.5 w-3.5 ${config.text}`} aria-hidden />
      <span className={`hidden md:inline-block ${config.text}`}>{config.label}</span>
      <span className="sr-only">Agent telemetry is {config.label.toLowerCase()}</span>
    </div>
  );
}

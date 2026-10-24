'use client';

import { AlertTriangle, CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { XdrSigningStatus } from './useXdrSigner';

const TRACKER_STEPS: { id: XdrSigningStatus; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'requesting', label: 'Requesting' },
  { id: 'signing', label: 'Signing' },
  { id: 'signed', label: 'Signed' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_CONFIG: Record<XdrSigningStatus, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; Icon: typeof Clock3 }> = {
  idle: { label: 'Idle', variant: 'neutral', Icon: Clock3 },
  requesting: { label: 'Waiting for wallet', variant: 'info', Icon: Loader2 },
  signing: { label: 'Signing transaction', variant: 'warning', Icon: Loader2 },
  signed: { label: 'Signed', variant: 'success', Icon: CheckCircle2 },
  failed: { label: 'Signing failed', variant: 'danger', Icon: AlertTriangle },
  rejected: { label: 'Rejected in wallet', variant: 'danger', Icon: XCircle },
};

export interface XdrSigningTrackerProps {
  status: XdrSigningStatus;
  error?: string | null;
  transactionHash?: string | null;
  network?: 'public' | 'testnet';
  isMock?: boolean;
}

export function XdrSigningTracker({
  status,
  error,
  transactionHash,
  network = 'testnet',
  isMock = false,
}: XdrSigningTrackerProps) {
  const current = STATUS_CONFIG[status];
  const statusLabel = status === 'signed' && isMock ? 'Mock signing completed' : current.label;
  const StatusIcon = current.Icon;
  const activeIndex = TRACKER_STEPS.findIndex((step) => step.id === status);

  return (
    <section className="space-y-3 rounded-card border border-border bg-surface-secondary/30 p-4" aria-label="XDR signing status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${status === 'requesting' || status === 'signing' ? 'animate-spin' : ''} ${status === 'signed' ? 'text-success' : status === 'failed' || status === 'rejected' ? 'text-danger' : 'text-foreground-secondary'}`} aria-hidden />
          <p className="text-xs font-medium text-foreground" role="status" aria-live="polite">{statusLabel}</p>
        </div>
        <Badge variant={current.variant} size="sm" dot>{statusLabel}</Badge>
      </div>

      <ol className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-6" aria-label="Signing lifecycle">
        {TRACKER_STEPS.map((step, index) => {
          const isCurrent = step.id === status;
          const isReached = status !== 'failed' && status !== 'rejected' && index <= activeIndex;
          return (
            <li key={step.id} aria-current={isCurrent ? 'step' : undefined} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${isCurrent ? 'bg-gold ring-2 ring-gold/20' : isReached ? 'bg-success' : 'bg-border-strong'}`} aria-hidden />
              <span className={`text-2xs ${isCurrent ? 'font-semibold text-foreground' : 'text-foreground-muted'}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {error && <p className="text-2xs text-danger" role="alert">{error}</p>}
      {status === 'signed' && (
        transactionHash ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-2xs">
            <span className="text-foreground-secondary">Transaction hash</span>
            <code className="max-w-full truncate font-mono text-foreground" title={transactionHash}>{transactionHash}</code>
            <a
              href={`https://stellar.expert/explorer/${network === 'public' ? 'public' : 'testnet'}/tx/${encodeURIComponent(transactionHash)}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-gold-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View on Stellar Expert
            </a>
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-2xs text-foreground-muted">{isMock ? 'This local simulation does not submit a transaction or modify the XDR.' : 'Signed XDR is ready for network submission; no transaction hash is available yet.'}</p>
        )
      )}
    </section>
  );
}
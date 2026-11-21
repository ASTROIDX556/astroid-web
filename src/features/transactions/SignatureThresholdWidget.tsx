'use client';

import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Check,
  Clock,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { truncateHash } from '@/lib/format';
import {
  computeSignatureProgress,
  formatSignatureProgress,
  getSignatureSignerStatusLabel,
  type SignatureSigner,
  type SignatureSignerStatus,
  type SignatureThresholdState,
} from './signatureProgress';

export interface SignatureThresholdWidgetProps {
  /** Signers whose signatures are being collected for the pending payload. */
  signers: readonly SignatureSigner[];
  /** Number of signatures required before the payload can be broadcast. */
  requiredSignatures: number;
  /** Widget heading. */
  title?: string;
  /** Optional supporting copy under the heading. */
  description?: string;
  /** True while a TanStack Query refetch is in flight. */
  isRefreshing?: boolean;
  className?: string;
}

const SIGNER_STATUS_META: Record<
  SignatureSignerStatus,
  { Icon: LucideIcon; chip: string; icon: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  signed: {
    Icon: Check,
    chip: 'bg-success-soft ring-1 ring-success/30',
    icon: 'text-success',
    variant: 'success',
  },
  pending: {
    Icon: Clock,
    chip: 'bg-warning-soft ring-1 ring-warning/30',
    icon: 'text-warning',
    variant: 'warning',
  },
  rejected: {
    Icon: X,
    chip: 'bg-danger-soft ring-1 ring-danger/30',
    icon: 'text-danger',
    variant: 'danger',
  },
  'timed-out': {
    Icon: AlertTriangle,
    chip: 'bg-surface-secondary ring-1 ring-border-strong',
    icon: 'text-foreground-muted',
    variant: 'outline',
  },
};

const THRESHOLD_STATE_META: Record<
  SignatureThresholdState,
  {
    label: string;
    Icon: LucideIcon;
    variant: NonNullable<BadgeProps['variant']>;
    icon: string;
  }
> = {
  collecting: {
    label: 'Collecting signatures',
    Icon: Clock,
    variant: 'warning',
    icon: 'text-warning',
  },
  ready: {
    label: 'Ready to broadcast',
    Icon: ShieldCheck,
    variant: 'success',
    icon: 'text-success',
  },
  'timed-out': {
    label: 'Request timed out',
    Icon: AlertTriangle,
    variant: 'outline',
    icon: 'text-foreground-secondary',
  },
  blocked: {
    label: 'Threshold unreachable',
    Icon: X,
    variant: 'danger',
    icon: 'text-danger',
  },
};

function stateMessage(
  state: SignatureThresholdState,
  remaining: number,
  percentComplete: number,
): string {
  switch (state) {
    case 'ready':
      return 'The threshold is met. This payload is fully authorized and ready for broadcast.';
    case 'timed-out':
      return 'The signature request timed out before enough keys responded.';
    case 'blocked':
      return 'Rejected or expired keys mean the remaining signatures cannot reach the threshold.';
    case 'collecting':
    default:
      return remaining === 1
        ? `1 more signature needed (${percentComplete}% collected).`
        : `${remaining} more signatures needed (${percentComplete}% collected).`;
  }
}

export function SignatureThresholdWidget({
  signers,
  requiredSignatures,
  title = 'Signature collection',
  description = 'Live approval progress for this pending transaction.',
  isRefreshing = false,
  className,
}: SignatureThresholdWidgetProps) {
  const headingId = useId();
  const signersHeadingId = useId();

  const progress = computeSignatureProgress(signers, requiredSignatures);
  const stateMeta = THRESHOLD_STATE_META[progress.state];
  const StateIcon = stateMeta.Icon;
  const ariaMax = Math.max(1, progress.requiredSignatures);

  const progressBarTone = progress.thresholdMet
    ? 'bg-success'
    : progress.state === 'blocked'
      ? 'bg-danger'
      : progress.state === 'timed-out'
        ? 'bg-foreground-muted'
        : 'bg-gold';

  return (
    <Card
      className={cn('overflow-hidden', className)}
      role="region"
      aria-labelledby={headingId}
      aria-busy={isRefreshing}
    >
      <p className="sr-only" aria-live="polite">
        {`${formatSignatureProgress(progress)}. ${stateMessage(
          progress.state,
          progress.remainingSignatures,
          progress.percentComplete,
        )}`}
      </p>

      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle id={headingId} className="text-base">
            {title}
          </CardTitle>
          <p className="mt-1 text-xs text-foreground-secondary">{description}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant={stateMeta.variant} size="md" className="gap-1.5">
            <StateIcon className={cn('h-3.5 w-3.5', stateMeta.icon)} aria-hidden />
            {stateMeta.label}
          </Badge>
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1 text-2xs text-foreground-muted">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              Updating
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="rounded-card border border-border bg-surface-secondary/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatSignatureProgress(progress)}
            </p>
            <p className="text-2xs tabular-nums text-foreground-secondary">
              {progress.totalSigners} signer{progress.totalSigners === 1 ? '' : 's'} on record
            </p>
          </div>

          <div
            role="progressbar"
            aria-label="Signatures collected"
            aria-valuemin={0}
            aria-valuemax={ariaMax}
            aria-valuenow={Math.min(progress.signedCount, ariaMax)}
            aria-valuetext={`${progress.signedCount} of ${progress.requiredSignatures} required signatures collected`}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-primary ring-1 ring-border"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-slow ease-astroid motion-reduce:transition-none',
                progressBarTone,
              )}
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-foreground-secondary">
            {stateMessage(
              progress.state,
              progress.remainingSignatures,
              progress.percentComplete,
            )}
          </p>
        </div>

        <div>
          <h3 id={signersHeadingId} className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary">
            Signers
          </h3>
          <ul aria-labelledby={signersHeadingId} className="mt-2 space-y-2">
            {signers.map((signer, index) => {
              const meta = SIGNER_STATUS_META[signer.status];
              const statusLabel = getSignatureSignerStatusLabel(signer.status);
              const signerLabel = signer.label ?? 'Signer';
              const key = signer.id ?? signer.publicKey ?? index;

              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-primary px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full',
                        meta.chip,
                      )}
                      aria-hidden
                    >
                      <meta.Icon className={cn('h-3.5 w-3.5', meta.icon)} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{signerLabel}</p>
                      <p className="mt-0.5 truncate font-mono text-2xs text-foreground-secondary" title={signer.publicKey}>
                        {truncateHash(signer.publicKey, 6, 6)}
                      </p>
                      {signer.role ? (
                        <p className="mt-0.5 truncate text-2xs text-foreground-muted">{signer.role}</p>
                      ) : null}
                    </div>
                  </div>

                  <Badge variant={meta.variant} size="sm" aria-label={`${signerLabel}: ${statusLabel}`}>
                    {statusLabel}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default SignatureThresholdWidget;

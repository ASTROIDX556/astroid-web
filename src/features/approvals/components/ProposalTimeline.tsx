'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Copy, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { isMockMode } from '@/lib/env';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { formatStellarAddress } from '@/lib/stellar';
import { mockProposalSigners } from '@/features/approvals/fixtures/multisig';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Where a required signer currently stands on a proposal. */
export type ProposalSignerStatus = 'approved' | 'rejected' | 'pending';

/** One required signer in a multi-party approval workflow. */
export interface ProposalSigner {
  /** Stellar account id of the signing key (`G…`, 56 characters). */
  publicKey: string;
  /** Human name for the key holder, e.g. "Ada Okonkwo". */
  label?: string;
  /** Organizational role, e.g. "Treasury ops". */
  role?: string;
  /** Signing weight this key contributes toward the threshold. */
  weight?: number;
  status: ProposalSignerStatus;
  /** ISO-8601 timestamp of the approval or rejection. */
  respondedAt?: string;
  /** Reviewer's comment, shown beneath the step. */
  note?: string;
}

export interface ProposalTimelineProps {
  /**
   * Required signers in review order. Omit to fall back to the bundled
   * fixture when `NEXT_PUBLIC_API_URL` is unset.
   */
  signers?: readonly ProposalSigner[];
  /**
   * Signing weight that must be collected for the proposal to execute. When
   * omitted, progress is reported as a count of signers instead of weight.
   */
  threshold?: number;
  /** Heading for the timeline region. */
  title?: string;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Status presentation                                                         */
/* -------------------------------------------------------------------------- */

interface StatusMeta {
  label: string;
  Icon: LucideIcon;
  /** Timeline node treatment. */
  node: string;
  /** Status pill treatment. */
  pill: string;
  badge: 'success' | 'danger' | 'neutral';
  /** Connector below a completed step is solid; a pending one stays dashed. */
  connector: string;
}

const STATUS_META: Record<ProposalSignerStatus, StatusMeta> = {
  approved: {
    label: 'Approved',
    Icon: Check,
    node: 'border-success bg-success-soft text-success',
    pill: 'bg-success-soft text-success ring-1 ring-success/40',
    badge: 'success',
    connector: 'border-l border-success/40',
  },
  rejected: {
    label: 'Rejected',
    Icon: X,
    node: 'border-danger bg-danger-soft text-danger',
    pill: 'bg-danger-soft text-danger ring-1 ring-danger/40',
    badge: 'danger',
    connector: 'border-l border-danger/40',
  },
  pending: {
    label: 'Pending',
    Icon: Clock,
    node: 'border-border-strong bg-surface-secondary text-foreground-secondary',
    pill: 'bg-surface-secondary text-foreground-secondary ring-1 ring-border-strong',
    badge: 'neutral',
    connector: 'border-l border-dashed border-border',
  },
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Step-by-step review timeline for a multi-party approval workflow.
 *
 * Each required signer becomes one step showing their truncated Stellar
 * address, decision timestamp, and current voting status, with distinct
 * treatments for approved, rejected, and pending. The first unresolved signer
 * is marked `aria-current="step"` so assistive technology announces who the
 * proposal is waiting on, and every status is carried in text as well as by
 * icon and color — nothing depends on color alone.
 *
 * Keyboard: each step exposes its full public key through a focusable copy
 * control, so the whole timeline is reachable and actionable by keyboard.
 */
export function ProposalTimeline({
  signers,
  threshold,
  title = 'Review timeline',
  className,
}: ProposalTimelineProps) {
  const headingId = useId();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Fall back to the fixture only when nothing was supplied and no API is
  // configured; an empty array from a live API is a real, empty roster.
  const steps = useMemo<readonly ProposalSigner[]>(
    () => signers ?? (isMockMode ? mockProposalSigners : []),
    [signers],
  );

  const tally = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    let approvedWeight = 0;
    let totalWeight = 0;

    for (const step of steps) {
      const weight = step.weight ?? 1;
      totalWeight += weight;
      if (step.status === 'approved') {
        approved += 1;
        approvedWeight += weight;
      } else if (step.status === 'rejected') {
        rejected += 1;
      } else {
        pending += 1;
      }
    }

    return { approved, rejected, pending, approvedWeight, totalWeight };
  }, [steps]);

  /** The step the proposal is currently waiting on, if any. */
  const currentStepIndex = steps.findIndex((step) => step.status === 'pending');

  const copyKey = useCallback(async (publicKey: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      if (!mountedRef.current) return;
      setCopiedKey(publicKey);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setCopiedKey(null);
      }, 1600);
    } catch {
      if (mountedRef.current) setCopiedKey(null);
    }
  }, []);

  if (steps.length === 0) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <p className="text-sm text-foreground-secondary">
          No signers are assigned to this proposal.
        </p>
        <p className="mt-1 text-2xs text-foreground-muted">
          Approval steps appear here once a signer set is attached.
        </p>
      </Card>
    );
  }

  const met =
    threshold === undefined
      ? tally.pending === 0 && tally.rejected === 0
      : tally.approvedWeight >= threshold;

  const progressLabel =
    threshold === undefined
      ? `${tally.approved} of ${steps.length} signers approved`
      : `${tally.approvedWeight} of ${threshold} required weight approved`;

  const summary = met
    ? `Fully approved — ${progressLabel}.`
    : tally.rejected > 0
      ? `${progressLabel}. ${tally.rejected} ${tally.rejected === 1 ? 'signer has' : 'signers have'} rejected.`
      : `${progressLabel}. Waiting on ${tally.pending} ${tally.pending === 1 ? 'signer' : 'signers'}.`;

  return (
    <Card className={cn('p-5', className)} aria-labelledby={headingId}>
      {/* Announce progress changes without moving focus. */}
      <p aria-live="polite" className="sr-only">
        {summary}
      </p>
      <p aria-live="polite" className="sr-only">
        {copiedKey ? 'Public key copied to clipboard.' : ''}
      </p>

      {/* Header ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={headingId}
            className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-muted"
          >
            {title}
          </h3>
          <p className="mt-1 text-sm text-foreground">{progressLabel}</p>
        </div>
        <div className="gap-1.5 flex flex-wrap items-center">
          <Badge variant="success" size="sm">
            {tally.approved} approved
          </Badge>
          {tally.rejected > 0 && (
            <Badge variant="danger" size="sm">
              {tally.rejected} rejected
            </Badge>
          )}
          <Badge variant="neutral" size="sm">
            {tally.pending} pending
          </Badge>
        </div>
      </div>

      {/* Steps ------------------------------------------------------------ */}
      <ol className="mt-5" aria-label="Signer approval steps">
        {steps.map((step, index) => {
          const meta = STATUS_META[step.status];
          const isLast = index === steps.length - 1;
          const isCurrent = index === currentStepIndex;
          const copied = copiedKey === step.publicKey;
          const name = step.label ?? `Signer ${index + 1}`;

          return (
            <motion.li
              key={`${step.publicKey}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex gap-3"
            >
              {/* Node + connector */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full border',
                    meta.node,
                  )}
                  aria-hidden
                >
                  <meta.Icon className="h-3.5 w-3.5" />
                </span>
                {!isLast && (
                  <span className={cn('min-h-10 flex-1', meta.connector)} aria-hidden />
                )}
              </div>

              {/* Step body */}
              <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span
                    className={cn(
                      'py-0.5 inline-flex items-center gap-1 rounded-full px-2 text-2xs font-medium',
                      meta.pill,
                    )}
                  >
                    <meta.Icon className="h-3 w-3" aria-hidden />
                    {meta.label}
                  </span>
                  {isCurrent && (
                    <span className="text-2xs font-medium text-gold-strong">
                      Awaiting this signer
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-2xs text-foreground-secondary">
                  {step.role ? `${step.role} · ` : ''}
                  {step.weight === undefined ? null : <>weight {step.weight} · </>}
                  <span className="tabular">
                    {step.respondedAt ? (
                      <time
                        dateTime={step.respondedAt}
                        title={formatDateTime(step.respondedAt)}
                      >
                        {formatRelativeTime(step.respondedAt)}
                      </time>
                    ) : (
                      'no response yet'
                    )}
                  </span>
                </p>

                <button
                  type="button"
                  onClick={() => void copyKey(step.publicKey)}
                  title={step.publicKey}
                  aria-label={`Copy ${name}'s full public key`}
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-1 rounded-xs font-mono text-2xs text-foreground-muted transition-colors duration-fast hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  {formatStellarAddress(step.publicKey, { lead: 4, tail: 4 })}
                  <Copy
                    className={cn('h-3 w-3', copied && 'text-success')}
                    aria-hidden
                  />
                </button>

                {step.note && (
                  <p className="mt-2 rounded-card border border-border bg-surface-secondary/50 px-3 py-2 text-xs leading-relaxed text-foreground-secondary">
                    {step.note}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

export default ProposalTimeline;

'use client';

import { motion } from 'framer-motion';
import { Check, Clock, MessageSquare, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import type { ApprovalDecision } from '@/types/domain';

const ACTION_META: Record<
  ApprovalDecision['decision'],
  { label: string; Icon: LucideIcon; badge: string; icon: string }
> = {
  approved: {
    label: 'Approved',
    Icon: Check,
    badge: 'bg-success-soft ring-1 ring-success/40',
    icon: 'text-success',
  },
  rejected: {
    label: 'Rejected',
    Icon: X,
    badge: 'bg-danger-soft ring-1 ring-danger/40',
    icon: 'text-danger',
  },
  delegated: {
    label: 'Delegated',
    Icon: MessageSquare,
    badge: 'bg-info-soft ring-1 ring-info/40',
    icon: 'text-info',
  },
  pending: {
    label: 'Awaiting review',
    Icon: Clock,
    badge: 'bg-surface-secondary ring-1 ring-border-strong',
    icon: 'text-foreground-secondary',
  },
};

export interface ProposalAuditTrailProps {
  /** Approval events for a single proposal, in the order they occurred. */
  events: ApprovalDecision[];
  className?: string;
}

/**
 * Chronological audit trail of approve / reject / comment actions on a
 * proposal. Actor identity renders as the human-readable alias
 * (`ApprovalDecision.userName`) since that is what reviewers recognize;
 * `userId` is exposed via `title` for anyone who needs the raw identifier.
 */
export function ProposalAuditTrail({ events, className }: ProposalAuditTrailProps) {
  if (events.length === 0) {
    return (
      <Card className={cn('p-6 text-center', className)}>
        <p className="text-sm text-foreground-secondary">No review activity yet.</p>
        <p className="mt-1 text-2xs text-foreground-muted">
          Approvals, rejections, and comments will appear here as reviewers act on this
          proposal.
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn('p-5', className)}>
      <ol className="space-y-4" aria-label="Proposal review audit trail">
        {events.map((event, i) => {
          const meta = ACTION_META[event.decision];
          const isLast = i === events.length - 1;
          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              className="flex items-start gap-3"
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                    meta.badge,
                  )}
                >
                  <meta.Icon className={cn('h-4 w-4', meta.icon)} aria-hidden />
                </span>
                {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
              </div>

              <div className="flex flex-1 items-start justify-between gap-4 pb-1">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-sm font-medium text-foreground"
                      title={event.userId}
                    >
                      {event.userName}
                    </span>
                    <span className={cn('text-2xs font-medium', meta.icon)}>
                      {meta.label}
                    </span>
                  </div>
                  {event.comment && (
                    <p className="max-w-prose text-xs leading-relaxed text-foreground-secondary">
                      &ldquo;{event.comment}&rdquo;
                    </p>
                  )}
                </div>
                {event.createdAt && (
                  <time
                    dateTime={event.createdAt}
                    title={formatDateTime(event.createdAt)}
                    className="shrink-0 text-2xs text-foreground-muted"
                  >
                    {formatRelativeTime(event.createdAt)}
                  </time>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

export default ProposalAuditTrail;

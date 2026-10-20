'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock, Eye } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RiskBadge } from '@/components/dashboard/risk-badge';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { proposalStatus } from '@/lib/status';
import type { Proposal } from '@/types/domain';

import { ProposalDetailDrawer } from './ProposalDetailDrawer';

/**
 * A single proposal in the approvals queue. Moved verbatim from
 * `(dashboard)/approvals/page.tsx` so the queue feature owns its own cards.
 */
export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const status = proposalStatus(proposal.status);
  const approvedWeight = proposal.approvals.filter((entry) => entry.decision === 'approved').length;
  const requiredApprovals = proposal.requiredApprovals;
  const isQuorumMet = approvedWeight >= requiredApprovals;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{proposal.title}</p>
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
              <Badge variant="outline" size="sm" className="capitalize">
                {proposal.kind}
              </Badge>
              <RiskBadge score={proposal.riskScore} showScore />
            </div>
            <p className="max-w-prose text-xs leading-relaxed text-foreground-secondary">
              {proposal.description}
            </p>
            <p className="text-2xs text-foreground-muted">
              {proposal.agentName} · to {proposal.counterparty}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular font-display text-lg font-semibold">
              {formatCurrency(proposal.amount, proposal.asset, { compact: true })}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-2xs text-foreground-muted">
              <Clock className="h-3 w-3" aria-hidden />
              expires {formatRelativeTime(proposal.expiresAt)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {proposal.approvals.map((decisionEntry) => (
                <Avatar
                  key={decisionEntry.id}
                  name={decisionEntry.userName}
                  src={decisionEntry.userAvatar}
                  size="xs"
                  className="ring-2 ring-surface"
                />
              ))}
            </div>
            <span className="text-2xs text-foreground-secondary">
              {approvedWeight} of {requiredApprovals} approvals
              {isQuorumMet && ' · quorum met'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/transactions/${proposal.transactionId}`}
              className="inline-flex items-center gap-1 text-2xs font-medium text-gold-strong hover:underline"
            >
              View transaction
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
            <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" aria-hidden />} onClick={() => setDrawerOpen(true)}>
              Review
            </Button>
          </div>
        </div>
      </CardContent>
      <ProposalDetailDrawer proposal={proposal} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Card>
  );
}

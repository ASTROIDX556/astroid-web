'use client';

import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { Proposal } from '@/types/domain';
import {
  ApprovalGuardError,
  checkApprovalGuard,
  computeQuorumStatus,
  signatureSummary,
  type ApprovalActor,
  type LocalApprovalDecision,
} from '@/features/approvals/approval-state';
import { useProposalApprovalStore } from '@/stores/proposal-approval-store';
import { useCurrentUser, useRecordProposalDecision } from '@/hooks/use-queries';

export interface UseProposalApprovalResult {
  decision: LocalApprovalDecision | null;
  /** ISO timestamp of this session's decision, when recorded. */
  decidedAt: string | null;
  isProcessing: boolean;
  error: string | null;
  approvedWeight: number;
  requiredApprovals: number;
  isQuorumMet: boolean;
  remaining: number;
  /** E.g. "1 of 2 signatures collected", including the local decision. */
  signatureSummary: string;
  /** True when the signed-in actor holds a roster slot on this proposal. */
  isEligible: boolean;
  /** False while the session user query is still resolving. */
  isEligibilityResolved: boolean;
  approve: () => Promise<void>;
  reject: () => Promise<void>;
}

/**
 * Multi-party approval state machine for a single proposal.
 *
 * Guards every attempt against the proposal status, in-flight work, duplicate
 * decisions, and roster membership before delegating to the TanStack Query
 * mutation (optimistic cache patch + invalidation). Records audit metadata
 * (actor, timestamp) in the session store and surfaces sonner feedback for
 * success and failure paths.
 */
export function useProposalApproval(proposal: Proposal): UseProposalApprovalResult {
  const currentUser = useCurrentUser();
  const entry = useProposalApprovalStore((state) => state.getEntry(proposal.id));
  const beginDecision = useProposalApprovalStore((state) => state.beginDecision);
  const resolveDecision = useProposalApprovalStore((state) => state.resolveDecision);
  const failDecision = useProposalApprovalStore((state) => state.failDecision);
  const recordDecision = useRecordProposalDecision();

  const actor = useMemo<ApprovalActor>(
    () => ({ id: currentUser.data?.id ?? 'anonymous', name: currentUser.data?.name }),
    [currentUser.data],
  );

  const quorum = computeQuorumStatus(proposal, entry.decision);
  const isEligible = proposal.approvals.some(
    (approval) => approval.userId === actor.id,
  );

  const decide = useCallback(
    async (decision: LocalApprovalDecision) => {
      const guard = checkApprovalGuard(proposal, actor.id, {
        isProcessing: entry.isProcessing || recordDecision.isPending,
        hasLocalDecision: entry.decision !== null,
      });
      if (!guard.ok) {
        toast.error(guard.message);
        if (guard.code === 'proposal_not_pending') {
          failDecision(proposal.id, guard.message);
        }
        return;
      }

      beginDecision(proposal.id, actor);

      try {
        await recordDecision.mutateAsync({
          proposalId: proposal.id,
          decision,
          actor,
        });

        resolveDecision(proposal.id, decision, actor);

        if (decision === 'approved') {
          const next = computeQuorumStatus(proposal, 'approved');
          toast.success(
            next.isQuorumMet ? 'Approved — quorum reached' : 'Approval recorded',
            {
              description: next.isQuorumMet
                ? `${signatureSummary(proposal, 'approved')}. Ready to execute.`
                : `${next.remaining} more signature${
                    next.remaining === 1 ? '' : 's'
                  } needed.`,
            },
          );
        } else {
          toast.success('Proposal rejected', {
            description: `${signatureSummary(proposal, 'rejected')} on the decision record.`,
          });
        }
      } catch (err) {
        const message =
          err instanceof ApprovalGuardError || err instanceof Error
            ? err.message
            : 'Failed to record decision.';
        failDecision(proposal.id, message);
        toast.error(message);
      }
    },
    [
      proposal,
      actor,
      entry.isProcessing,
      entry.decision,
      recordDecision,
      beginDecision,
      resolveDecision,
      failDecision,
    ],
  );

  const approve = useCallback(() => decide('approved'), [decide]);
  const reject = useCallback(() => decide('rejected'), [decide]);

  return {
    decision: entry.decision,
    decidedAt: entry.decidedAt,
    isProcessing: entry.isProcessing || recordDecision.isPending,
    error: entry.error,
    approvedWeight: quorum.approvedWeight,
    requiredApprovals: quorum.requiredApprovals,
    isQuorumMet: quorum.isQuorumMet,
    remaining: quorum.remaining,
    signatureSummary: signatureSummary(proposal, entry.decision),
    isEligible,
    isEligibilityResolved: !currentUser.isPending,
    approve,
    reject,
  };
}

export default useProposalApproval;

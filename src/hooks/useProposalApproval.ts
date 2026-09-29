'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { Proposal } from '@/types/domain';
import {
  computeQuorumStatus,
  useProposalApprovalStore,
  type LocalApprovalDecision,
} from '@/stores/proposal-approval-store';

export interface UseProposalApprovalResult {
  decision: LocalApprovalDecision | null;
  isProcessing: boolean;
  error: string | null;
  approvedWeight: number;
  requiredApprovals: number;
  isQuorumMet: boolean;
  remaining: number;
  approve: () => Promise<void>;
  reject: () => Promise<void>;
}

/**
 * Multi-party approval state machine for a single proposal. Tracks this
 * session's approve/reject decision, derives live quorum status from the
 * proposal's server-recorded approvals, and surfaces sonner feedback for
 * success and failure paths.
 */
export function useProposalApproval(proposal: Proposal): UseProposalApprovalResult {
  const entry = useProposalApprovalStore((state) => state.getEntry(proposal.id));
  const beginDecision = useProposalApprovalStore((state) => state.beginDecision);
  const resolveDecision = useProposalApprovalStore((state) => state.resolveDecision);
  const failDecision = useProposalApprovalStore((state) => state.failDecision);

  const quorum = computeQuorumStatus(proposal, entry.decision);

  const decide = useCallback(
    async (decision: LocalApprovalDecision) => {
      if (entry.isProcessing) return;
      if (proposal.status !== 'pending') {
        toast.error('This proposal is no longer pending.');
        return;
      }

      beginDecision(proposal.id);

      try {
        // Placeholder for the signing/submission round-trip — network or
        // wallet failures land in the catch block below.
        await Promise.resolve();

        resolveDecision(proposal.id, decision);

        if (decision === 'approved') {
          const next = computeQuorumStatus(proposal, 'approved');
          toast.success(
            next.isQuorumMet ? 'Approved — quorum reached' : 'Approval recorded',
            {
              description: next.isQuorumMet
                ? `${next.approvedWeight} of ${next.requiredApprovals} approvals met. Ready to execute.`
                : `${next.remaining} more approval${next.remaining === 1 ? '' : 's'} needed.`,
            },
          );
        } else {
          toast.success('Proposal rejected');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to record decision.';
        failDecision(proposal.id, message);
        toast.error(message);
      }
    },
    [entry.isProcessing, proposal, beginDecision, resolveDecision, failDecision],
  );

  const approve = useCallback(() => decide('approved'), [decide]);
  const reject = useCallback(() => decide('rejected'), [decide]);

  return {
    decision: entry.decision,
    isProcessing: entry.isProcessing,
    error: entry.error,
    approvedWeight: quorum.approvedWeight,
    requiredApprovals: quorum.requiredApprovals,
    isQuorumMet: quorum.isQuorumMet,
    remaining: quorum.remaining,
    approve,
    reject,
  };
}

export default useProposalApproval;

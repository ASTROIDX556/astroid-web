'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Proposal } from '@/types/domain';
import { useCurrentUser } from '@/hooks/use-queries';
import { queryKeys } from '@/services/query-keys';
import {
  approvalQueryKeys,
  fetchProposalApprovalState,
  submitProposalDecision,
} from '@/features/approvals/approvalApi';
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
  approve: () => Promise<boolean>;
  reject: () => Promise<boolean>;
  requestChanges: () => Promise<boolean>;
}

/**
 * Multi-party approval state machine for a single proposal. Tracks this
 * session's approve/reject decision, derives live quorum status from the
 * proposal's server-recorded approvals, and surfaces sonner feedback for
 * success and failure paths.
 */
export function useProposalApproval(proposal: Proposal): UseProposalApprovalResult {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const entry = useProposalApprovalStore((state) => state.getEntry(proposal.id));
  const resolveDecision = useProposalApprovalStore((state) => state.resolveDecision);
  const failDecision = useProposalApprovalStore((state) => state.failDecision);

  const quorum = computeQuorumStatus(proposal, entry.decision);

  const mutation = useMutation({
    mutationFn: submitProposalDecision,
  });

  const decide = useCallback(
    async (decision: LocalApprovalDecision): Promise<boolean> => {
      // Read the live store instead of the render-time snapshot: two clicks in
      // the same tick would both see the previous render's `isProcessing`.
      const store = useProposalApprovalStore.getState();
      const current = store.getEntry(proposal.id);

      if (current.isProcessing) {
        toast.error('A decision is already being recorded for this proposal.');
        return false;
      }

      if (current.decision !== null) {
        toast.error('You have already recorded a decision on this proposal.');
        return false;
      }

      if (proposal.status !== 'pending') {
        toast.error('This proposal is no longer pending.');
        return false;
      }
      if (decision === 'changes_requested') {
        toast.error('Request changes is not supported by the proposal decision API.');
        return false;
      }

      // Atomic claim: fails if another handler won the race in this tick.
      if (!store.tryBeginDecision(proposal.id)) {
        toast.error('A decision is already being recorded for this proposal.');
        return false;
      }

      try {
        const latest = await fetchProposalApprovalState(proposal.id);
        if (latest.status !== 'pending') {
          throw new Error('This proposal is no longer pending.');
        }

        const activeUser = currentUser.data;
        const next = await mutation.mutateAsync({
          proposalId: proposal.id,
          decision,
          reviewer: activeUser
            ? {
                id: activeUser.id,
                name: activeUser.name,
                avatar: activeUser.avatar,
              }
            : { id: 'usr_signed_in', name: 'You' },
        });

        resolveDecision(proposal.id, decision);
        queryClient.setQueryData(approvalQueryKeys.proposal(proposal.id), next);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
          queryClient.invalidateQueries({ queryKey: approvalQueryKeys.all }),
        ]);

        if (decision === 'approved') {
          const progress = computeQuorumStatus(proposal, 'approved');
          toast.success(
            progress.isQuorumMet ? 'Approved — quorum reached' : 'Approval recorded',
            {
              description: progress.isQuorumMet
                ? `${progress.approvedWeight} of ${progress.requiredApprovals} approvals met. Ready to execute.`
                : `${progress.remaining} more approval${progress.remaining === 1 ? '' : 's'} needed.`,
            },
          );
        } else {
          toast.success('Proposal rejected');
        }
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to record decision.';
        failDecision(proposal.id, message);
        toast.error(message);
        return false;
      }
    },
    [proposal, resolveDecision, failDecision],
  );

  const approve = useCallback(() => decide('approved'), [decide]);
  const reject = useCallback(() => decide('rejected'), [decide]);
  const requestChanges = useCallback(() => decide('changes_requested'), [decide]);

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
    requestChanges,
  };
}

export default useProposalApproval;

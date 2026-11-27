'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  applyDecision,
  type ApprovalReviewer,
  type ProposalApprovalSnapshot,
  type ReviewDecision,
} from '@/features/approvals/approvalState';
import {
  approvalQueryKeys,
  submitProposalDecision,
} from '@/features/approvals/approvalApi';

export interface UseProposalDecisionOptions {
  /** The proposal to act on. */
  proposalId: string;
  /** The reviewer recording the decision. */
  reviewer: ApprovalReviewer;
  /** Optional comment attached to the decision. */
  comment?: string;
  /** Fired after the server confirms the decision. */
  onSuccess?: (snapshot: ProposalApprovalSnapshot) => void;
  /** Fired when the server rejects the decision. */
  onError?: (error: Error) => void;
}

export interface UseProposalDecisionResult {
  /** Fire-and-forget decision submission. */
  mutate: (decision: ReviewDecision) => void;
  /** Awaitable decision submission. */
  mutateAsync: (decision: ReviewDecision) => Promise<ProposalApprovalSnapshot>;
  /** True while the mutation is in flight. */
  isPending: boolean;
  /** True when the last mutation errored. */
  isError: boolean;
  /** The last error, if any. */
  error: Error | null;
  /** Reset mutation state. */
  reset: () => void;
}

/**
 * TanStack Query mutation for recording a multi-party proposal decision.
 *
 * Provides optimistic updates to the proposal approval cache, sonner toast
 * feedback for success and failure, and automatic cache invalidation so every
 * card sharing the same proposal key stays in sync. Handles network errors
 * and permission validation gracefully by rolling back the optimistic update
 * on failure.
 */
export function useProposalDecision({
  proposalId,
  reviewer,
  comment,
  onSuccess,
  onError,
}: UseProposalDecisionOptions): UseProposalDecisionResult {
  const queryClient = useQueryClient();
  const queryKey = approvalQueryKeys.proposal(proposalId);

  const mutation = useMutation<
    ProposalApprovalSnapshot,
    Error,
    ReviewDecision,
    { previous: ProposalApprovalSnapshot | undefined }
  >({
    mutationFn: (decision) =>
      submitProposalDecision({
        proposalId,
        decision,
        reviewer,
        comment,
      }),

    onMutate: async (decision) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ProposalApprovalSnapshot>(queryKey);

      if (previous) {
        const optimistic = applyDecision(previous, {
          decision,
          reviewer,
          comment,
          decidedAt: new Date().toISOString(),
        });
        queryClient.setQueryData(queryKey, optimistic);
      }

      return { previous };
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey });

      const approvedCount = data.approvals.filter(
        (a) => a.decision === 'approved',
      ).length;

      toast.success(
        data.status === 'approved' ? 'Approved — quorum reached' : 'Approval recorded',
        {
          description:
            data.status === 'approved'
              ? `${approvedCount} of ${data.requiredApprovals} approvals met. Ready to execute.`
              : `${approvedCount} of ${data.requiredApprovals} approvals collected`,
        },
      );

      onSuccess?.(data);
    },

    onError: (error, _decision, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      const message =
        error instanceof Error ? error.message : 'Failed to record decision.';
      toast.error(message);
      onError?.(error);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: mutation.reset,
  };
}

export default useProposalDecision;

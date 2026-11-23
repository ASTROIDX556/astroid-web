import { isMockMode } from '../../lib/env';
import { apiClient } from '../../services/client';
import { proposals as mockProposals } from '../../services/mock/transactions';
import type { Proposal } from '../../types/domain';
import {
  applyDecision,
  snapshotFromProposal,
  type ProposalApprovalSnapshot,
  type SubmitProposalDecisionInput,
} from './approvalState';

/**
 * Approval API used by the review widget.
 *
 * In mock mode the module keeps an in-memory copy of the seeded proposals so
 * approvals persist across React Query refetches for the session. With a live
 * API configured the same operations hit the proposals approval endpoints.
 */

export const approvalQueryKeys = {
  all: ['approvals'] as const,
  proposal: (proposalId: string) => ['approvals', 'proposal', proposalId] as const,
};

const MOCK_LATENCY_MS = 260;

let mockSnapshots: Map<string, ProposalApprovalSnapshot> | null = null;

function getMockSnapshots(): Map<string, ProposalApprovalSnapshot> {
  if (!mockSnapshots) {
    mockSnapshots = new Map(
      mockProposals.map((proposal) => [proposal.id, snapshotFromProposal(proposal)]),
    );
  }
  return mockSnapshots;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function proposalNotFound(proposalId: string): never {
  throw new Error(`Proposal ${proposalId} was not found.`);
}

function normalizeSnapshot(
  proposalId: string,
  value: Proposal | ProposalApprovalSnapshot,
): ProposalApprovalSnapshot {
  if ('proposalId' in value) return value;

  const snapshot = snapshotFromProposal(value);
  // A live proposal payload is not a decision snapshot, so stamp it with the
  // current server clock rather than leaving the client-shaped timestamp.
  return { ...snapshot, proposalId };
}

/** Fetch the current approval state for one proposal. */
export async function fetchProposalApprovalState(
  proposalId: string,
): Promise<ProposalApprovalSnapshot> {
  if (isMockMode) {
    await delay(MOCK_LATENCY_MS);
    return getMockSnapshots().get(proposalId) ?? proposalNotFound(proposalId);
  }

  const response = await apiClient.request<Proposal | ProposalApprovalSnapshot>(
    `/proposals/${encodeURIComponent(proposalId)}/approvals`,
  );
  return normalizeSnapshot(proposalId, response.data);
}

/** Record the signed-in reviewer's approve/reject decision. */
export async function submitProposalDecision(
  input: SubmitProposalDecisionInput,
): Promise<ProposalApprovalSnapshot> {
  if (isMockMode) {
    await delay(MOCK_LATENCY_MS);
    const current =
      getMockSnapshots().get(input.proposalId) ?? proposalNotFound(input.proposalId);

    if (current.status !== 'pending') {
      throw new Error('This proposal is no longer pending.');
    }

    const next = applyDecision(current, {
      decision: input.decision,
      reviewer: input.reviewer,
      comment: input.comment,
    });
    getMockSnapshots().set(input.proposalId, next);
    return next;
  }

  const response = await apiClient.request<ProposalApprovalSnapshot>(
    `/proposals/${encodeURIComponent(input.proposalId)}/approvals`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: input.decision,
        comment: input.comment,
      }),
    },
  );
  return response.data;
}

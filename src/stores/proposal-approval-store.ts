import { create } from 'zustand';
import type { Proposal } from '@/types/domain';

export type LocalApprovalDecision = 'approved' | 'rejected';

interface ProposalApprovalEntry {
  /** This session's decision, layered on top of the server-recorded approvals. */
  decision: LocalApprovalDecision | null;
  /** True while an approve/reject action is in flight. */
  isProcessing: boolean;
  /** Last failure, e.g. a signing rejection or an unmet quorum submit. */
  error: string | null;
}

interface ProposalApprovalState {
  entries: Record<string, ProposalApprovalEntry>;

  getEntry: (proposalId: string) => ProposalApprovalEntry;
  beginDecision: (proposalId: string) => void;
  resolveDecision: (proposalId: string, decision: LocalApprovalDecision) => void;
  failDecision: (proposalId: string, error: string) => void;
  reset: (proposalId: string) => void;
}

const emptyEntry: ProposalApprovalEntry = {
  decision: null,
  isProcessing: false,
  error: null,
};

export const useProposalApprovalStore = create<ProposalApprovalState>((set, get) => ({
  entries: {},

  getEntry: (proposalId) => get().entries[proposalId] ?? emptyEntry,

  beginDecision: (proposalId) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [proposalId]: {
          ...(state.entries[proposalId] ?? emptyEntry),
          isProcessing: true,
          error: null,
        },
      },
    })),

  resolveDecision: (proposalId, decision) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [proposalId]: { decision, isProcessing: false, error: null },
      },
    })),

  failDecision: (proposalId, error) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [proposalId]: {
          ...(state.entries[proposalId] ?? emptyEntry),
          isProcessing: false,
          error,
        },
      },
    })),

  reset: (proposalId) =>
    set((state) => {
      const next = { ...state.entries };
      delete next[proposalId];
      return { entries: next };
    }),
}));

export interface ProposalQuorumStatus {
  approvedWeight: number;
  requiredApprovals: number;
  isQuorumMet: boolean;
  remaining: number;
}

/** Counts server-recorded approvals plus this session's local decision (never double-counted). */
export function computeQuorumStatus(
  proposal: Proposal,
  localDecision: LocalApprovalDecision | null,
): ProposalQuorumStatus {
  const serverApproved = proposal.approvals.filter(
    (a) => a.decision === 'approved',
  ).length;
  const localAdds = localDecision === 'approved' ? 1 : 0;
  const approvedWeight = Math.min(
    serverApproved + localAdds,
    proposal.requiredApprovals,
  );

  return {
    approvedWeight,
    requiredApprovals: proposal.requiredApprovals,
    isQuorumMet: approvedWeight >= proposal.requiredApprovals,
    remaining: Math.max(0, proposal.requiredApprovals - approvedWeight),
  };
}

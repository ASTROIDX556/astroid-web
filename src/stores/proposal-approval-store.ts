import { create } from 'zustand';
import type {
  ApprovalActor,
  LocalApprovalDecision,
} from '@/features/approvals/approval-state';

export type { LocalApprovalDecision } from '@/features/approvals/approval-state';
export {
  computeQuorumStatus,
  type ProposalQuorumStatus,
} from '@/features/approvals/approval-state';

/** Immutable audit record for a decision recorded in this session. */
export interface ProposalApprovalAuditRecord {
  proposalId: string;
  actorId: string;
  actorName?: string;
  decision: LocalApprovalDecision;
  /** ISO timestamp of when the decision was recorded. */
  recordedAt: string;
}

interface ProposalApprovalEntry {
  /** This session's decision, layered on top of the server-recorded approvals. */
  decision: LocalApprovalDecision | null;
  /** Actor that recorded the session decision, when known. */
  decidedBy: string | null;
  /** ISO timestamp of the session decision, when known. */
  decidedAt: string | null;
  /** Append-only audit metadata for every recorded decision. */
  audit: ProposalApprovalAuditRecord[];
  /** True while an approve/reject action is in flight. */
  isProcessing: boolean;
  /** Last failure, e.g. a signing rejection or an unmet quorum submit. */
  error: string | null;
}

interface ProposalApprovalState {
  entries: Record<string, ProposalApprovalEntry>;

  getEntry: (proposalId: string) => ProposalApprovalEntry;
  getAuditTrail: (proposalId: string) => ProposalApprovalAuditRecord[];
  beginDecision: (proposalId: string, actor?: ApprovalActor) => void;
  resolveDecision: (
    proposalId: string,
    decision: LocalApprovalDecision,
    actor?: ApprovalActor,
  ) => void;
  failDecision: (proposalId: string, error: string) => void;
  reset: (proposalId: string) => void;
}

const emptyEntry: ProposalApprovalEntry = {
  decision: null,
  decidedBy: null,
  decidedAt: null,
  audit: [],
  isProcessing: false,
  error: null,
};

export const useProposalApprovalStore = create<ProposalApprovalState>((set, get) => ({
  entries: {},

  getEntry: (proposalId) => get().entries[proposalId] ?? emptyEntry,

  getAuditTrail: (proposalId) => get().entries[proposalId]?.audit ?? [],

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

  resolveDecision: (proposalId, decision, actor) =>
    set((state) => {
      const previous = state.entries[proposalId] ?? emptyEntry;
      const recordedAt = new Date().toISOString();
      const record: ProposalApprovalAuditRecord = {
        proposalId,
        actorId: actor?.id ?? 'unknown',
        actorName: actor?.name,
        decision,
        recordedAt,
      };

      return {
        entries: {
          ...state.entries,
          [proposalId]: {
            ...previous,
            decision,
            decidedBy: actor?.id ?? previous.decidedBy,
            decidedAt: recordedAt,
            audit: [...previous.audit, record],
            isProcessing: false,
            error: null,
          },
        },
      };
    }),

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

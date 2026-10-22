import type {
  ApprovalDecision,
  Proposal,
  ProposalStatus,
  UserRole,
} from '../../types/domain';

/**
 * Pure approval-state helpers shared by the API layer and the review widget.
 *
 * Keeping the state transitions here (instead of inside the component) means
 * the optimistic query update and the mock API apply exactly the same rules,
 * and the behaviour can be regression-tested without a React runtime.
 */

export type ReviewDecision = 'approved' | 'rejected';

export interface ApprovalReviewer {
  id: string;
  name: string;
  avatar?: string;
}

export interface ProposalApprovalSnapshot {
  proposalId: string;
  status: ProposalStatus;
  requiredApprovals: number;
  approvals: ApprovalDecision[];
  updatedAt: string;
}

export interface SubmitProposalDecisionInput {
  proposalId: string;
  decision: ReviewDecision;
  reviewer: ApprovalReviewer;
  comment?: string;
}

export interface ApplyDecisionOptions {
  decision: ReviewDecision;
  reviewer: ApprovalReviewer;
  comment?: string;
  /** Injectable clock so tests stay deterministic. */
  decidedAt?: string;
}

/** Roles allowed to record an approval or rejection. */
const REVIEW_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'owner',
  'admin',
  'finance',
]);

export function canReviewProposal(role: UserRole): boolean {
  return REVIEW_ROLES.has(role);
}

/** Create the client-side snapshot used as initial React Query data. */
export function snapshotFromProposal(proposal: Proposal): ProposalApprovalSnapshot {
  return {
    proposalId: proposal.id,
    status: proposal.status,
    requiredApprovals: proposal.requiredApprovals,
    approvals: proposal.approvals.map((approval) => ({ ...approval })),
    // Deterministic initial value: the render-time clock would differ between
    // the server and client and cause a hydration mismatch.
    updatedAt: proposal.createdAt,
  };
}

function countApproved(approvals: ApprovalDecision[]): number {
  return approvals.filter((approval) => approval.decision === 'approved').length;
}

/**
 * Record one reviewer's decision. A reviewer's previous entry is replaced rather
 * than appended so changing an approve to a reject never double-counts weight.
 */
export function applyDecision(
  snapshot: ProposalApprovalSnapshot,
  options: ApplyDecisionOptions,
): ProposalApprovalSnapshot {
  const decidedAt = options.decidedAt ?? new Date().toISOString();
  const existingIndex = snapshot.approvals.findIndex(
    (approval) => approval.userId === options.reviewer.id,
  );

  const entry: ApprovalDecision = {
    id:
      existingIndex >= 0
        ? (snapshot.approvals[existingIndex]?.id ?? `apr_${options.reviewer.id}`)
        : `apr_${options.reviewer.id}`,
    userId: options.reviewer.id,
    userName: options.reviewer.name,
    userAvatar: options.reviewer.avatar,
    decision: options.decision,
    comment: options.comment,
    createdAt: decidedAt,
  };

  const approvals =
    existingIndex >= 0
      ? snapshot.approvals.map((approval, index) =>
          index === existingIndex ? entry : approval,
        )
      : [...snapshot.approvals, entry];

  const approved = countApproved(approvals);
  // A decision change can move an approved proposal back below quorum, so
  // recompute the status for any proposal that is still in the review phase.
  const status: ProposalStatus =
    snapshot.status === 'pending' || snapshot.status === 'approved'
      ? approved >= snapshot.requiredApprovals
        ? 'approved'
        : 'pending'
      : snapshot.status;

  return {
    ...snapshot,
    approvals,
    status,
    updatedAt: decidedAt,
  };
}

export interface ApprovalProgress {
  approved: number;
  rejected: number;
  pending: number;
  required: number;
  percent: number;
  quorumMet: boolean;
  remaining: number;
}

export function approvalProgress(snapshot: ProposalApprovalSnapshot): ApprovalProgress {
  const approved = countApproved(snapshot.approvals);
  const rejected = snapshot.approvals.filter(
    (approval) => approval.decision === 'rejected',
  ).length;
  const pending = snapshot.approvals.filter(
    (approval) => approval.decision === 'pending',
  ).length;
  const required = Math.max(1, snapshot.requiredApprovals);
  const percent = Math.min(100, Math.round((approved / required) * 100));

  return {
    approved,
    rejected,
    pending,
    required: snapshot.requiredApprovals,
    percent,
    quorumMet: approved >= snapshot.requiredApprovals,
    remaining: Math.max(0, snapshot.requiredApprovals - approved),
  };
}

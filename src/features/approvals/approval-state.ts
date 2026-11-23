import type { ApprovalDecision, Proposal } from '@/types/domain';

/**
 * Pure multi-party approval state helpers.
 *
 * These functions hold no React/Zustand state so they can be reused by the
 * session store, the TanStack Query mutation (optimistic updates), the mock
 * resource layer, and unit tests without creating import cycles.
 */

export type LocalApprovalDecision = 'approved' | 'rejected';

export interface ApprovalActor {
  id: string;
  name?: string;
}

export type ApprovalGuardCode =
  | 'proposal_not_pending'
  | 'approval_in_progress'
  | 'duplicate_decision'
  | 'not_an_approver';

export interface ApprovalGuardContext {
  /** True while an approve/reject round-trip is already in flight. */
  isProcessing?: boolean;
  /** True when this session already recorded a decision for the proposal. */
  hasLocalDecision?: boolean;
}

export type ApprovalGuardResult =
  | { ok: true; approver: ApprovalDecision | null }
  | { ok: false; code: ApprovalGuardCode; message: string };

/** Typed, user-presentable failure raised by the guard checks. */
export class ApprovalGuardError extends Error {
  readonly code: ApprovalGuardCode;

  constructor(code: ApprovalGuardCode, message: string) {
    super(message);
    this.name = 'ApprovalGuardError';
    this.code = code;
  }
}

/** Find this actor's slot in the proposal's signature roster. */
export function findApprover(
  proposal: Proposal,
  actorId: string,
): ApprovalDecision | null {
  return proposal.approvals.find((approval) => approval.userId === actorId) ?? null;
}

/**
 * Gate an approve/reject attempt. Order matters: a non-pending proposal always
 * wins, then in-flight work, then duplicates, then roster membership.
 */
export function checkApprovalGuard(
  proposal: Proposal,
  actorId: string,
  context: ApprovalGuardContext = {},
): ApprovalGuardResult {
  if (proposal.status !== 'pending') {
    return {
      ok: false,
      code: 'proposal_not_pending',
      message: 'This proposal is no longer pending.',
    };
  }

  if (context.isProcessing) {
    return {
      ok: false,
      code: 'approval_in_progress',
      message: 'A decision is already being recorded for this proposal.',
    };
  }

  if (context.hasLocalDecision) {
    return {
      ok: false,
      code: 'duplicate_decision',
      message: 'You have already recorded a decision on this proposal.',
    };
  }

  const approver = findApprover(proposal, actorId);
  if (!approver) {
    return {
      ok: false,
      code: 'not_an_approver',
      message: 'Your account is not an approver on this proposal.',
    };
  }

  if (approver.decision !== 'pending') {
    return {
      ok: false,
      code: 'duplicate_decision',
      message: 'A decision from your account is already on record.',
    };
  }

  return { ok: true, approver };
}

export interface ApplyApprovalOptions {
  comment?: string;
  /** Injectable clock for deterministic tests. */
  timestamp?: string;
  actorName?: string;
}

/**
 * Apply a decision to a proposal without mutating it. Updates the actor's
 * pending roster slot when one exists, otherwise appends a local entry, and
 * flips the proposal to `approved` once quorum is reached. Rejections are
 * recorded on the roster but do not short-circuit a proposal the way a
 * committee rejection could — the remaining approvers can still decide.
 */
export function applyApprovalDecision(
  proposal: Proposal,
  actor: ApprovalActor,
  decision: LocalApprovalDecision,
  options: ApplyApprovalOptions = {},
): Proposal {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const existing = findApprover(proposal, actor.id);

  const approvals: ApprovalDecision[] = existing
    ? proposal.approvals.map((approval) =>
        approval.id === existing.id
          ? {
              ...approval,
              decision,
              comment: options.comment ?? approval.comment,
              createdAt: timestamp,
            }
          : approval,
      )
    : [
        ...proposal.approvals,
        {
          id: `apr_local_${actor.id}`,
          userId: actor.id,
          userName: options.actorName ?? actor.name ?? 'You',
          decision,
          comment: options.comment,
          createdAt: timestamp,
        },
      ];

  const approvedCount = approvals.filter((a) => a.decision === 'approved').length;
  const status =
    approvedCount >= proposal.requiredApprovals ? 'approved' : proposal.status;

  return { ...proposal, approvals, status };
}

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

/** Human-readable signature progress, e.g. "2 of 3 signatures collected". */
export function signatureSummary(
  proposal: Proposal,
  localDecision: LocalApprovalDecision | null,
): string {
  const { approvedWeight, requiredApprovals } = computeQuorumStatus(
    proposal,
    localDecision,
  );
  return `${approvedWeight} of ${requiredApprovals} signature${
    requiredApprovals === 1 ? '' : 's'
  } collected`;
}

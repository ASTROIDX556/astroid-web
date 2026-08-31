/**
 * Types related to multi-party proposal approvals.
 * Used by the ProposalTimeline component and related workflows.
 */

/** Possible lifecycle stages of a proposal. */
export type ProposalStatus =
  | 'drafted'
  | 'voting_active'
  | 'approved'
  | 'executed';

/** Direction of a vote cast by an approver. */
export type VoteType = 'approve' | 'reject';

/** Types of events shown in the proposal timeline. */
export type ApprovalEventType =
  | 'submitted'
  | 'voting_started'
  | 'vote_cast'
  | 'threshold_reached'
  | 'executed';

/** A single approver participating in the proposal. */
export interface Approver {
  /** Unique identifier of the approver (e.g., key id). */
  id: string;
  /** Stellar public address (G...) of the approver. */
  address: string;
  /** Voting weight assigned to this approver. */
  weight: number;
  /** Whether the approver has already cast their vote. */
  hasVoted?: boolean;
  /** The vote direction, if cast. */
  vote?: VoteType;
  /** ISO timestamp when the vote was cast. */
  votedAt?: string;
}

/** An event entry in the proposal's chronological history. */
export interface ApprovalEvent {
  /** Unique identifier for the event. */
  id: string;
  /** Event category shown in the timeline. */
  type: ApprovalEventType;
  /** ISO timestamp of the event occurrence. */
  timestamp: string;
  /** Approver or actor who triggered the event, if applicable. */
  actor?: string;
  /** Optional human-readable details about the event. */
  details?: string;
}

/** A multi-party proposal requiring approvals before execution. */
export interface Proposal {
  /** Unique proposal identifier. */
  id: string;
  /** Short title of the proposal. */
  title: string;
  /** Current lifecycle status. */
  status: ProposalStatus;
  /** Number of voting weight units required to reach quorum. */
  threshold: number;
  /** Total number of voting weight units available across all approvers. */
  totalWeight: number;
  /** Sum of weights from approved votes. */
  currentApprovals: number;
  /** All approvers assigned to this proposal. */
  approvers: Approver[];
  /** Chronological history of approval-related events. */
  timeline: ApprovalEvent[];
}

/**
 * Props for the ProposalTimeline component.
 * These are defined here as a convenience for consumers of the component.
 */
export interface ProposalTimelineProps {
  /** The proposal to render the approval flow for. */
  proposal: Proposal;
  /** Whether the current user is in the process of approving/rejecting. */
  isSubmitting?: boolean;
  /** Callback invoked when an approver clicks approve/reject. */
  onVote?: (approverId: string, vote: VoteType) => void;
};

import { riskLevel } from '@/lib/status';
import type { Proposal, ProposalStatus, RiskLevel } from '@/types/domain';

/**
 * Filtering and sorting primitives for the multi-party approvals queue (#232).
 *
 * The queue renders proposal cards, not a `DataTable`, so the filter/sort
 * vocabulary lives here at the feature layer instead of touching the shared
 * table component. The page-side TanStack Table instance is configured from
 * these helpers (see `ApprovalQueue.tsx`) so a column id, a filter key, and a
 * comparator always share one source of truth.
 */

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** `'all'` means "no constraint" for every dropdown filter. */
export interface ApprovalQueueFilters {
  query: string;
  status: 'all' | ProposalStatus;
  /** Matches `proposal.agentName`. */
  agent: 'all' | string;
  riskTier: 'all' | RiskLevel;
}

export const DEFAULT_APPROVAL_QUEUE_FILTERS: ApprovalQueueFilters = {
  query: '',
  status: 'all',
  agent: 'all',
  riskTier: 'all',
};

/** Canonical display order for statuses in the queue filter dropdown. */
export const APPROVAL_STATUS_ORDER: ProposalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'executed',
];

/** Lowest to highest; mirrors the ladder in `riskLevel` (`src/lib/status.ts`). */
export const APPROVAL_RISK_TIER_ORDER: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

export type ApprovalQueueSortId = 'amount' | 'date' | 'risk';

export interface ApprovalQueueSort {
  id: ApprovalQueueSortId;
  desc: boolean;
}

export const APPROVAL_QUEUE_SORT_LABELS: Record<ApprovalQueueSortId, string> = {
  amount: 'Amount',
  date: 'Date',
  risk: 'Risk level',
};

export const APPROVAL_QUEUE_SORT_IDS: ApprovalQueueSortId[] = ['amount', 'date', 'risk'];

/** Default: riskiest proposals first, so reviewers see urgent items up top. */
export const DEFAULT_APPROVAL_QUEUE_SORT: ApprovalQueueSort = { id: 'risk', desc: true };

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** Risk tier for a proposal score, reusing the shared `riskLevel` ladder. */
export function approvalRiskTier(score: number): RiskLevel {
  return riskLevel(score).level;
}

export function countActiveApprovalQueueFilters(filters: ApprovalQueueFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.agent !== 'all' ? 1 : 0) +
    (filters.riskTier !== 'all' ? 1 : 0)
  );
}

export function matchesApprovalQueueFilters(
  proposal: Proposal,
  filters: ApprovalQueueFilters,
): boolean {
  const queryTerms = filters.query
    .trim()
    .toLocaleLowerCase()
    .replace(/[$,]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (queryTerms.length > 0) {
    const searchableText = [
      proposal.title,
      proposal.description,
      proposal.agentName,
      proposal.counterparty,
      proposal.transactionId,
      proposal.asset,
      proposal.amount,
      proposal.proposerName,
      proposal.proposerId,
      ...proposal.approvals.flatMap((approval) => [approval.userName, approval.userId]),
    ]
      .join(' ')
      .toLocaleLowerCase();
    if (!queryTerms.every((term) => searchableText.includes(term))) return false;
  }
  if (filters.status !== 'all' && proposal.status !== filters.status) return false;
  if (filters.agent !== 'all' && proposal.agentName !== filters.agent) return false;
  if (filters.riskTier !== 'all' && approvalRiskTier(proposal.riskScore) !== filters.riskTier) {
    return false;
  }
  return true;
}

export function filterApprovalQueue(
  proposals: Proposal[],
  filters: ApprovalQueueFilters,
): Proposal[] {
  return proposals.filter((proposal) => matchesApprovalQueueFilters(proposal, filters));
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

/** Unparseable dates sort as oldest so they sink to the bottom of every view. */
function proposalTimestamp(proposal: Proposal): number {
  const timestamp = Date.parse(proposal.createdAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Ascending comparator for one column; the caller flips the sign for
 * descending. The `id` tiebreak keeps ordering fully deterministic for equal
 * amounts, dates, or tiers.
 */
export function compareApprovalQueueRows(
  a: Proposal,
  b: Proposal,
  id: ApprovalQueueSortId,
): number {
  let result = 0;
  if (id === 'amount') {
    result = a.amount - b.amount;
  } else if (id === 'date') {
    result = proposalTimestamp(a) - proposalTimestamp(b);
  } else {
    result =
      APPROVAL_RISK_TIER_ORDER.indexOf(approvalRiskTier(a.riskScore)) -
      APPROVAL_RISK_TIER_ORDER.indexOf(approvalRiskTier(b.riskScore));
  }
  return result !== 0 ? result : a.id.localeCompare(b.id);
}

export function sortApprovalQueue(proposals: Proposal[], sort: ApprovalQueueSort): Proposal[] {
  const factor = sort.desc ? -1 : 1;
  return [...proposals].sort((a, b) => factor * compareApprovalQueueRows(a, b, sort.id));
}

// ---------------------------------------------------------------------------
// Option lists — derived from the data so the dropdowns never offer empty
// choices, and listed in the canonical orders above.
// ---------------------------------------------------------------------------

export function collectApprovalStatusOptions(proposals: Proposal[]): ProposalStatus[] {
  const present = new Set(proposals.map((proposal) => proposal.status));
  const required = new Set<ProposalStatus>(['pending', 'approved', 'rejected']);
  return APPROVAL_STATUS_ORDER.filter((status) => required.has(status) || present.has(status));
}

/** Distinct agent names in first-seen order. */
export function collectApprovalAgentOptions(proposals: Proposal[]): string[] {
  return Array.from(new Set(proposals.map((proposal) => proposal.agentName)));
}

export function collectApprovalRiskTierOptions(proposals: Proposal[]): RiskLevel[] {
  const present = new Set(proposals.map((proposal) => approvalRiskTier(proposal.riskScore)));
  return APPROVAL_RISK_TIER_ORDER.filter((tier) => present.has(tier));
}

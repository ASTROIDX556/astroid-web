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
  status: 'all' | ProposalStatus;
  /** Matches `proposal.agentName`. */
  agent: 'all' | string;
  riskTier: 'all' | RiskLevel;
  /**
   * Signature-threshold facet (#246): `pending_threshold` matches proposals
   * still pending with fewer approvals than required; `threshold_met`
   * matches every proposal whose collected signatures reach the threshold.
   */
  signature: 'all' | ApprovalSignatureFilter;
}

export type ApprovalSignatureFilter = 'pending_threshold' | 'threshold_met';

export const APPROVAL_SIGNATURE_FILTER_LABELS: Record<'all' | ApprovalSignatureFilter, string> = {
  all: 'All signature states',
  pending_threshold: 'Pending threshold',
  threshold_met: 'Threshold met',
};

export const APPROVAL_SIGNATURE_FILTER_IDS: Array<'all' | ApprovalSignatureFilter> = [
  'all',
  'pending_threshold',
  'threshold_met',
];

export const DEFAULT_APPROVAL_QUEUE_FILTERS: ApprovalQueueFilters = {
  status: 'all',
  agent: 'all',
  riskTier: 'all',
  signature: 'all',
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

/**
 * Signature collection progress for a proposal — the server-recorded
 * approvals against the required threshold. Shared by the signature filter
 * facet and the reusable `SignatureStatusBadge` (#246).
 */
export interface ApprovalSignatureProgress {
  approved: number;
  required: number;
  meetsThreshold: boolean;
}

export function approvalSignatureProgress(proposal: Proposal): ApprovalSignatureProgress {
  const approved = proposal.approvals.filter((entry) => entry.decision === 'approved').length;
  const required = proposal.requiredApprovals;
  return { approved, required, meetsThreshold: approved >= required };
}

export function countActiveApprovalQueueFilters(filters: ApprovalQueueFilters): number {
  return (
    (filters.status !== 'all' ? 1 : 0) +
    (filters.agent !== 'all' ? 1 : 0) +
    (filters.riskTier !== 'all' ? 1 : 0) +
    (filters.signature !== 'all' ? 1 : 0)
  );
}

export function matchesApprovalQueueFilters(
  proposal: Proposal,
  filters: ApprovalQueueFilters,
): boolean {
  if (filters.status !== 'all' && proposal.status !== filters.status) return false;
  if (filters.agent !== 'all' && proposal.agentName !== filters.agent) return false;
  if (filters.riskTier !== 'all' && approvalRiskTier(proposal.riskScore) !== filters.riskTier) {
    return false;
  }
  if (filters.signature !== 'all') {
    const { meetsThreshold } = approvalSignatureProgress(proposal);
    if (filters.signature === 'pending_threshold') {
      if (!(proposal.status === 'pending' && !meetsThreshold)) return false;
    } else if (!meetsThreshold) {
      return false;
    }
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
  return APPROVAL_STATUS_ORDER.filter((status) => present.has(status));
}

/** Distinct agent names in first-seen order. */
export function collectApprovalAgentOptions(proposals: Proposal[]): string[] {
  return Array.from(new Set(proposals.map((proposal) => proposal.agentName)));
}

export function collectApprovalRiskTierOptions(proposals: Proposal[]): RiskLevel[] {
  const present = new Set(proposals.map((proposal) => approvalRiskTier(proposal.riskScore)));
  return APPROVAL_RISK_TIER_ORDER.filter((tier) => present.has(tier));
}

// ---------------------------------------------------------------------------
// URL query state — filters and sort survive navigation when they live in
// search params (#246 AC3), mirroring the pattern in
// `src/features/transactions/TransactionAuditToolbar.tsx`.
// ---------------------------------------------------------------------------

export interface ApprovalQueueQueryState {
  filters: ApprovalQueueFilters;
  sort: ApprovalQueueSort;
}

const QUERY_PARAM_STATUS = 'status';
const QUERY_PARAM_AGENT = 'agent';
const QUERY_PARAM_RISK = 'risk';
const QUERY_PARAM_SIGNATURE = 'sig';
const QUERY_PARAM_SORT = 'sort';
const QUERY_PARAM_DIR = 'dir';

/**
 * Read queue filter/sort state from URL search params. Every closed
 * vocabulary is validated; junk or absent values fall back to the defaults,
 * so a hand-edited URL can never put the queue into an invalid state.
 */
export function parseApprovalQueueQuery(params: URLSearchParams): ApprovalQueueQueryState {
  const status = params.get(QUERY_PARAM_STATUS);
  const agent = params.get(QUERY_PARAM_AGENT);
  const riskTier = params.get(QUERY_PARAM_RISK);
  const signature = params.get(QUERY_PARAM_SIGNATURE);
  const sortId = params.get(QUERY_PARAM_SORT);
  const direction = params.get(QUERY_PARAM_DIR);

  return {
    filters: {
      status:
        status !== null && (status === 'all' || APPROVAL_STATUS_ORDER.includes(status as ProposalStatus))
          ? (status as ApprovalQueueFilters['status'])
          : 'all',
      agent: agent !== null && agent.trim().length > 0 ? agent : 'all',
      riskTier:
        riskTier !== null &&
        (riskTier === 'all' || APPROVAL_RISK_TIER_ORDER.includes(riskTier as RiskLevel))
          ? (riskTier as ApprovalQueueFilters['riskTier'])
          : 'all',
      signature:
        signature !== null &&
        APPROVAL_SIGNATURE_FILTER_IDS.includes(signature as 'all' | ApprovalSignatureFilter)
          ? (signature as ApprovalQueueFilters['signature'])
          : 'all',
    },
    sort: {
      id:
        sortId !== null && APPROVAL_QUEUE_SORT_IDS.includes(sortId as ApprovalQueueSortId)
          ? (sortId as ApprovalQueueSortId)
          : DEFAULT_APPROVAL_QUEUE_SORT.id,
      desc: direction === 'desc' ? true : direction === 'asc' ? false : DEFAULT_APPROVAL_QUEUE_SORT.desc,
    },
  };
}

/**
 * Write queue filter/sort state into a copy of the current params, omitting
 * defaults so a clean queue keeps a clean URL. Unrelated params (e.g. a
 * pagination token owned elsewhere) are preserved.
 */
export function writeApprovalQueueQuery(
  state: ApprovalQueueQueryState,
  current: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());

  const setOrDelete = (key: string, value: string, isDefault: boolean) => {
    if (isDefault) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  };

  setOrDelete(QUERY_PARAM_STATUS, state.filters.status, state.filters.status === 'all');
  setOrDelete(
    QUERY_PARAM_AGENT,
    state.filters.agent,
    state.filters.agent === DEFAULT_APPROVAL_QUEUE_FILTERS.agent,
  );
  setOrDelete(QUERY_PARAM_RISK, state.filters.riskTier, state.filters.riskTier === 'all');
  setOrDelete(QUERY_PARAM_SIGNATURE, state.filters.signature, state.filters.signature === 'all');
  setOrDelete(QUERY_PARAM_SORT, state.sort.id, state.sort.id === DEFAULT_APPROVAL_QUEUE_SORT.id);
  setOrDelete(
    QUERY_PARAM_DIR,
    state.sort.desc ? 'desc' : 'asc',
    state.sort.id === DEFAULT_APPROVAL_QUEUE_SORT.id && state.sort.desc === DEFAULT_APPROVAL_QUEUE_SORT.desc,
  );

  return params;
}

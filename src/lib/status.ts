import type { BadgeProps } from '@/components/ui/badge';
import type {
  AgentStatus,
  ProposalStatus,
  RiskLevel,
  TransactionStatus,
  WalletStatus,
} from '@/types/domain';
import type { SignerStatus } from '@/types/multisig';

export type BadgeVariant = NonNullable<BadgeProps['variant']>;

export interface StatusMeta {
  label: string;
  variant: BadgeVariant;
}

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
const transactionStatusVariant: Record<TransactionStatus, BadgeVariant> = {
  draft: 'neutral',
  pending: 'warning',
  approved: 'info',
  submitting: 'info',
  confirmed: 'success',
  completed: 'success',
  rejected: 'danger',
  expired: 'neutral',
  cancelled: 'neutral',
  failed: 'danger',
};

export function transactionStatus(status: TransactionStatus): StatusMeta {
  return { label: titleCase(status), variant: transactionStatusVariant[status] };
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------
const proposalStatusVariant: Record<ProposalStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  expired: 'neutral',
  executed: 'success',
};

export function proposalStatus(status: ProposalStatus): StatusMeta {
  return { label: titleCase(status), variant: proposalStatusVariant[status] };
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------
const agentStatusVariant: Record<AgentStatus, BadgeVariant> = {
  active: 'success',
  paused: 'warning',
  suspended: 'danger',
  archived: 'neutral',
};

export function agentStatus(status: AgentStatus): StatusMeta {
  return { label: titleCase(status), variant: agentStatusVariant[status] };
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------
const walletStatusVariant: Record<WalletStatus, BadgeVariant> = {
  active: 'success',
  frozen: 'info',
  paused: 'warning',
  archived: 'neutral',
};

export function walletStatus(status: WalletStatus): StatusMeta {
  return { label: titleCase(status), variant: walletStatusVariant[status] };
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------
/** Map a 0..100 risk score to a level + badge variant. */
export function riskLevel(score: number): { level: RiskLevel } & StatusMeta {
  if (score >= 75) return { level: 'critical', label: 'Critical', variant: 'danger' };
  if (score >= 50) return { level: 'high', label: 'High', variant: 'danger' };
  if (score >= 25) return { level: 'medium', label: 'Medium', variant: 'warning' };
  return { level: 'low', label: 'Low', variant: 'success' };
}

// ---------------------------------------------------------------------------
// Multi-sig signers
// ---------------------------------------------------------------------------
const signerStatusLabel: Record<SignerStatus, string> = {
  active: 'Active',
  proposed: 'Proposed',
  'removal-pending': 'Removal staged',
};

const signerStatusVariant: Record<SignerStatus, BadgeVariant> = {
  active: 'success',
  proposed: 'gold',
  'removal-pending': 'danger',
};

export function signerStatus(status: SignerStatus): StatusMeta {
  return { label: signerStatusLabel[status], variant: signerStatusVariant[status] };
}

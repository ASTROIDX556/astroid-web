/** Multi-Signature & Signer Management Domain Models */

export type SignerType = 'master' | 'co-signer';
export type SignerStatus = 'active' | 'pending_addition' | 'pending_removal';

export interface MultisigSignerItem {
  id: string;
  publicKey: string;
  weight: number;
  label: string;
  type: SignerType;
  status: SignerStatus;
  addedAt: string;
}

export interface AccountThresholds {
  lowThreshold: number;
  medThreshold: number;
  highThreshold: number;
  masterWeight: number;
}

export type ProposalType =
  | 'add_signer'
  | 'remove_signer'
  | 'update_weight'
  | 'update_thresholds';

export interface SignerProposalItem {
  id: string;
  accountAddress: string;
  type: ProposalType;
  targetPublicKey?: string;
  targetLabel?: string;
  newWeight?: number;
  currentWeight?: number;
  newThresholds?: Partial<AccountThresholds>;
  currentThresholds?: Partial<AccountThresholds>;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
  createdAt: string;
  description: string;
  proposedBy: string;
}

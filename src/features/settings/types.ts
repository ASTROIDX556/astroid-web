export type UserRole = 'admin' | 'approver' | 'operator' | 'viewer';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: 'active' | 'invited' | 'disabled';
  lastActiveAt: string;
}

export type PermissionKey =
  | 'policy_edit'
  | 'budget_allocate'
  | 'tx_sign'
  | 'agent_configure'
  | 'audit_view'
  | 'member_manage';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
}

export type RolePermissionMatrix = Record<UserRole, Record<PermissionKey, boolean>>;

export interface SignerKey {
  id: string;
  publicKey: string;
  name: string;
  weight: number;
  addedAt: string;
}

export interface ThresholdConfig {
  lowThreshold: number;
  medThreshold: number;
  highThreshold: number;
}

export interface MultiSigWallet {
  id: string;
  name: string;
  signers: SignerKey[];
  thresholds: ThresholdConfig;
}

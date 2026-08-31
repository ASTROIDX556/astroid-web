export type AssetCode = 'XLM' | 'USDC' | 'EURC' | 'ASTRO';

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  counterparty: string;
  amount: number;
}

export interface AgentAllocation {
  id: string;
  agentId: string;
  agentName: string;
  avatar?: string;
  role: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  asset: AssetCode;
  velocity24h: number; // e.g. amount spent in last 24h
  lastTransactionAt: string;
  /** Recent ledger history for the sub-department drill-down modal. */
  ledger?: LedgerEntry[];
}

export interface DepartmentBudget {
  id: string;
  departmentName: string;
  departmentCode: string;
  managerName: string;
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
  asset: AssetCode;
  period: 'monthly' | 'quarterly' | 'annual';
  agents: AgentAllocation[];
  updatedAt: string;
}

export type BudgetAlertLevel = 'ok' | 'warning' | 'critical';

export interface BudgetThresholds {
  warningThreshold: number;
  criticalThreshold: number;
}

export interface BudgetAlert {
  id: string;
  departmentId: string;
  departmentName: string;
  currentUtilization: number;
  level: BudgetAlertLevel;
  message: string;
  triggeredAt: string;
}

export interface BudgetAlertSettings {
  thresholds: BudgetThresholds;
  enabled: boolean;
}

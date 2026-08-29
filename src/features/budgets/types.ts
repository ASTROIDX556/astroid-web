export type AssetCode = 'XLM' | 'USDC' | 'EURC' | 'ASTRO';

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

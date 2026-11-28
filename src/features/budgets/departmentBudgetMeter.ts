import type { DepartmentBudget, AgentAllocation } from './types';

export type BudgetThresholdStatus = 'normal' | 'warning' | 'critical';

export interface DepartmentBudgetSummary {
  id: string;
  name: string;
  code: string;
  managerName: string;
  allocated: number;
  spent: number;
  remaining: number;
  /**
   * How far past the limit the department has spent, or 0 when inside it.
   * `remaining` is floored at 0, so this is the only figure that can say a
   * department is over budget.
   */
  overBudget: number;
  utilization: number;
  currency: string;
  period: string;
  agentCount: number;
  status: BudgetThresholdStatus;
  statusLabel: string;
  agents: AgentAllocation[];
}

export interface DepartmentBudgetAggregation {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  orgUtilization: number;
  status: BudgetThresholdStatus;
  currency: string;
  departments: DepartmentBudgetSummary[];
  counts: {
    total: number;
    normal: number;
    warning: number;
    critical: number;
  };
}

/**
 * Derives threshold status from utilization percentage (#238):
 * - normal: < 80%
 * - warning: 80% to 99.99%
 * - critical: >= 100%, i.e. the department has spent past its limit
 *
 * A non-finite utilization (a malformed budget from the indexer) is treated
 * as normal rather than critical: an unknown figure should not raise an
 * alarm that sends someone to a department that is fine.
 */
export function getBudgetThresholdStatus(utilization: number): BudgetThresholdStatus {
  if (!Number.isFinite(utilization) || utilization < 80) return 'normal';
  if (utilization < 100) return 'warning';
  return 'critical';
}

export function getStatusLabel(status: BudgetThresholdStatus): string {
  switch (status) {
    case 'critical':
      return 'Over budget (≥100%)';
    case 'warning':
      return 'Watch (80-99%)';
    case 'normal':
    default:
      return 'Healthy (<80%)';
  }
}

/**
 * Aggregates department-level spending vs allocated limits and returns
 * overall organization metrics, department summaries, and threshold categorization.
 */
export function aggregateDepartmentBudgets(
  departments: DepartmentBudget[],
): DepartmentBudgetAggregation {
  let totalAllocated = 0;
  let totalSpent = 0;
  let totalRemaining = 0;
  const currency = departments[0]?.asset ?? 'USDC';

  const summaries: DepartmentBudgetSummary[] = departments.map((dept) => {
    const allocated = Math.max(0, dept.totalLimit);
    const spent = Math.max(0, dept.totalSpent);
    const remaining = Math.max(0, dept.totalRemaining ?? allocated - spent);
    const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
    const status = getBudgetThresholdStatus(utilization);

    totalAllocated += allocated;
    totalSpent += spent;
    totalRemaining += remaining;

    return {
      id: dept.id,
      name: dept.departmentName,
      code: dept.departmentCode,
      managerName: dept.managerName,
      allocated,
      spent,
      remaining,
      overBudget: Math.max(0, spent - allocated),
      utilization,
      currency: dept.asset ?? 'USDC',
      period: dept.period,
      agentCount: dept.agents?.length ?? 0,
      status,
      statusLabel: getStatusLabel(status),
      agents: dept.agents ?? [],
    };
  });

  const orgUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
  const orgStatus = getBudgetThresholdStatus(orgUtilization);

  const counts = {
    total: summaries.length,
    normal: summaries.filter((d) => d.status === 'normal').length,
    warning: summaries.filter((d) => d.status === 'warning').length,
    critical: summaries.filter((d) => d.status === 'critical').length,
  };

  return {
    totalAllocated,
    totalSpent,
    totalRemaining,
    orgUtilization,
    status: orgStatus,
    currency,
    departments: summaries,
    counts,
  };
}

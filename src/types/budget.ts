/** Department-level budget allocation types for breakdown charts and tables. */

import { budgetUtilizationPercent } from '@/lib/budget';

export type DepartmentKey = 'engineering' | 'marketing' | 'operations';

export type DepartmentName = 'Engineering' | 'Marketing' | 'Operations';

export type DepartmentBudgetPeriod = 'monthly' | 'weekly' | 'quarterly' | 'annual';

export interface DepartmentBudgetBreakdown {
  id: string;
  department: DepartmentName;
  departmentKey: DepartmentKey;
  allocated: number;
  spent: number;
  remaining: number;
  currency: string;
  period: DepartmentBudgetPeriod;
}

/** Chart-ready slice derived from a department budget row. */
export interface DepartmentBudgetChartSlice {
  name: DepartmentName;
  departmentKey: DepartmentKey;
  allocated: number;
  spent: number;
  remaining: number;
  currency: string;
  fill: string;
}

export { remainingBudget } from '@/lib/budget';

export function departmentUtilizationPercent(row: Pick<DepartmentBudgetBreakdown, 'allocated' | 'spent'>): number {
  return budgetUtilizationPercent(row.allocated, row.spent);
}

export const MOCK_DEPARTMENT_BUDGET_BREAKDOWN: DepartmentBudgetBreakdown[] = [
  {
    id: 'dept-engineering',
    department: 'Engineering',
    departmentKey: 'engineering',
    allocated: 250_000,
    spent: 187_500,
    remaining: 62_500,
    currency: 'USDC',
    period: 'monthly',
  },
  {
    id: 'dept-marketing',
    department: 'Marketing',
    departmentKey: 'marketing',
    allocated: 150_000,
    spent: 67_500,
    remaining: 82_500,
    currency: 'USDC',
    period: 'monthly',
  },
  {
    id: 'dept-operations',
    department: 'Operations',
    departmentKey: 'operations',
    allocated: 420_000,
    spent: 318_400,
    remaining: 101_600,
    currency: 'USDC',
    period: 'monthly',
  },
];

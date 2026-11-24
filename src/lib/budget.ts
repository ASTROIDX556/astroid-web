/**
 * Pure budget-consumption calculations.
 *
 * These helpers back the budget charts, meters and threshold alerts. They are
 * intentionally free of React and I/O so the financial rules can be unit tested
 * in isolation (`src/lib/budget.test.ts`).
 */

/** Utilization band for a budget, from unfunded through over-budget. */
export type BudgetHealth = 'unfunded' | 'healthy' | 'warning' | 'critical' | 'over';

export interface BudgetThresholds {
  /** Utilization percentage at which a budget starts warning. */
  warning: number;
  /** Utilization percentage at which a budget is at (or past) its cap. */
  critical: number;
}

export const DEFAULT_BUDGET_THRESHOLDS: BudgetThresholds = {
  warning: 80,
  critical: 100,
};

export interface BudgetConsumption {
  allocated: number;
  spent: number;
  /** Allocated minus spent. Negative when spending overflows the budget. */
  remaining: number;
  /** Spent as a 0–100 (or greater) percentage of allocated. */
  utilization: number;
  isOverBudget: boolean;
  health: BudgetHealth;
}

export interface DepartmentAllocationInput {
  id: string;
  allocated: number;
}

export interface DepartmentAllocationShare {
  id: string;
  allocated: number;
  /** Share of the total allocation, 0–100. */
  percent: number;
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Remaining budget; negative values signal over-spend rather than clamping. */
export function remainingBudget(allocated: number, spent: number): number {
  return allocated - spent;
}

/**
 * Spent as a percentage of allocated. A zero (or invalid) allocation yields 0
 * so charts never divide by zero; over-spend is preserved above 100%.
 */
export function budgetUtilizationPercent(allocated: number, spent: number): number {
  if (!isPositiveFinite(allocated) || !Number.isFinite(spent) || spent <= 0) return 0;
  return (spent / allocated) * 100;
}

/** Utilization band for a consumption record. */
export function budgetHealth(
  allocation: { allocated: number; spent: number },
  thresholds: BudgetThresholds = DEFAULT_BUDGET_THRESHOLDS,
): BudgetHealth {
  const { allocated, spent } = allocation;
  if (!isPositiveFinite(allocated)) {
    return isPositiveFinite(spent) ? 'unfunded' : 'healthy';
  }
  const utilization = budgetUtilizationPercent(allocated, spent);
  if (utilization > thresholds.critical) return 'over';
  if (utilization >= thresholds.critical) return 'critical';
  if (utilization >= thresholds.warning) return 'warning';
  return 'healthy';
}

/** Full consumption snapshot used by the budget cards and meters. */
export function computeBudgetConsumption(
  allocation: { allocated: number; spent: number },
  thresholds: BudgetThresholds = DEFAULT_BUDGET_THRESHOLDS,
): BudgetConsumption {
  const allocated = Number.isFinite(allocation.allocated) ? allocation.allocated : 0;
  const spent = Number.isFinite(allocation.spent) ? allocation.spent : 0;
  const utilization = budgetUtilizationPercent(allocated, spent);

  return {
    allocated,
    spent,
    remaining: remainingBudget(allocated, spent),
    utilization,
    isOverBudget: utilization > thresholds.critical,
    health: budgetHealth({ allocated, spent }, thresholds),
  };
}

/**
 * Each department's share of the total allocated across all departments.
 * Returns an empty array for an empty or zero-allocation set.
 */
export function departmentAllocationShares(
  departments: readonly DepartmentAllocationInput[],
): DepartmentAllocationShare[] {
  const total = departments.reduce(
    (sum, department) => sum + (isPositiveFinite(department.allocated) ? department.allocated : 0),
    0,
  );

  return departments.map((department) => {
    const allocated = isPositiveFinite(department.allocated) ? department.allocated : 0;
    return {
      id: department.id,
      allocated,
      percent: total > 0 ? (allocated / total) * 100 : 0,
    };
  });
}

/** Thresholds crossed by `utilization`, ascending. Exact boundaries count. */
export function crossedThresholds(
  utilization: number,
  thresholds: readonly number[] = [DEFAULT_BUDGET_THRESHOLDS.warning, DEFAULT_BUDGET_THRESHOLDS.critical],
): number[] {
  if (!Number.isFinite(utilization)) return [];
  return thresholds.filter((threshold) => utilization >= threshold).sort((a, b) => a - b);
}

/** The highest alert threshold reached, or `null` when still under budget. */
export function highestThresholdCrossed(
  utilization: number,
  thresholds: readonly number[] = [DEFAULT_BUDGET_THRESHOLDS.warning, DEFAULT_BUDGET_THRESHOLDS.critical],
): number | null {
  const crossed = crossedThresholds(utilization, thresholds);
  return crossed.length > 0 ? crossed[crossed.length - 1] ?? null : null;
}

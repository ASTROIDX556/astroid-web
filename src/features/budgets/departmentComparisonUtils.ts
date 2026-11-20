import type { DepartmentBudget } from './types';

export interface DepartmentComparisonRow {
  id: string;
  department: string;
  allocated: number;
  consumed: number;
  utilizationPercent: number | null;
  asset: DepartmentBudget['asset'];
}

/** Build comparable chart rows without hiding over-budget spend or zero allocations. */
export function buildDepartmentComparisonData(
  departments: readonly DepartmentBudget[],
): DepartmentComparisonRow[] {
  return departments.map((department) => {
    const allocated = Number.isFinite(department.totalLimit)
      ? Math.max(0, department.totalLimit)
      : 0;
    const consumed = Number.isFinite(department.totalSpent)
      ? Math.max(0, department.totalSpent)
      : 0;

    return {
      id: department.id,
      department: department.departmentName,
      allocated,
      consumed,
      utilizationPercent:
        allocated > 0 ? Number(((consumed / allocated) * 100).toFixed(2)) : null,
      asset: department.asset,
    };
  });
}

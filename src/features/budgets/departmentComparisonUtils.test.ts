import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDepartmentComparisonData } from './departmentComparisonUtils';
import type { DepartmentBudget } from './types';

const department = (
  id: string,
  totalLimit: number,
  totalSpent: number,
): DepartmentBudget => ({
  id,
  departmentName: id,
  departmentCode: id.toUpperCase(),
  managerName: 'Manager',
  totalLimit,
  totalSpent,
  totalRemaining: totalLimit - totalSpent,
  asset: 'USDC',
  period: 'monthly',
  agents: [],
  updatedAt: '2026-01-01T00:00:00Z',
});

test('buildDepartmentComparisonData preserves zero budgets and uncapped overruns', () => {
  const rows = buildDepartmentComparisonData([
    department('zero-budget', 0, 25),
    department('over-budget', 100, 125),
  ]);

  assert.deepEqual(
    rows.map(({ allocated, consumed, utilizationPercent }) => ({
      allocated,
      consumed,
      utilizationPercent,
    })),
    [
      { allocated: 0, consumed: 25, utilizationPercent: null },
      { allocated: 100, consumed: 125, utilizationPercent: 125 },
    ],
  );
});

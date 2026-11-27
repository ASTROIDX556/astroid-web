import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateDepartmentBudgets,
  getBudgetThresholdStatus,
} from './departmentBudgetMeter';
import type { DepartmentBudget } from './types';

const TEST_DEPARTMENTS: DepartmentBudget[] = [
  {
    id: 'dept-1',
    departmentName: 'Engineering',
    departmentCode: 'ENG',
    managerName: 'Alice',
    totalLimit: 100_000,
    totalSpent: 50_000,
    totalRemaining: 50_000,
    asset: 'USDC',
    period: 'monthly',
    updatedAt: new Date().toISOString(),
    agents: [],
  },
  {
    id: 'dept-2',
    departmentName: 'Marketing',
    departmentCode: 'MKT',
    managerName: 'Bob',
    totalLimit: 100_000,
    totalSpent: 85_000,
    totalRemaining: 15_000,
    asset: 'USDC',
    period: 'monthly',
    updatedAt: new Date().toISOString(),
    agents: [],
  },
  {
    id: 'dept-3',
    departmentName: 'Operations',
    departmentCode: 'OPS',
    managerName: 'Charlie',
    totalLimit: 100_000,
    totalSpent: 105_000,
    totalRemaining: 0,
    asset: 'USDC',
    period: 'monthly',
    updatedAt: new Date().toISOString(),
    agents: [],
  },
];

test('getBudgetThresholdStatus warns above 80% and turns critical at 100%', () => {
  assert.equal(getBudgetThresholdStatus(0), 'normal');
  assert.equal(getBudgetThresholdStatus(79.9), 'normal');
  assert.equal(getBudgetThresholdStatus(80), 'warning');
  assert.equal(getBudgetThresholdStatus(99.9), 'warning');
  assert.equal(getBudgetThresholdStatus(100), 'critical');
  assert.equal(getBudgetThresholdStatus(105), 'critical');
});

test('getBudgetThresholdStatus treats a non-finite utilization as normal', () => {
  assert.equal(getBudgetThresholdStatus(Number.NaN), 'normal');
  assert.equal(getBudgetThresholdStatus(Number.POSITIVE_INFINITY), 'normal');
});

test('aggregateDepartmentBudgets computes correct sums and percentages', () => {
  const result = aggregateDepartmentBudgets(TEST_DEPARTMENTS);

  assert.equal(result.totalAllocated, 300_000);
  assert.equal(result.totalSpent, 240_000);
  assert.equal(result.totalRemaining, 65_000);
  assert.equal(result.orgUtilization, 80);
  assert.equal(result.status, 'warning');

  assert.equal(result.counts.total, 3);
  assert.equal(result.counts.normal, 1);
  assert.equal(result.counts.warning, 1);
  assert.equal(result.counts.critical, 1);

  assert.equal(result.departments[0]?.status, 'normal');
  assert.equal(result.departments[1]?.status, 'warning');
  assert.equal(result.departments[2]?.status, 'critical');

  // Only the department past its limit has an over-budget figure, and it is
  // the amount beyond the limit rather than the (floored) remaining budget.
  assert.equal(result.departments[0]?.overBudget, 0);
  assert.equal(result.departments[1]?.overBudget, 0);
  assert.equal(result.departments[2]?.overBudget, 5_000);
  assert.equal(result.departments[2]?.remaining, 0);
});

test('aggregateDepartmentBudgets handles zero allocation safely', () => {
  const zeroDept: DepartmentBudget[] = [
    {
      id: 'dept-zero',
      departmentName: 'Zero Dept',
      departmentCode: 'ZERO',
      managerName: 'Dan',
      totalLimit: 0,
      totalSpent: 0,
      totalRemaining: 0,
      asset: 'USDC',
      period: 'monthly',
      updatedAt: new Date().toISOString(),
      agents: [],
    },
  ];

  const result = aggregateDepartmentBudgets(zeroDept);
  assert.equal(result.totalAllocated, 0);
  assert.equal(result.orgUtilization, 0);
  assert.equal(result.departments[0]?.utilization, 0);
  assert.equal(result.departments[0]?.status, 'normal');
});

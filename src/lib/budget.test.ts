import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUDGET_THRESHOLDS,
  budgetHealth,
  budgetUtilizationPercent,
  computeBudgetConsumption,
  crossedThresholds,
  departmentAllocationShares,
  highestThresholdCrossed,
  remainingBudget,
} from '@/lib/budget';
import { formatCurrency, formatPercent } from '@/lib/format';
import { departmentUtilizationPercent } from '@/types/budget';

describe('remainingBudget', () => {
  it('returns the unspent remainder', () => {
    expect(remainingBudget(100_000, 62_500)).toBe(37_500);
  });

  it('returns a negative value when spending overflows the allocation', () => {
    expect(remainingBudget(10_000, 12_500)).toBe(-2_500);
  });
});

describe('budgetUtilizationPercent', () => {
  it('computes normal consumption as a percentage', () => {
    expect(budgetUtilizationPercent(250_000, 187_500)).toBe(75);
  });

  it('preserves exact threshold boundaries', () => {
    expect(budgetUtilizationPercent(10_000, 8_000)).toBe(80);
    expect(budgetUtilizationPercent(10_000, 10_000)).toBe(100);
  });

  it('returns values above 100 for over-budget spend', () => {
    expect(budgetUtilizationPercent(15_000, 16_200)).toBeCloseTo(108, 5);
  });

  it('returns 0 for a zero or negative allocation instead of dividing by zero', () => {
    expect(budgetUtilizationPercent(0, 0)).toBe(0);
    expect(budgetUtilizationPercent(0, 500)).toBe(0);
    expect(budgetUtilizationPercent(-100, 50)).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(budgetUtilizationPercent(Number.NaN, 100)).toBe(0);
    expect(budgetUtilizationPercent(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('treats zero or negative spend as no consumption', () => {
    expect(budgetUtilizationPercent(1_000, 0)).toBe(0);
    expect(budgetUtilizationPercent(1_000, -50)).toBe(0);
  });

  it('matches the department breakdown helper', () => {
    expect(departmentUtilizationPercent({ allocated: 150_000, spent: 67_500 })).toBe(45);
    expect(departmentUtilizationPercent({ allocated: 0, spent: 0 })).toBe(0);
  });
});

describe('budgetHealth', () => {
  it('reports healthy consumption below the warning threshold', () => {
    expect(budgetHealth({ allocated: 10_000, spent: 4_000 })).toBe('healthy');
  });

  it('reports warning at the exact warning boundary', () => {
    expect(budgetHealth({ allocated: 10_000, spent: 8_000 })).toBe('warning');
  });

  it('reports critical exactly at the cap', () => {
    expect(budgetHealth({ allocated: 10_000, spent: 10_000 })).toBe('critical');
  });

  it('reports over once spending exceeds the cap', () => {
    expect(budgetHealth({ allocated: 15_000, spent: 16_200 })).toBe('over');
  });

  it('flags an unfunded allocation that already carries spend', () => {
    expect(budgetHealth({ allocated: 0, spent: 250 })).toBe('unfunded');
    expect(budgetHealth({ allocated: 0, spent: 0 })).toBe('healthy');
  });

  it('honours custom thresholds', () => {
    const thresholds = { warning: 50, critical: 90 };
    expect(budgetHealth({ allocated: 1_000, spent: 500 }, thresholds)).toBe('warning');
    expect(budgetHealth({ allocated: 1_000, spent: 900 }, thresholds)).toBe('critical');
  });
});

describe('computeBudgetConsumption', () => {
  it('summarises normal consumption', () => {
    const result = computeBudgetConsumption({ allocated: 25_000, spent: 14_500 });
    expect(result).toMatchObject({
      allocated: 25_000,
      spent: 14_500,
      remaining: 10_500,
      isOverBudget: false,
      health: 'healthy',
    });
    expect(result.utilization).toBeCloseTo(58, 6);
  });

  it('summarises an over-budget department', () => {
    const result = computeBudgetConsumption({ allocated: 15_000, spent: 16_200 });
    expect(result.isOverBudget).toBe(true);
    expect(result.health).toBe('over');
    expect(result.remaining).toBe(-1_200);
    expect(result.utilization).toBeCloseTo(108, 5);
  });

  it('handles a zero allocation without producing NaN', () => {
    expect(computeBudgetConsumption({ allocated: 0, spent: 0 })).toEqual({
      allocated: 0,
      spent: 0,
      remaining: 0,
      utilization: 0,
      isOverBudget: false,
      health: 'healthy',
    });
  });

  it('coerces non-finite inputs to zero', () => {
    const result = computeBudgetConsumption({ allocated: Number.NaN, spent: Number.NaN });
    expect(result).toEqual({
      allocated: 0,
      spent: 0,
      remaining: 0,
      utilization: 0,
      isOverBudget: false,
      health: 'healthy',
    });
  });
});

describe('departmentAllocationShares', () => {
  it('computes each department share of the total allocation', () => {
    const shares = departmentAllocationShares([
      { id: 'engineering', allocated: 250_000 },
      { id: 'marketing', allocated: 150_000 },
      { id: 'operations', allocated: 420_000 },
    ]);

    expect(shares.map((share) => share.id)).toEqual(['engineering', 'marketing', 'operations']);
    expect(shares[0]?.percent).toBeCloseTo(30.4878, 3);
    expect(shares[1]?.percent).toBeCloseTo(18.2927, 3);
    expect(shares[2]?.percent).toBeCloseTo(51.2195, 3);
    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBeCloseTo(100, 6);
  });

  it('handles exact halves', () => {
    const shares = departmentAllocationShares([
      { id: 'a', allocated: 5_000 },
      { id: 'b', allocated: 5_000 },
    ]);
    expect(shares.map((share) => share.percent)).toEqual([50, 50]);
  });

  it('returns zero shares when nothing is allocated', () => {
    const shares = departmentAllocationShares([
      { id: 'a', allocated: 0 },
      { id: 'b', allocated: 0 },
    ]);
    expect(shares.map((share) => share.percent)).toEqual([0, 0]);
  });

  it('returns an empty array for no departments', () => {
    expect(departmentAllocationShares([])).toEqual([]);
  });

  it('ignores negative allocations when computing the total', () => {
    const shares = departmentAllocationShares([
      { id: 'a', allocated: 1_000 },
      { id: 'b', allocated: -500 },
    ]);
    expect(shares.map((share) => share.percent)).toEqual([100, 0]);
  });
});

describe('threshold alerts', () => {
  it('crosses no threshold below the first boundary', () => {
    expect(crossedThresholds(79.99)).toEqual([]);
    expect(highestThresholdCrossed(79.99)).toBeNull();
  });

  it('crosses the warning threshold exactly at 80', () => {
    expect(crossedThresholds(80)).toEqual([80]);
    expect(highestThresholdCrossed(80)).toBe(80);
  });

  it('crosses both thresholds when at the cap', () => {
    expect(crossedThresholds(100)).toEqual([80, 100]);
    expect(highestThresholdCrossed(100)).toBe(100);
  });

  it('keeps the highest threshold when over budget', () => {
    expect(crossedThresholds(130)).toEqual([80, 100]);
    expect(highestThresholdCrossed(130)).toBe(100);
  });

  it('supports custom thresholds', () => {
    expect(highestThresholdCrossed(75, [50, 70, 90])).toBe(70);
    expect(crossedThresholds(95, [50, 70, 90])).toEqual([50, 70, 90]);
  });

  it('returns no alerts for non-finite utilization', () => {
    expect(crossedThresholds(Number.NaN)).toEqual([]);
  });

  it('exposes the default thresholds used by the dashboard', () => {
    expect(DEFAULT_BUDGET_THRESHOLDS).toEqual({ warning: 80, critical: 100 });
  });
});

describe('multi-currency formatting', () => {
  it('formats USDC amounts with a dollar prefix', () => {
    expect(formatCurrency(12_500, 'USDC')).toBe('$12,500');
  });

  it('suffixes assets that have no currency symbol', () => {
    expect(formatCurrency(1_250.5, 'XLM')).toBe('1,250.50 XLM');
  });

  it('respects decimal precision overrides', () => {
    expect(formatCurrency(1_250.5, 'USDC', { decimals: 1 })).toBe('$1,250.5');
  });

  it('formats utilization percentages for the threshold labels', () => {
    expect(formatPercent(budgetUtilizationPercent(10_000, 8_000))).toBe('80%');
    expect(formatPercent(budgetUtilizationPercent(15_000, 16_200), 1)).toBe('108.0%');
  });
});

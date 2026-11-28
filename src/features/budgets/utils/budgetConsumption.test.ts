import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateConsumptionPercent,
  classifyBudgetConsumption,
  computeBudgetConsumption,
  getConsumptionLevel,
  normalizeThreshold,
  normalizeThresholds,
} from './budgetConsumption';

test('consumption stays healthy below the 80% warning threshold', () => {
  const result = computeBudgetConsumption(1000, 799);
  assert.equal(result.level, 'healthy');
  assert.equal(result.remaining, 201);
});

test('consumption switches to warning at exactly 80%', () => {
  assert.equal(computeBudgetConsumption(1000, 800).level, 'warning');
  assert.equal(computeBudgetConsumption(1000, 949).level, 'warning');
});

test('consumption switches to critical at exactly 95%', () => {
  assert.equal(computeBudgetConsumption(1000, 950).level, 'critical');
  assert.equal(computeBudgetConsumption(1000, 1000).level, 'critical');
});

test('overspend is reported as exceeded with a clamped display percent', () => {
  const result = computeBudgetConsumption(1000, 1250);
  assert.equal(result.level, 'exceeded');
  assert.equal(result.percent, 125);
  assert.equal(result.displayPercent, 100);
  assert.equal(result.remaining, 0);
  assert.equal(result.overspend, 250);
});

test('custom thresholds move the state boundaries', () => {
  assert.equal(computeBudgetConsumption(100, 60, { warning: 50, critical: 75 }).level, 'warning');
  assert.equal(computeBudgetConsumption(100, 75, { warning: 50, critical: 75 }).level, 'critical');
});

test('invalid thresholds are clamped and reordered', () => {
  assert.deepEqual(normalizeThresholds({ warning: 97, critical: 85 }), {
    warning: 85,
    critical: 97,
  });
  assert.deepEqual(normalizeThresholds({ warning: -10, critical: 400 }), {
    warning: 0,
    critical: 100,
  });
  assert.deepEqual(normalizeThresholds({ warning: Number.NaN }), { warning: 80, critical: 95 });
});

test('zero, negative and non-finite inputs never produce NaN', () => {
  const empty = computeBudgetConsumption(0, 0);
  assert.equal(empty.displayPercent, 0);
  assert.equal(empty.level, 'healthy');

  const zeroBudgetSpend = computeBudgetConsumption(0, 10);
  assert.equal(zeroBudgetSpend.level, 'exceeded');
  assert.equal(zeroBudgetSpend.displayPercent, 100);

  const garbage = computeBudgetConsumption(Number.NaN, -50);
  assert.equal(garbage.displayPercent, 0);
  assert.equal(garbage.level, 'healthy');
});

test('getConsumptionLevel uses default thresholds when none are given', () => {
  assert.equal(getConsumptionLevel(79.9), 'healthy');
  assert.equal(getConsumptionLevel(80), 'warning');
  assert.equal(getConsumptionLevel(95), 'critical');
  assert.equal(getConsumptionLevel(100.1), 'exceeded');
});

test('calculates normal department consumption', () => {
  assert.equal(calculateConsumptionPercent(450, 1000), 45);
  assert.equal(calculateConsumptionPercent(800, 1000), 80);
});

test('handles zero and missing budget limits safely', () => {
  assert.equal(calculateConsumptionPercent(500, 0), 0);
  assert.equal(calculateConsumptionPercent(500, Number.NaN), 0);
  assert.deepEqual(classifyBudgetConsumption(500, 0), {
    percent: 0,
    remaining: 0,
    state: 'healthy',
  });
});

test('classifies warning at the 80 percent threshold', () => {
  assert.equal(classifyBudgetConsumption(800, 1000).state, 'warning');
});

test('classifies critical at the 95 percent threshold', () => {
  assert.equal(classifyBudgetConsumption(950, 1000).state, 'critical');
  assert.equal(classifyBudgetConsumption(1000, 1000).state, 'critical');
});

test('classifies consumption above 100 percent as exceeded', () => {
  assert.deepEqual(classifyBudgetConsumption(1250, 1000), {
    percent: 125,
    remaining: 0,
    state: 'exceeded',
  });
});

test('supports configurable thresholds and normalizes invalid values', () => {
  assert.equal(classifyBudgetConsumption(700, 1000, 70, 90).state, 'warning');
  assert.equal(normalizeThreshold(-10, 80), 0);
  assert.equal(normalizeThreshold(120, 80), 100);
  assert.equal(normalizeThreshold(Number.NaN, 80), 80);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateConsumptionPercent,
  classifyBudgetConsumption,
  normalizeThreshold,
} from './budgetConsumption';

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

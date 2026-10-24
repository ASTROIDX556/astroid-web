import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateSpendTrend,
  formatSpendTrendLabel,
  spendTrendDaySpan,
  spendTrendTotal,
} from './spendTrend';

test('weekly buckets start on Monday and sum the full week', () => {
  const buckets = aggregateSpendTrend(
    [
      { timestamp: '2026-03-02T12:00:00.000Z', amount: 10 },
      { timestamp: '2026-03-04T08:00:00.000Z', amount: 5 },
      { timestamp: '2026-03-08T23:59:59.000Z', amount: 2 },
      { timestamp: '2026-03-09T00:00:00.000Z', amount: 3 },
    ],
    'weekly',
  );

  assert.deepEqual(buckets, [
    { timestamp: '2026-03-02T00:00:00.000Z', amount: 17 },
    { timestamp: '2026-03-09T00:00:00.000Z', amount: 3 },
  ]);
});

test('monthly buckets group observations by calendar month', () => {
  const buckets = aggregateSpendTrend(
    [
      { timestamp: '2026-01-31T23:00:00.000Z', amount: 10.5 },
      { timestamp: '2026-02-01T01:00:00.000Z', amount: 5.25 },
      { timestamp: '2026-02-28T18:00:00.000Z', amount: 4.25 },
    ],
    'monthly',
  );

  assert.deepEqual(buckets, [
    { timestamp: '2026-01-01T00:00:00.000Z', amount: 10.5 },
    { timestamp: '2026-02-01T00:00:00.000Z', amount: 9.5 },
  ]);
});

test('buckets are sorted ascending regardless of input order', () => {
  const buckets = aggregateSpendTrend(
    [
      { timestamp: '2026-04-15T00:00:00.000Z', amount: 2 },
      { timestamp: '2026-03-15T00:00:00.000Z', amount: 1 },
      { timestamp: '2026-05-15T00:00:00.000Z', amount: 3 },
    ],
    'monthly',
  );

  assert.deepEqual(
    buckets.map((bucket) => bucket.amount),
    [1, 2, 3],
  );
});

test('invalid timestamps and non-finite amounts are ignored', () => {
  const buckets = aggregateSpendTrend(
    [
      { timestamp: 'not-a-date', amount: 100 },
      { timestamp: '2026-06-01T00:00:00.000Z', amount: Number.NaN },
      { timestamp: '2026-06-02T00:00:00.000Z', amount: Number.POSITIVE_INFINITY },
      { timestamp: '2026-06-03T00:00:00.000Z', amount: 7.115 },
    ],
    'monthly',
  );

  assert.deepEqual(buckets, [{ timestamp: '2026-06-01T00:00:00.000Z', amount: 7.12 }]);
});

test('totals ignore non-finite amounts and round to currency precision', () => {
  assert.equal(
    spendTrendTotal([
      { timestamp: '2026-06-01T00:00:00.000Z', amount: 0.1 },
      { timestamp: '2026-06-02T00:00:00.000Z', amount: 0.2 },
      { timestamp: '2026-06-03T00:00:00.000Z', amount: Number.NaN },
    ]),
    0.3,
  );
});

test('labels use UTC and match the selected interval', () => {
  assert.equal(formatSpendTrendLabel('2026-03-09T00:00:00.000Z', 'weekly'), 'Mar 9');
  assert.equal(
    formatSpendTrendLabel('2026-03-09T00:00:00.000Z', 'monthly'),
    'Mar 2026',
  );
  assert.equal(formatSpendTrendLabel('invalid', 'weekly'), 'invalid');
});

test('day span is inclusive and handles sparse inputs', () => {
  assert.equal(spendTrendDaySpan([]), 1);
  assert.equal(
    spendTrendDaySpan([
      { timestamp: '2026-03-01T00:00:00.000Z', amount: 1 },
      { timestamp: '2026-03-31T00:00:00.000Z', amount: 1 },
    ]),
    31,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  HIGH_VALUE_USD_THRESHOLD,
  filterTransactions,
  matchesTransactionPreset,
  resolveTransactionDateRange,
  type TransactionFilterValues,
} from './filterTransactions';

function makeTransaction(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Stellar Store',
    counterpartyAddress: 'GDESTINATIONALPHA',
    asset: 'USDC',
    amount: 25,
    usdValue: 25,
    purpose: 'Service payment',
    status: 'completed',
    riskScore: 5,
    createdAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  };
}

const records: Transaction[] = [
  makeTransaction({
    id: 'txn-alpha',
    memo: 'Monthly services',
    stellarHash: 'stellar-hash-alpha',
  }),
  makeTransaction({
    id: 'txn-beta',
    agentId: 'agent-orion',
    agentName: 'Orion',
    direction: 'inbound',
    counterparty: 'Circle',
    counterpartyAddress: 'GDESTINATIONBETA',
    asset: 'XLM',
    amount: 50,
    usdValue: 6,
    purpose: 'Treasury deposit',
    status: 'pending',
    riskScore: 10,
    createdAt: '2026-07-11T12:00:00.000Z',
  }),
];

const noFilters: TransactionFilterValues = {
  query: '',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
};

// Preset windows are relative to this instant, so tests never depend on the wall clock.
const NOW = Date.parse('2026-07-11T12:00:00.000Z');

const presetRecords: Transaction[] = [
  makeTransaction({
    id: 'at-boundary',
    createdAt: '2026-07-10T12:00:00.000Z',
    usdValue: 25,
  }),
  makeTransaction({
    id: 'just-outside',
    createdAt: '2026-07-10T11:59:59.999Z',
    usdValue: 25,
  }),
  makeTransaction({
    id: 'at-now',
    createdAt: '2026-07-11T12:00:00.000Z',
    usdValue: 25,
  }),
  makeTransaction({
    id: 'future',
    createdAt: '2026-07-11T12:00:00.001Z',
    usdValue: 25,
  }),
  makeTransaction({
    id: 'pending-high-value',
    status: 'pending',
    usdValue: HIGH_VALUE_USD_THRESHOLD,
  }),
  makeTransaction({
    id: 'just-below-high-value',
    status: 'pending',
    usdValue: HIGH_VALUE_USD_THRESHOLD - 0.01,
  }),
];

test('combines asset, status, and agent filters', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    asset: 'USDC',
    status: 'completed',
    agentId: 'agent-atlas',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-alpha'],
  );
});

test('searches transaction identifiers and hashes case-insensitively', () => {
  const filtered = filterTransactions(records, { ...noFilters, query: 'STELLAR-HASH' });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-alpha'],
  );
});

test('includes transactions on both selected date boundaries', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-alpha'],
  );
});

test('treats date-only bounds as inclusive UTC days', () => {
  const range = resolveTransactionDateRange('2026-07-10', '2026-07-10');

  assert.equal(range.from, Date.parse('2026-07-10T00:00:00.000Z'));
  assert.equal(range.to, Date.parse('2026-07-10T23:59:59.999Z'));
  assert.equal(
    filterTransactions(records, {
      ...noFilters,
      dateFrom: '2026-07-10',
      dateTo: '2026-07-10',
    }).length,
    1,
  );
});

test('honours open-ended date ranges', () => {
  assert.deepEqual(
    filterTransactions(records, { ...noFilters, dateFrom: '2026-07-11' }).map(
      (transaction) => transaction.id,
    ),
    ['txn-beta'],
  );
  assert.deepEqual(
    filterTransactions(records, { ...noFilters, dateTo: '2026-07-10' }).map(
      (transaction) => transaction.id,
    ),
    ['txn-alpha'],
  );
});

test('supports millisecond-precise bounds and includes exact boundary timestamps', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-11T12:00:00.000Z',
    dateTo: '2026-07-11T12:00:00.000Z',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-beta'],
  );
});

test('ignores empty or unparseable date bounds', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '   ',
    dateTo: 'not-a-date',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-alpha', 'txn-beta'],
  );
});

test('returns an empty list for an inverted date range', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-11',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(filtered, []);
});

test('last-24h preset includes its lower boundary and now, but excludes older and future rows', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['last-24h'] },
    NOW,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['at-boundary', 'at-now', 'pending-high-value', 'just-below-high-value'],
  );
});

test('pending-approvals preset selects only pending transactions', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['pending-approvals'] },
    NOW,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['pending-high-value', 'just-below-high-value'],
  );
});

test('high-value preset uses the USD threshold inclusively', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['high-value'] },
    NOW,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['pending-high-value'],
  );
});

test('multiple presets combine with AND semantics', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['last-24h', 'pending-approvals', 'high-value'] },
    NOW,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['pending-high-value'],
  );
});

test('presets overlap with explicit filters instead of replacing them', () => {
  const filtered = filterTransactions(
    presetRecords,
    {
      ...noFilters,
      status: 'pending',
      presets: ['last-24h', 'high-value'],
    },
    NOW,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['pending-high-value'],
  );

  const queryFiltered = filterTransactions(
    presetRecords,
    {
      ...noFilters,
      query: 'JUST-BELOW',
      dateFrom: '2026-07-10',
      dateTo: '2026-07-11',
      presets: ['last-24h'],
    },
    NOW,
  );

  assert.deepEqual(
    queryFiltered.map((transaction) => transaction.id),
    ['just-below-high-value'],
  );
});

test('empty preset lists behave like no presets', () => {
  assert.deepEqual(
    filterTransactions(presetRecords, { ...noFilters, presets: [] }, NOW).map(
      (transaction) => transaction.id,
    ),
    presetRecords.map((transaction) => transaction.id),
  );
});

test('matchesTransactionPreset is pure and returns false for invalid timestamps', () => {
  const broken = makeTransaction({ id: 'broken', createdAt: 'not-a-date' });

  assert.equal(matchesTransactionPreset(broken, 'last-24h', NOW), false);
  assert.equal(matchesTransactionPreset(broken, 'pending-approvals', NOW), false);
  assert.deepEqual(
    presetRecords.map((transaction) => transaction.id),
    [
      'at-boundary',
      'just-outside',
      'at-now',
      'future',
      'pending-high-value',
      'just-below-high-value',
    ],
  );
});

test('does not mutate the input array or its transactions', () => {
  const snapshot = structuredClone(records);
  const result = filterTransactions(records, {
    ...noFilters,
    presets: ['pending-approvals'],
  });

  assert.notEqual(result, records);
  assert.deepEqual(records, snapshot);
});

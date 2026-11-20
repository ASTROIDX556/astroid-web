import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  filterTransactions,
  HIGH_VALUE_TRANSACTION_THRESHOLD_USD,
  type TransactionFilterValues,
} from './filterTransactions';

const records: Transaction[] = [
  {
    id: 'txn-alpha',
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
    memo: 'Monthly services',
    purpose: 'Service payment',
    status: 'completed',
    riskScore: 5,
    stellarHash: 'stellar-hash-alpha',
    createdAt: '2026-07-10T12:00:00.000Z',
  },
  {
    id: 'txn-beta',
    organizationId: 'org-test',
    walletId: 'wallet-test',
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
  },
];

const noFilters: TransactionFilterValues = {
  query: '',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
  preset: 'all',
};

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return { ...records[0], ...overrides };
}

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

test('returns an empty list when filters have no matches', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    query: 'does-not-exist',
  });

  assert.deepEqual(filtered, []);
});

test('last 24 hours includes the exact lower boundary and excludes older or future records', () => {
  const now = Date.parse('2026-07-11T12:00:00.000Z');
  const transactions = [
    makeTransaction({
      id: 'boundary',
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    }),
    makeTransaction({
      id: 'too-old',
      createdAt: new Date(now - 24 * 60 * 60 * 1000 - 1).toISOString(),
    }),
    makeTransaction({
      id: 'future',
      createdAt: new Date(now + 1).toISOString(),
    }),
  ];

  const filtered = filterTransactions(
    transactions,
    { ...noFilters, preset: 'last-24-hours' },
    now,
  );

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['boundary'],
  );
});

test('pending approvals preset matches pending status and composes with other filters', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    preset: 'pending-approvals',
    asset: 'XLM',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['txn-beta'],
  );
});

test('high-value preset includes the threshold and excludes lower values', () => {
  const transactions = [
    makeTransaction({
      id: 'threshold',
      usdValue: HIGH_VALUE_TRANSACTION_THRESHOLD_USD,
    }),
    makeTransaction({ id: 'below-threshold', usdValue: 999.99 }),
    makeTransaction({ id: 'unknown-value', usdValue: Number.NaN }),
  ];

  const filtered = filterTransactions(transactions, {
    ...noFilters,
    preset: 'high-value',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['threshold'],
  );
});

test('custom date range includes both exact timestamp boundaries', () => {
  const start = new Date('2026-07-10T00:00:00').getTime();
  const end = new Date('2026-07-10T23:59:59.999').getTime();
  const transactions = [
    makeTransaction({ id: 'at-start', createdAt: new Date(start).toISOString() }),
    makeTransaction({ id: 'at-end', createdAt: new Date(end).toISOString() }),
    makeTransaction({
      id: 'before-start',
      createdAt: new Date(start - 1).toISOString(),
    }),
    makeTransaction({ id: 'after-end', createdAt: new Date(end + 1).toISOString() }),
  ];

  const filtered = filterTransactions(transactions, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['at-start', 'at-end'],
  );
});

test('preset, custom dates, and status filters intersect without mutating input', () => {
  const transactions = [
    makeTransaction({
      id: 'match',
      usdValue: HIGH_VALUE_TRANSACTION_THRESHOLD_USD,
      status: 'pending',
      createdAt: '2026-07-10T12:00:00.000Z',
    }),
    makeTransaction({
      id: 'wrong-status',
      usdValue: HIGH_VALUE_TRANSACTION_THRESHOLD_USD,
      status: 'completed',
      createdAt: '2026-07-10T12:00:00.000Z',
    }),
    makeTransaction({
      id: 'outside-date',
      usdValue: HIGH_VALUE_TRANSACTION_THRESHOLD_USD,
      status: 'pending',
      createdAt: '2026-07-12T12:00:00.000Z',
    }),
  ];
  const original = structuredClone(transactions);

  const filtered = filterTransactions(transactions, {
    ...noFilters,
    preset: 'high-value',
    status: 'pending',
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(
    filtered.map((transaction) => transaction.id),
    ['match'],
  );
  assert.notEqual(filtered, transactions);
  assert.deepEqual(transactions, original);
});

test('invalid or reversed custom date bounds return no transactions', () => {
  assert.deepEqual(
    filterTransactions(records, { ...noFilters, dateFrom: 'not-a-date' }),
    [],
  );
  assert.deepEqual(
    filterTransactions(records, {
      ...noFilters,
      dateFrom: '2026-02-31',
    }),
    [],
  );
  assert.deepEqual(
    filterTransactions(records, {
      ...noFilters,
      dateFrom: '2026-07-12',
      dateTo: '2026-07-10',
    }),
    [],
  );
});

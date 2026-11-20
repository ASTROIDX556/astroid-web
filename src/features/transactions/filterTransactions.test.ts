import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  filterAndSortTransactions,
  filterTransactions,
  sortTransactions,
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
  {
    id: 'txn-gamma',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Stellar Store',
    counterpartyAddress: 'GDESTINATIONGAMMA',
    asset: 'USDC',
    amount: 400,
    usdValue: 400,
    memo: 'Hardware order',
    purpose: 'Equipment purchase',
    status: 'rejected',
    riskScore: 80,
    createdAt: '2026-07-12T09:30:00.000Z',
  },
  {
    id: 'txn-delta',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-orion',
    agentName: 'Orion',
    direction: 'outbound',
    counterparty: 'Circle',
    counterpartyAddress: 'GDESTINATIONDELTA',
    asset: 'USDC',
    amount: 120,
    usdValue: 120,
    purpose: 'Treasury rebalance',
    status: 'approved',
    riskScore: 30,
    createdAt: '2026-07-12T18:00:00.000Z',
  },
];

const ids = (list: readonly Transaction[]) => list.map((transaction) => transaction.id);

const noFilters: TransactionFilterValues = {
  query: '',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
};

test('combines asset, status, and agent filters', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    asset: 'USDC',
    status: 'completed',
    agentId: 'agent-atlas',
  });

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('searches transaction identifiers and hashes case-insensitively', () => {
  const filtered = filterTransactions(records, { ...noFilters, query: 'STELLAR-HASH' });

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('includes transactions on both selected date boundaries', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('returns an empty list when filters have no matches', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    query: 'does-not-exist',
  });

  assert.deepEqual(filtered, []);
});

test('returns an empty list for an empty input regardless of filters', () => {
  assert.deepEqual(filterTransactions([], { ...noFilters, status: 'pending', query: 'x' }), []);
  assert.deepEqual(sortTransactions([], { key: 'amount', direction: 'asc' }), []);
});

test('filters by approved, pending and rejected statuses', () => {
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, status: 'approved' })), ['txn-delta']);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, status: 'pending' })), ['txn-beta']);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, status: 'rejected' })), ['txn-gamma']);
});

test('multi-select statuses override the single status value', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    status: 'completed',
    statuses: ['approved', 'pending'],
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-delta']);
});

test('multi-select assets match any listed asset', () => {
  assert.equal(filterTransactions(records, { ...noFilters, assets: ['XLM', 'USDC'] }).length, 4);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, assets: ['XLM'] })), ['txn-beta']);
});

test('combines status, asset, agent, date range and amount range', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    statuses: ['approved', 'rejected', 'completed'],
    asset: 'USDC',
    agentId: 'agent-atlas',
    dateFrom: '2026-07-11',
    dateTo: '2026-07-12',
    minUsdValue: 100,
  });

  assert.deepEqual(ids(filtered), ['txn-gamma']);
});

test('date range is inclusive across a multi-day window', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-11',
    dateTo: '2026-07-12',
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-gamma', 'txn-delta']);
});

test('open-ended date ranges only constrain the provided side', () => {
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, dateFrom: '2026-07-12' })), [
    'txn-gamma',
    'txn-delta',
  ]);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, dateTo: '2026-07-10' })), ['txn-alpha']);
});

test('a reversed date range is normalised instead of hiding every record', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-12',
    dateTo: '2026-07-11',
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-gamma', 'txn-delta']);
});

test('malformed date strings are ignored', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: 'not-a-date',
    dateTo: 'also-bad',
  });

  assert.equal(filtered.length, records.length);
});

test('records with an unparseable timestamp are excluded only when a date range is set', () => {
  const broken: Transaction = { ...records[0], id: 'txn-broken', createdAt: 'garbage' };

  assert.deepEqual(ids(filterTransactions([broken], noFilters)), ['txn-broken']);
  assert.deepEqual(filterTransactions([broken], { ...noFilters, dateFrom: '2026-01-01' }), []);
});

test('usd value bounds are inclusive', () => {
  const filtered = filterTransactions(records, { ...noFilters, minUsdValue: 25, maxUsdValue: 120 });

  assert.deepEqual(ids(filtered), ['txn-alpha', 'txn-delta']);
});

test('supports partial and multi-term search matches', () => {
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, query: 'treas' })), [
    'txn-beta',
    'txn-delta',
  ]);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, query: '  treasury   circle ' })), [
    'txn-beta',
    'txn-delta',
  ]);
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, query: 'treasury hardware' })), []);
});

test('search terms must match within a single record, not across records', () => {
  assert.deepEqual(ids(filterTransactions(records, { ...noFilters, query: 'alpha beta' })), []);
});

test('filtering does not mutate the input array or its records', () => {
  const snapshot = JSON.stringify(records);
  const frozen = Object.freeze([...records]);

  const filtered = filterTransactions(frozen, { ...noFilters, status: 'pending' });

  assert.notEqual(filtered, frozen);
  assert.equal(JSON.stringify(records), snapshot);
});

test('sorts by date, amount, risk and status in both directions', () => {
  assert.deepEqual(ids(sortTransactions(records, { key: 'createdAt', direction: 'desc' })), [
    'txn-delta',
    'txn-gamma',
    'txn-beta',
    'txn-alpha',
  ]);
  assert.deepEqual(ids(sortTransactions(records, { key: 'amount', direction: 'asc' })), [
    'txn-alpha',
    'txn-beta',
    'txn-delta',
    'txn-gamma',
  ]);
  assert.equal(ids(sortTransactions(records, { key: 'riskScore', direction: 'desc' }))[0], 'txn-gamma');
  assert.deepEqual(ids(sortTransactions(records, { key: 'status', direction: 'asc' })), [
    'txn-delta',
    'txn-alpha',
    'txn-beta',
    'txn-gamma',
  ]);
});

test('sorting returns a copy and breaks ties by id', () => {
  const tied: Transaction[] = [
    { ...records[0], id: 'b', usdValue: 10 },
    { ...records[0], id: 'a', usdValue: 10 },
  ];
  const original = [...tied];

  const sorted = sortTransactions(tied, { key: 'usdValue', direction: 'desc' });

  assert.deepEqual(ids(sorted), ['a', 'b']);
  assert.deepEqual(tied, original);
});

test('filterAndSortTransactions composes both steps', () => {
  const result = filterAndSortTransactions(
    records,
    { ...noFilters, asset: 'USDC' },
    { key: 'usdValue', direction: 'desc' },
  );

  assert.deepEqual(ids(result), ['txn-gamma', 'txn-delta', 'txn-alpha']);
});

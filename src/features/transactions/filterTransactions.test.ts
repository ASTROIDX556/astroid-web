import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  filterTransactions,
  parseDateBoundary,
  resolveDateRange,
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
    counterparty: 'Rejected Vendor',
    counterpartyAddress: 'GDESTINATIONGAMMA',
    asset: 'USDC',
    amount: 900,
    usdValue: 900,
    purpose: 'Blocked by policy',
    status: 'rejected',
    riskScore: 80,
    createdAt: '2026-07-12T12:00:00.000Z',
  },
];

const ids = (transactions: Transaction[]) =>
  transactions.map((transaction) => transaction.id);

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

test('filters by multiple statuses', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    statuses: ['pending', 'rejected'],
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-gamma']);
});

test('treats an empty statuses array as no status restriction', () => {
  const filtered = filterTransactions(records, { ...noFilters, statuses: [] });

  assert.deepEqual(ids(filtered), ['txn-alpha', 'txn-beta', 'txn-gamma']);
});

test('combines single status and multi-status filters with AND semantics', () => {
  assert.deepEqual(
    ids(
      filterTransactions(records, {
        ...noFilters,
        status: 'rejected',
        statuses: ['pending', 'rejected'],
      }),
    ),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(
      filterTransactions(records, {
        ...noFilters,
        status: 'completed',
        statuses: ['pending'],
      }),
    ),
    [],
  );
});

test('combines multi-status filter with a date range', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    statuses: ['completed', 'pending', 'rejected'],
    dateFrom: '2026-07-11',
    dateTo: '2026-07-12',
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-gamma']);
});

test('supports open-ended date ranges', () => {
  assert.deepEqual(
    ids(filterTransactions(records, { ...noFilters, dateFrom: '2026-07-11' })),
    ['txn-beta', 'txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(records, { ...noFilters, dateTo: '2026-07-11' })),
    ['txn-alpha', 'txn-beta'],
  );
});

test('normalises a reversed date range instead of matching nothing', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-12',
    dateTo: '2026-07-11',
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-gamma']);
});

test('ignores invalid date formats rather than hiding every row', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: 'not-a-date',
    dateTo: '2026-02-31',
  });

  assert.deepEqual(ids(filtered), ['txn-alpha', 'txn-beta', 'txn-gamma']);
});

test('accepts full ISO timestamps as date boundaries', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-11T00:00:00.000Z',
    dateTo: '2026-07-11T23:59:59.999Z',
  });

  assert.deepEqual(ids(filtered), ['txn-beta']);
});

test('excludes transactions with unparseable timestamps when a date range is set', () => {
  const broken: Transaction = { ...records[0], id: 'txn-broken', createdAt: 'garbage' };
  const withBroken = [...records, broken];

  assert.deepEqual(
    ids(filterTransactions(withBroken, { ...noFilters, dateFrom: '2026-07-01' })),
    ['txn-alpha', 'txn-beta', 'txn-gamma'],
  );
  assert.ok(ids(filterTransactions(withBroken, noFilters)).includes('txn-broken'));
});

test('matches search queries case-insensitively alongside status filters', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    query: '  ATLAS ',
    statuses: ['rejected'],
  });

  assert.deepEqual(ids(filtered), ['txn-gamma']);
});

test('does not mutate the input array', () => {
  const input = [...records];
  filterTransactions(input, { ...noFilters, statuses: ['pending'] });

  assert.deepEqual(ids(input), ['txn-alpha', 'txn-beta', 'txn-gamma']);
});

test('parseDateBoundary snaps date-only values to day edges', () => {
  const start = parseDateBoundary('2026-07-10', 'start');
  const end = parseDateBoundary('2026-07-10', 'end');

  assert.equal(start, new Date(2026, 6, 10, 0, 0, 0, 0).getTime());
  assert.equal(end, new Date(2026, 6, 10, 23, 59, 59, 999).getTime());
  assert.equal(parseDateBoundary('', 'start'), null);
  assert.equal(parseDateBoundary('2026-13-01', 'start'), null);
});

test('resolveDateRange returns null bounds when unset', () => {
  assert.deepEqual(resolveDateRange('', ''), { from: null, to: null });
});

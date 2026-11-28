import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  HIGH_VALUE_USD_THRESHOLD,
  filterTransactions,
  matchesTransactionPreset,
  parseDateBoundary,
  resolveDateRange,
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
    createdAt: new Date(2026, 6, 10, 12).toISOString(),
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
    createdAt: new Date(2026, 6, 11, 12).toISOString(),
  },
];

/**
 * Edge-case fixture: one transaction sits exactly on the last millisecond of a
 * day, one carries punctuation and a negative amount, and one omits the optional
 * memo and hash fields entirely.
 */
const edgeRecords: Transaction[] = [
  {
    id: 'txn-gamma',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Lumen & Co.',
    counterpartyAddress: 'GDESTINATIONGAMMA',
    asset: 'USDC',
    amount: 0,
    usdValue: 0,
    memo: 'Invoice #42 - "final" (50%)',
    purpose: 'Vendor settlement',
    status: 'approved',
    riskScore: 3,
    stellarHash: 'STELLAR-HASH-GAMMA',
    createdAt: new Date(2026, 6, 10, 23, 59, 59, 999).toISOString(),
  },
  {
    id: 'txn-delta',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'inbound',
    counterparty: 'Café refunds',
    counterpartyAddress: 'GDESTINATIONDELTA',
    asset: 'AQUA',
    amount: -12.5,
    usdValue: -12.5,
    purpose: 'Refund adjustment',
    status: 'failed',
    riskScore: 40,
    createdAt: '2026-06-30T00:00:00.000Z',
  },
  {
    id: 'txn-epsilon',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-orion',
    agentName: 'Orion',
    direction: 'outbound',
    counterparty: 'Δοκιμή Labs',
    counterpartyAddress: 'GDESTINATIONEPSILON',
    asset: 'XLM',
    amount: 1000,
    usdValue: 120,
    memo: 'Δοκιμή — café',
    purpose: 'Ops',
    status: 'completed',
    riskScore: 1,
    createdAt: new Date(2026, 7, 1, 12).toISOString(),
  },
];

const edgeCatalog: Transaction[] = [...records, ...edgeRecords];

/** Text fields in this fixture are digit-free so amount searches are unambiguous. */
const amountRecords: Transaction[] = [
  {
    id: 'txn-zero',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Zero vendor',
    counterpartyAddress: 'GZERO',
    asset: 'USDC',
    amount: 0,
    usdValue: 0,
    purpose: 'Zero adjustment',
    status: 'completed',
    riskScore: 0,
    createdAt: '2026-07-10T08:00:00.000Z',
  },
  {
    id: 'txn-negative',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'inbound',
    counterparty: 'Reversal vendor',
    counterpartyAddress: 'GNEGATIVE',
    asset: 'USDC',
    amount: -12.5,
    usdValue: -12.5,
    purpose: 'Reversal',
    status: 'completed',
    riskScore: 0,
    createdAt: '2026-07-10T09:00:00.000Z',
  },
  {
    id: 'txn-ceiling',
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-orion',
    agentName: 'Orion',
    direction: 'outbound',
    counterparty: 'Ceiling vendor',
    counterpartyAddress: 'GCEILING',
    asset: 'USDC',
    amount: 777777,
    usdValue: 777777,
    purpose: 'Ceiling payment',
    status: 'completed',
    riskScore: 0,
    createdAt: '2026-07-10T10:00:00.000Z',
  },
];

const noFilters: TransactionFilterValues = {
  query: '',
  status: 'all',
  asset: 'all',
  agentId: 'all',
  dateFrom: '',
  dateTo: '',
};

const ids = (transactions: Transaction[]) =>
  transactions.map((transaction) => transaction.id);

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

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('combines status, asset, agent, search, and date filters at once', () => {
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    status: 'completed',
    asset: 'XLM',
    agentId: 'agent-orion',
    query: 'ops',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-01',
  });

  assert.deepEqual(ids(filtered), ['txn-epsilon']);
});

test('a single mismatching filter removes an otherwise matching transaction', () => {
  const matching = {
    ...noFilters,
    status: 'completed' as const,
    asset: 'XLM',
    agentId: 'agent-orion',
    query: 'ops',
  };

  assert.deepEqual(ids(filterTransactions(edgeCatalog, matching)), ['txn-epsilon']);
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...matching, asset: 'USDC' })),
    [],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...matching, status: 'approved' as const })),
    [],
  );
});

test('searches transaction identifiers and hashes case-insensitively', () => {
  const filtered = filterTransactions(records, { ...noFilters, query: 'STELLAR-HASH' });

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('matches memo text and hashes regardless of query casing', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'MONTHLY SERVICES' })),
    ['txn-alpha'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'invoice' })),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'stellar-hash-gamma' })),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'STELLAR-HASH-GAMMA' })),
    ['txn-gamma'],
  );
});

test('empty filters and an empty or whitespace-only query return every transaction', () => {
  assert.deepEqual(ids(filterTransactions(edgeCatalog, noFilters)), ids(edgeCatalog));
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: '' })),
    ids(edgeCatalog),
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: '   ' })),
    ids(edgeCatalog),
  );
});

test('an empty transaction list is always empty', () => {
  assert.deepEqual(filterTransactions([], noFilters), []);
  assert.deepEqual(filterTransactions([], { ...noFilters, query: 'anything' }), []);
  assert.deepEqual(
    filterTransactions([], {
      ...noFilters,
      dateFrom: '2026-07-10',
      dateTo: '2026-07-10',
    }),
    [],
  );
});

test('supports punctuation, partial matches, and unicode search terms', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: '#42' })),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: '"final"' })),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'inv' })),
    ['txn-gamma'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'δοκιμή' })),
    ['txn-epsilon'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, query: 'café' })),
    ['txn-delta', 'txn-epsilon'],
  );
});

test('returns an empty list when filters have no matches', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    query: 'does-not-exist',
  });

  assert.deepEqual(filtered, []);
});

test('no-match searches stay empty when combined with other filters', () => {
  assert.deepEqual(
    filterTransactions(edgeCatalog, {
      ...noFilters,
      status: 'completed',
      query: 'no-such-term',
    }),
    [],
  );
  assert.deepEqual(
    filterTransactions(edgeCatalog, {
      ...noFilters,
      query: 'a'.repeat(200),
    }),
    [],
  );
});

test('includes transactions on both selected date boundaries', () => {
  const filtered = filterTransactions(records, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(ids(filtered), ['txn-alpha']);
});

test('date boundaries include the first and last millisecond of the range', () => {
  // Build the edges from the local day so the test holds in every timezone.
  const dayStart = new Date(2026, 6, 10, 0, 0, 0, 0).toISOString();
  const dayEnd = new Date(2026, 6, 10, 23, 59, 59, 999).toISOString();
  const boundaryRecords = [
    makeTransaction({ id: 'day-start', createdAt: dayStart }),
    makeTransaction({ id: 'day-end', createdAt: dayEnd }),
    makeTransaction({
      id: 'before-day',
      createdAt: new Date(2026, 6, 9, 23, 59, 59, 999).toISOString(),
    }),
    makeTransaction({
      id: 'after-day',
      createdAt: new Date(2026, 6, 11, 0, 0, 0, 0).toISOString(),
    }),
  ];

  const filtered = filterTransactions(boundaryRecords, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  assert.deepEqual(ids(filtered), ['day-start', 'day-end']);
});

test('malformed dates are ignored instead of hiding every transaction', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, dateFrom: 'not-a-date' })),
    ids(edgeCatalog),
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, dateTo: '2026-13-45' })),
    ids(edgeCatalog),
  );
  assert.deepEqual(
    ids(
      filterTransactions(edgeCatalog, {
        ...noFilters,
        dateFrom: 'not-a-date',
        dateTo: 'also-not-a-date',
      }),
    ),
    ids(edgeCatalog),
  );
});

test('a reversed date range matches nothing', () => {
  assert.deepEqual(
    filterTransactions(edgeCatalog, {
      ...noFilters,
      dateFrom: '2026-08-01',
      dateTo: '2026-07-01',
    }),
    [],
  );
});

test('amount searches cover zero, exact values, and negatives', () => {
  // The filter has no numeric min/max inputs, so amount bounds are exercised
  // through the free-text projection of the amount field.
  assert.deepEqual(
    ids(filterTransactions(amountRecords, { ...noFilters, query: '0' })),
    ['txn-zero'],
  );
  assert.deepEqual(
    ids(filterTransactions(amountRecords, { ...noFilters, query: '777777' })),
    ['txn-ceiling'],
  );
  assert.deepEqual(
    ids(filterTransactions(amountRecords, { ...noFilters, query: '-12.5' })),
    ['txn-negative'],
  );
  assert.deepEqual(
    ids(filterTransactions(amountRecords, { ...noFilters, query: '12.5' })),
    ['txn-negative'],
  );
  assert.deepEqual(
    filterTransactions(amountRecords, { ...noFilters, query: '777778' }),
    [],
  );
});

test('filtering does not mutate the input collection or its records', () => {
  const snapshot = structuredClone(edgeCatalog);
  filterTransactions(edgeCatalog, {
    ...noFilters,
    status: 'completed',
    query: 'ops',
    dateFrom: '2026-07-01',
    dateTo: '2026-08-31',
  });

  assert.deepEqual(edgeCatalog, snapshot);
});

test('filters by an array of statuses', () => {
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    statuses: ['pending', 'failed'],
  });

  assert.deepEqual(ids(filtered), ['txn-beta', 'txn-delta']);
});

test('an empty statuses array applies no status restriction', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, statuses: [] })),
    ids(edgeCatalog),
  );
});

test('single status and multi-status filters combine with AND semantics', () => {
  assert.deepEqual(
    ids(
      filterTransactions(edgeCatalog, {
        ...noFilters,
        status: 'completed',
        statuses: ['completed', 'pending'],
      }),
    ),
    ['txn-alpha', 'txn-epsilon'],
  );
  assert.deepEqual(
    filterTransactions(edgeCatalog, {
      ...noFilters,
      status: 'completed',
      statuses: ['pending'],
    }),
    [],
  );
});

test('combines a multi-status filter with a date range', () => {
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    statuses: ['completed', 'pending'],
    dateFrom: '2026-07-10',
    dateTo: '2026-07-20',
  });

  assert.deepEqual(ids(filtered), ['txn-alpha', 'txn-beta']);
});

test('supports open-ended date ranges', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, dateFrom: '2026-07-20' })),
    ['txn-epsilon'],
  );
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, dateTo: '2026-07-01' })),
    ['txn-delta'],
  );
});

test('ignores impossible calendar dates such as February 31st', () => {
  assert.deepEqual(
    ids(filterTransactions(edgeCatalog, { ...noFilters, dateTo: '2026-02-31' })),
    ids(edgeCatalog),
  );
});

test('accepts full ISO timestamps as date boundaries', () => {
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    dateFrom: '2026-07-11T00:00:00.000Z',
    dateTo: '2026-07-11T23:59:59.999Z',
  });

  assert.deepEqual(ids(filtered), ['txn-beta']);
});

test('excludes transactions with unparseable timestamps only when a date range is set', () => {
  const broken: Transaction = { ...records[0], id: 'txn-broken', createdAt: 'garbage' };
  const withBroken = [...records, broken];

  assert.deepEqual(
    ids(filterTransactions(withBroken, { ...noFilters, dateFrom: '2026-07-01' })),
    ['txn-alpha', 'txn-beta'],
  );
  assert.ok(ids(filterTransactions(withBroken, noFilters)).includes('txn-broken'));
});

test('matches search queries case-insensitively alongside a multi-status filter', () => {
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    query: '  ATLAS ',
    statuses: ['approved', 'failed'],
  });

  assert.deepEqual(ids(filtered), ['txn-gamma', 'txn-delta']);
});

test('accepts a readonly transaction list and statuses without mutating them', () => {
  const statuses = ['pending'] as const;
  const input: readonly Transaction[] = Object.freeze([...records]);

  assert.deepEqual(ids(filterTransactions(input, { ...noFilters, statuses })), [
    'txn-beta',
  ]);
  assert.deepEqual(ids([...input]), ['txn-alpha', 'txn-beta']);
});

test('parseDateBoundary snaps date-only values to day edges', () => {
  assert.equal(
    parseDateBoundary('2026-07-10', 'start'),
    new Date(2026, 6, 10, 0, 0, 0, 0).getTime(),
  );
  assert.equal(
    parseDateBoundary('2026-07-10', 'end'),
    new Date(2026, 6, 10, 23, 59, 59, 999).getTime(),
  );
  assert.equal(parseDateBoundary('', 'start'), null);
  assert.equal(parseDateBoundary('   ', 'end'), null);
  assert.equal(parseDateBoundary(undefined, 'start'), null);
  assert.equal(parseDateBoundary('2026-13-01', 'start'), null);
  assert.equal(parseDateBoundary('2026-02-31', 'end'), null);
  assert.equal(parseDateBoundary('not-a-date', 'start'), null);
});

test('resolveDateRange returns null bounds for unset or invalid input', () => {
  assert.deepEqual(resolveDateRange('', ''), { from: null, to: null });
  assert.deepEqual(resolveDateRange('nope', '2026-02-30'), { from: null, to: null });
});

test('last-24h preset includes its lower boundary and now, but excludes older and future rows', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['last-24h'] },
    NOW,
  );

  assert.deepEqual(ids(filtered), [
    'at-boundary',
    'at-now',
    'pending-high-value',
    'just-below-high-value',
  ]);
});

test('pending-approvals preset selects only pending transactions', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['pending-approvals'] },
    NOW,
  );

  assert.deepEqual(ids(filtered), ['pending-high-value', 'just-below-high-value']);
});

test('high-value preset uses the USD threshold inclusively', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['high-value'] },
    NOW,
  );

  assert.deepEqual(ids(filtered), ['pending-high-value']);
});

test('multiple presets combine with AND semantics', () => {
  const filtered = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['last-24h', 'pending-approvals', 'high-value'] },
    NOW,
  );

  assert.deepEqual(ids(filtered), ['pending-high-value']);
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

  assert.deepEqual(ids(filtered), ['pending-high-value']);

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

  assert.deepEqual(ids(queryFiltered), ['just-below-high-value']);
});

test('empty preset lists behave like no presets', () => {
  assert.deepEqual(
    ids(filterTransactions(presetRecords, { ...noFilters, presets: [] }, NOW)),
    ids(presetRecords),
  );
});

test('matchesTransactionPreset is pure and returns false for invalid timestamps', () => {
  const broken = makeTransaction({ id: 'broken', createdAt: 'not-a-date' });

  assert.equal(matchesTransactionPreset(broken, 'last-24h', NOW), false);
  assert.equal(matchesTransactionPreset(broken, 'pending-approvals', NOW), false);
  assert.deepEqual(ids(presetRecords), [
    'at-boundary',
    'just-outside',
    'at-now',
    'future',
    'pending-high-value',
    'just-below-high-value',
  ]);
});

test('preset filtering does not mutate the input array or its transactions', () => {
  const snapshot = structuredClone(presetRecords);
  const result = filterTransactions(
    presetRecords,
    { ...noFilters, presets: ['pending-approvals'] },
    NOW,
  );

  assert.notEqual(result, presetRecords);
  assert.deepEqual(presetRecords, snapshot);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Transaction } from '@/types/domain';
import {
  EMPTY_TRANSACTION_FILTERS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_OUTCOMES,
  countActiveTransactionFilters,
  filterTransactions,
  fromStatusSelectValue,
  getTransactionStatusOutcome,
  isReversedDateRange,
  parseDateBoundary,
  parseTransactionFilterParams,
  resolveDateRange,
  toStatusSelectValue,
  writeTransactionFilterParams,
  type TransactionFilterOptions,
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
    createdAt: '2026-07-10T23:59:59.999Z',
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
    createdAt: '2026-08-01T00:00:00.000Z',
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
  const filtered = filterTransactions(edgeCatalog, {
    ...noFilters,
    dateFrom: '2026-07-10',
    dateTo: '2026-07-10',
  });

  // `txn-gamma` is timestamped at 23:59:59.999Z and must stay inside the day.
  assert.deepEqual(ids(filtered), ['txn-alpha', 'txn-gamma']);
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

// ---------------------------------------------------------------------------
// #531 — multi-criteria search and defensive input handling
// ---------------------------------------------------------------------------

/** Local-time ISO timestamp, so date-boundary tests hold in every time zone. */
function localIso(
  year: number,
  month: number,
  day: number,
  hours = 12,
  minutes = 0,
  seconds = 0,
  ms = 0,
): string {
  return new Date(year, month - 1, day, hours, minutes, seconds, ms).toISOString();
}

function makeTransaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    organizationId: 'org-test',
    walletId: 'wallet-test',
    agentId: 'agent-atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Vendor',
    counterpartyAddress: 'GVENDOR',
    asset: 'USDC',
    amount: 10,
    usdValue: 10,
    purpose: 'Payment',
    status: 'completed',
    riskScore: 1,
    createdAt: localIso(2026, 8, 15),
    ...overrides,
  };
}

const ledger: Transaction[] = [
  makeTransaction({
    id: 'tx-usdc-ok',
    asset: 'USDC',
    status: 'completed',
    memo: 'Invoice #42 for Cloud Hosting',
    createdAt: localIso(2026, 8, 1, 0, 0, 0, 0),
  }),
  makeTransaction({
    id: 'tx-usdc-failed',
    asset: 'USDC',
    status: 'failed',
    memo: 'cloud hosting retry',
    createdAt: localIso(2026, 8, 10),
  }),
  makeTransaction({
    id: 'tx-xlm-failed',
    asset: 'XLM',
    status: 'failed',
    memo: 'Cloud hosting (XLM)',
    createdAt: localIso(2026, 8, 12),
  }),
  makeTransaction({
    id: 'tx-usdc-rejected',
    asset: 'USDC',
    status: 'rejected',
    memo: 'Office snacks',
    createdAt: localIso(2026, 8, 20),
  }),
  makeTransaction({
    id: 'tx-xlm-pending',
    asset: 'XLM',
    status: 'pending',
    memo: undefined,
    createdAt: localIso(2026, 8, 31, 23, 59, 59, 999),
  }),
  makeTransaction({
    id: 'tx-eurc-submitting',
    asset: 'EURC',
    status: 'submitting',
    memo: 'CLOUD HOSTING EU',
    createdAt: localIso(2026, 9, 1, 0, 0, 0, 0),
  }),
];

test('filters by asset code', () => {
  assert.deepEqual(ids(filterTransactions(ledger, { asset: 'XLM' })), [
    'tx-xlm-failed',
    'tx-xlm-pending',
  ]);
});

test('filters by exact status', () => {
  assert.deepEqual(ids(filterTransactions(ledger, { status: 'failed' })), [
    'tx-usdc-failed',
    'tx-xlm-failed',
  ]);
});

test('filters by outcome bucket (success / pending / failed)', () => {
  assert.deepEqual(ids(filterTransactions(ledger, { outcome: 'success' })), ['tx-usdc-ok']);
  assert.deepEqual(ids(filterTransactions(ledger, { outcome: 'pending' })), [
    'tx-xlm-pending',
    'tx-eurc-submitting',
  ]);
  assert.deepEqual(ids(filterTransactions(ledger, { outcome: 'failed' })), [
    'tx-usdc-failed',
    'tx-xlm-failed',
    'tx-usdc-rejected',
  ]);
});

test('outcome and exact status must both match when both are set', () => {
  assert.deepEqual(
    ids(filterTransactions(ledger, { outcome: 'failed', status: 'rejected' })),
    ['tx-usdc-rejected'],
  );
  assert.deepEqual(filterTransactions(ledger, { outcome: 'success', status: 'failed' }), []);
});

test('every status belongs to exactly one outcome bucket', () => {
  const all = Object.values(TRANSACTION_STATUS_OUTCOMES).flat();
  assert.equal(all.length, TRANSACTION_STATUSES.length);
  assert.deepEqual([...new Set(all)].sort(), [...TRANSACTION_STATUSES].sort());
});

test('searches memos case-insensitively and ignores surrounding whitespace', () => {
  assert.deepEqual(ids(filterTransactions(ledger, { query: '  CLOUD hosting ' })), [
    'tx-usdc-ok',
    'tx-usdc-failed',
    'tx-xlm-failed',
    'tx-eurc-submitting',
  ]);
  assert.deepEqual(ids(filterTransactions(ledger, { query: 'invoice #42' })), ['tx-usdc-ok']);
});

test('search tolerates transactions without a memo or optional fields', () => {
  const sparse = makeTransaction({
    id: 'tx-sparse',
    memo: undefined,
    agentId: undefined,
    agentName: undefined,
    stellarHash: undefined,
  });
  assert.deepEqual(ids(filterTransactions([sparse], { query: 'payment' })), ['tx-sparse']);
  assert.deepEqual(filterTransactions([sparse], { query: 'undefined' }), []);
});

test('combines asset, status and search criteria', () => {
  assert.deepEqual(
    ids(filterTransactions(ledger, { asset: 'USDC', status: 'failed', query: 'cloud' })),
    ['tx-usdc-failed'],
  );
  assert.deepEqual(
    ids(filterTransactions(ledger, { asset: 'USDC', outcome: 'failed', query: 'snacks' })),
    ['tx-usdc-rejected'],
  );
});

test('combines asset, outcome, search and date range criteria', () => {
  assert.deepEqual(
    ids(
      filterTransactions(ledger, {
        asset: 'XLM',
        outcome: 'failed',
        query: 'cloud',
        dateFrom: '2026-08-11',
        dateTo: '2026-08-12',
      }),
    ),
    ['tx-xlm-failed'],
  );
  assert.deepEqual(
    filterTransactions(ledger, {
      asset: 'XLM',
      outcome: 'failed',
      query: 'cloud',
      dateFrom: '2026-08-13',
    }),
    [],
  );
});

test('includes transactions exactly on the start and end instants of the range', () => {
  // 2026-08-01 00:00:00.000 and 2026-08-31 23:59:59.999 local time are both kept;
  // 2026-09-01 00:00:00.000 is one millisecond past the end and is dropped.
  assert.deepEqual(
    ids(filterTransactions(ledger, { dateFrom: '2026-08-01', dateTo: '2026-08-31' })),
    ['tx-usdc-ok', 'tx-usdc-failed', 'tx-xlm-failed', 'tx-usdc-rejected', 'tx-xlm-pending'],
  );
});

test('drops transactions one millisecond outside either boundary', () => {
  const edges = [
    makeTransaction({ id: 'before', createdAt: localIso(2026, 7, 31, 23, 59, 59, 999) }),
    makeTransaction({ id: 'start', createdAt: localIso(2026, 8, 1, 0, 0, 0, 0) }),
    makeTransaction({ id: 'end', createdAt: localIso(2026, 8, 1, 23, 59, 59, 999) }),
    makeTransaction({ id: 'after', createdAt: localIso(2026, 8, 2, 0, 0, 0, 0) }),
  ];
  assert.deepEqual(
    ids(filterTransactions(edges, { dateFrom: '2026-08-01', dateTo: '2026-08-01' })),
    ['start', 'end'],
  );
});

test('supports open-ended date ranges', () => {
  assert.deepEqual(ids(filterTransactions(ledger, { dateFrom: '2026-08-20' })), [
    'tx-usdc-rejected',
    'tx-xlm-pending',
    'tx-eurc-submitting',
  ]);
  assert.deepEqual(ids(filterTransactions(ledger, { dateTo: '2026-08-01' })), ['tx-usdc-ok']);
});

test('a reversed date range matches nothing and is detectable for the UI', () => {
  assert.deepEqual(filterTransactions(ledger, { dateFrom: '2026-08-12', dateTo: '2026-08-10' }), []);
  assert.equal(isReversedDateRange('2026-08-12', '2026-08-10'), true);
  assert.equal(isReversedDateRange('2026-08-10', '2026-08-12'), false);
  assert.equal(isReversedDateRange('2026-08-10', '2026-08-10'), false);
  assert.equal(isReversedDateRange('2026-08-12', 'garbage'), false);
});

test('ignores invalid or incomplete date inputs instead of hiding everything', () => {
  for (const bad of ['yesterday', '2026-02-30', '2026-13-01', '   ', 'not-a-date']) {
    assert.equal(
      filterTransactions(ledger, { dateFrom: bad, dateTo: bad }).length,
      ledger.length,
      `"${bad}" should be ignored`,
    );
  }
  // A valid bound still applies when the other one is malformed.
  assert.deepEqual(ids(filterTransactions(ledger, { dateFrom: 'nope', dateTo: '2026-08-01' })), [
    'tx-usdc-ok',
  ]);
});

test('excludes transactions with an unparseable timestamp only while a date bound is active', () => {
  const broken = makeTransaction({ id: 'tx-broken-date', createdAt: 'not-a-date' });
  assert.deepEqual(ids(filterTransactions([broken], {})), ['tx-broken-date']);
  assert.deepEqual(filterTransactions([broken], { dateFrom: '2026-01-01' }), []);
});

test('handles empty datasets', () => {
  assert.deepEqual(filterTransactions([], { asset: 'USDC', query: 'x' }), []);
  assert.deepEqual(filterTransactions(null, noFilters), []);
  assert.deepEqual(filterTransactions(undefined), []);
});

test('treats missing, null and undefined optional filters as no constraint', () => {
  assert.equal(filterTransactions(ledger).length, ledger.length);
  assert.equal(filterTransactions(ledger, null).length, ledger.length);
  assert.equal(filterTransactions(ledger, {}).length, ledger.length);
  assert.equal(
    filterTransactions(ledger, {
      query: null,
      outcome: null,
      status: undefined,
      asset: null,
      agentId: undefined,
      dateFrom: null,
      dateTo: undefined,
    }).length,
    ledger.length,
  );
  assert.deepEqual(ids(filterTransactions(ledger, { asset: 'EURC', status: null })), [
    'tx-eurc-submitting',
  ]);
});

test('preserves the full list in order when no filters are active', () => {
  const result = filterTransactions(ledger, noFilters);
  assert.deepEqual(ids(result), ids(ledger));
  assert.notEqual(result, ledger, 'returns a new array');
});

test('ignores unrecognised status and outcome values', () => {
  const loose = { status: 'bogus', outcome: 'later' } as unknown as TransactionFilterOptions;
  assert.equal(filterTransactions(ledger, loose).length, ledger.length);
});

test('outcome combines with the multi-status filter using AND semantics', () => {
  assert.deepEqual(
    ids(filterTransactions(ledger, { outcome: 'failed', statuses: ['failed', 'pending'] })),
    ['tx-usdc-failed', 'tx-xlm-failed'],
  );
  assert.deepEqual(filterTransactions(ledger, { outcome: 'success', statuses: ['pending'] }), []);
  assert.equal(countActiveTransactionFilters({ statuses: ['pending'] }), 1);
  assert.equal(countActiveTransactionFilters({ statuses: [] }), 0);
});

test('maps transaction statuses to outcome buckets', () => {
  assert.equal(getTransactionStatusOutcome('confirmed'), 'success');
  assert.equal(getTransactionStatusOutcome('submitting'), 'pending');
  assert.equal(getTransactionStatusOutcome('expired'), 'failed');
});

test('parseDateBoundary handles leap days and null input', () => {
  assert.equal(parseDateBoundary('2024-02-29', 'start'), new Date(2024, 1, 29).getTime());
  assert.equal(parseDateBoundary('2026-02-29', 'start'), null);
  assert.equal(parseDateBoundary(null, 'start'), null);
  assert.equal(parseDateBoundary('', 'end'), null);
});

// ---------------------------------------------------------------------------
// #523 — filter-bar state helpers used by the dashboard
// ---------------------------------------------------------------------------

test('counts active filter criteria', () => {
  assert.equal(countActiveTransactionFilters(EMPTY_TRANSACTION_FILTERS), 0);
  assert.equal(
    countActiveTransactionFilters({
      ...EMPTY_TRANSACTION_FILTERS,
      query: 'cloud',
      outcome: 'failed',
      asset: 'USDC',
      dateFrom: '2026-08-01',
      dateTo: 'garbage',
    }),
    4,
  );
});

test('status select values round-trip outcome and exact status without colliding', () => {
  assert.equal(toStatusSelectValue(EMPTY_TRANSACTION_FILTERS), 'all');
  assert.deepEqual(fromStatusSelectValue('outcome:pending'), { outcome: 'pending', status: 'all' });
  assert.deepEqual(fromStatusSelectValue('status:pending'), { outcome: 'all', status: 'pending' });
  assert.deepEqual(fromStatusSelectValue('all'), { outcome: 'all', status: 'all' });
  assert.deepEqual(fromStatusSelectValue('outcome:nope'), { outcome: 'all', status: 'all' });
  for (const value of ['outcome:failed', 'status:rejected', 'all'] as const) {
    assert.equal(toStatusSelectValue(fromStatusSelectValue(value)), value);
  }
});

test('URL params round-trip and drop defaults and invalid values', () => {
  const filters: TransactionFilterValues = {
    query: ' cloud ',
    outcome: 'failed',
    status: 'all',
    asset: 'USDC',
    agentId: 'all',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
  };
  const params = writeTransactionFilterParams(new URLSearchParams('tab=history&agent=x'), filters);
  assert.equal(
    params.toString(),
    'tab=history&q=cloud&outcome=failed&asset=USDC&from=2026-08-01&to=2026-08-31',
  );
  assert.deepEqual(parseTransactionFilterParams(params), { ...filters, query: 'cloud' });

  const hostile = new URLSearchParams('status=bogus&outcome=soon&from=2026-02-30&asset=%20');
  assert.deepEqual(parseTransactionFilterParams(hostile), EMPTY_TRANSACTION_FILTERS);
});

test('dashboard filter state and clearing it restores the full list', () => {
  const active: TransactionFilterValues = {
    ...EMPTY_TRANSACTION_FILTERS,
    asset: 'USDC',
    ...fromStatusSelectValue('outcome:failed'),
    dateFrom: '2026-08-01',
    dateTo: '2026-08-15',
  };
  assert.deepEqual(ids(filterTransactions(ledger, active)), ['tx-usdc-failed']);
  assert.deepEqual(ids(filterTransactions(ledger, EMPTY_TRANSACTION_FILTERS)), ids(ledger));
});

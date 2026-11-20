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
  parseFilterDate,
  parseTransactionFilterParams,
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

const noFilters: TransactionFilterValues = {
  query: '',
  outcome: 'all',
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

const ids = (transactions: Transaction[]) => transactions.map((transaction) => transaction.id);

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

test('treats an inverted date range as the same span', () => {
  assert.deepEqual(
    filterTransactions(ledger, { dateFrom: '2026-08-12', dateTo: '2026-08-10' }),
    filterTransactions(ledger, { dateFrom: '2026-08-10', dateTo: '2026-08-12' }),
  );
  assert.deepEqual(
    ids(filterTransactions(ledger, { dateFrom: '2026-08-12', dateTo: '2026-08-10' })),
    ['tx-usdc-failed', 'tx-xlm-failed'],
  );
});

test('ignores invalid or incomplete date inputs instead of hiding everything', () => {
  for (const bad of ['2026-08', '2026-8-1', 'yesterday', '2026-02-30', '2026-13-01', '   ']) {
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

test('maps transaction statuses to outcome buckets', () => {
  assert.equal(getTransactionStatusOutcome('confirmed'), 'success');
  assert.equal(getTransactionStatusOutcome('submitting'), 'pending');
  assert.equal(getTransactionStatusOutcome('expired'), 'failed');
});

test('parseFilterDate returns local day boundaries and rejects impossible dates', () => {
  assert.equal(parseFilterDate('2026-08-01', 'start'), new Date(2026, 7, 1).getTime());
  assert.equal(
    parseFilterDate('2026-08-01', 'end'),
    new Date(2026, 7, 1, 23, 59, 59, 999).getTime(),
  );
  assert.equal(parseFilterDate('2024-02-29', 'start'), new Date(2024, 1, 29).getTime());
  assert.equal(parseFilterDate('2026-02-29', 'start'), null);
  assert.equal(parseFilterDate(null, 'start'), null);
  assert.equal(parseFilterDate('', 'end'), null);
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

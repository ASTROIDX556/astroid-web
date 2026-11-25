import assert from 'node:assert/strict';
import test from 'node:test';

import type { Transaction } from '../../types/domain';
import {
  collectTransactionAgentOptions,
  countActiveTransactionFilters,
  DEFAULT_TRANSACTION_FILTERS,
  filterTransactions,
  matchesTransactionFilters,
  transactionStatusCategory,
  type TransactionFilters,
} from './transactionFilters';

const NOW = Date.parse('2026-08-01T12:00:00.000Z');

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn_test',
    organizationId: 'org_test',
    walletId: 'wal_test',
    agentId: 'agt_atlas',
    agentName: 'Atlas',
    direction: 'outbound',
    counterparty: 'Vendor',
    counterpartyAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    asset: 'USDC',
    amount: 1_000,
    usdValue: 1_000,
    purpose: 'Test payment',
    status: 'completed',
    riskScore: 10,
    createdAt: '2026-07-31T12:00:00.000Z',
    ...overrides,
  };
}

function filters(overrides: Partial<TransactionFilters> = {}): TransactionFilters {
  return { ...DEFAULT_TRANSACTION_FILTERS, ...overrides };
}

test('raw transaction statuses map to success, pending and failed buckets', () => {
  assert.equal(transactionStatusCategory('completed'), 'success');
  assert.equal(transactionStatusCategory('confirmed'), 'success');
  assert.equal(transactionStatusCategory('pending'), 'pending');
  assert.equal(transactionStatusCategory('submitting'), 'pending');
  assert.equal(transactionStatusCategory('failed'), 'failed');
  assert.equal(transactionStatusCategory('cancelled'), 'failed');
  assert.equal(transactionStatusCategory('expired'), 'failed');
});

test('status filter accepts the requested success, pending and failed values', () => {
  const rows = [
    transaction({ id: 'success', status: 'completed' }),
    transaction({ id: 'pending', status: 'pending' }),
    transaction({ id: 'failed', status: 'failed' }),
  ];

  assert.deepEqual(
    filterTransactions(rows, filters({ status: 'success' }), NOW).map((row) => row.id),
    ['success'],
  );
  assert.deepEqual(
    filterTransactions(rows, filters({ status: 'pending' }), NOW).map((row) => row.id),
    ['pending'],
  );
  assert.deepEqual(
    filterTransactions(rows, filters({ status: 'failed' }), NOW).map((row) => row.id),
    ['failed'],
  );
});

test('agent filtering works by id and name', () => {
  const row = transaction();
  assert.equal(
    matchesTransactionFilters(row, filters({ agent: 'agt_atlas' }), NOW),
    true,
  );
  assert.equal(matchesTransactionFilters(row, filters({ agent: 'Atlas' }), NOW), true);
  assert.equal(
    matchesTransactionFilters(row, filters({ agent: 'agt_orion' }), NOW),
    false,
  );
});

test('asset and date range filters narrow the result set', () => {
  const rows = [
    transaction({ id: 'recent', createdAt: '2026-07-31T12:00:00.000Z' }),
    transaction({
      id: 'old',
      createdAt: '2026-05-01T12:00:00.000Z',
      asset: 'XLM',
    }),
  ];

  assert.deepEqual(
    filterTransactions(rows, filters({ asset: 'XLM' }), NOW).map((row) => row.id),
    ['old'],
  );
  assert.deepEqual(
    filterTransactions(rows, filters({ dateRange: '7d' }), NOW).map((row) => row.id),
    ['recent'],
  );
});

test('agent options fall back to the name when no id is present', () => {
  assert.deepEqual(
    collectTransactionAgentOptions([
      transaction(),
      transaction({ id: 'second', agentId: undefined, agentName: 'Kepler' }),
      transaction({ id: 'duplicate' }),
    ]),
    [
      { value: 'agt_atlas', label: 'Atlas' },
      { value: 'Kepler', label: 'Kepler' },
    ],
  );
});

test('active filter count ignores the all-* defaults', () => {
  assert.equal(countActiveTransactionFilters(DEFAULT_TRANSACTION_FILTERS), 0);
  assert.equal(
    countActiveTransactionFilters(
      filters({ status: 'failed', agent: 'agt_atlas', dateRange: '30d' }),
    ),
    3,
  );
});

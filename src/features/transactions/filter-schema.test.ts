import assert from 'node:assert/strict';
import test from 'node:test';
import type { TransactionFilterValues } from './filterTransactions';
import {
  DEFAULT_TRANSACTION_FILTER_VALUES,
  TRANSACTION_FILTER_STORAGE_KEY,
  clearStoredTransactionFilters,
  loadTransactionFilters,
  parseStoredTransactionFilters,
  readStoredTransactionFilters,
  saveTransactionFilters,
  transactionFilterSchema,
  type TransactionFilterStorage,
} from './filter-schema';

class MemoryStorage implements TransactionFilterStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

class ThrowingStorage implements TransactionFilterStorage {
  getItem(): string | null {
    throw new Error('localStorage is blocked');
  }

  setItem(): void {
    throw new Error('quota exceeded');
  }

  removeItem(): void {
    throw new Error('localStorage is blocked');
  }
}

const sampleFilters: TransactionFilterValues = {
  query: 'stellar',
  status: 'completed',
  asset: 'USDC',
  agentId: 'agent-atlas',
  dateFrom: '2026-01-01',
  dateTo: '2026-01-31',
};

test('schema accepts a complete filter snapshot', () => {
  const result = transactionFilterSchema.safeParse(sampleFilters);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data, sampleFilters);
});

test('schema is strict and rejects unknown or renamed keys', () => {
  const result = transactionFilterSchema.safeParse({
    ...sampleFilters,
    agent: 'agent-atlas',
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.code === 'unrecognized_keys'));
  }
});

test('schema rejects invalid statuses, impossible dates and reversed ranges', () => {
  assert.equal(
    transactionFilterSchema.safeParse({ ...sampleFilters, status: 'bogus' }).success,
    false,
  );
  assert.equal(
    transactionFilterSchema.safeParse({ ...sampleFilters, dateFrom: '2026-02-30' })
      .success,
    false,
  );
  assert.equal(
    transactionFilterSchema.safeParse({
      ...sampleFilters,
      dateFrom: '2026-03-01',
      dateTo: '2026-02-01',
    }).success,
    false,
  );
});

test('parser returns null for empty, corrupt or schema-invalid payloads', () => {
  assert.equal(parseStoredTransactionFilters(null), null);
  assert.equal(parseStoredTransactionFilters('{not json'), null);
  assert.equal(parseStoredTransactionFilters('"a string"'), null);
  assert.equal(parseStoredTransactionFilters('[]'), null);
  assert.equal(
    parseStoredTransactionFilters(JSON.stringify({ ...sampleFilters, status: 7 })),
    null,
  );
  assert.deepEqual(
    parseStoredTransactionFilters(JSON.stringify(sampleFilters)),
    sampleFilters,
  );
});

test('corrupted JSON in storage falls back to defaults and is removed', () => {
  const storage = new MemoryStorage();
  storage.setItem(TRANSACTION_FILTER_STORAGE_KEY, '{"query":"half written"');

  assert.deepEqual(loadTransactionFilters(DEFAULT_TRANSACTION_FILTER_VALUES, storage), {
    ...DEFAULT_TRANSACTION_FILTER_VALUES,
  });
  assert.equal(storage.getItem(TRANSACTION_FILTER_STORAGE_KEY), null);
});

test('valid JSON with an invalid schema also falls back to defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem(
    TRANSACTION_FILTER_STORAGE_KEY,
    JSON.stringify({ ...sampleFilters, status: 'archived' }),
  );

  const restored = loadTransactionFilters(DEFAULT_TRANSACTION_FILTER_VALUES, storage);
  assert.deepEqual(restored, { ...DEFAULT_TRANSACTION_FILTER_VALUES });
  assert.equal(storage.getItem(TRANSACTION_FILTER_STORAGE_KEY), null);
});

test('writes and reads back a validated filter snapshot', () => {
  const storage = new MemoryStorage();
  saveTransactionFilters(sampleFilters, storage);

  assert.equal(
    storage.getItem(TRANSACTION_FILTER_STORAGE_KEY)?.includes('agentId'),
    true,
  );
  assert.deepEqual(readStoredTransactionFilters(storage), sampleFilters);
  assert.deepEqual(
    loadTransactionFilters(DEFAULT_TRANSACTION_FILTER_VALUES, storage),
    sampleFilters,
  );
});

test('malformed state is never persisted', () => {
  const storage = new MemoryStorage();
  saveTransactionFilters(
    { ...sampleFilters, status: 'nope' } as unknown as TransactionFilterValues,
    storage,
  );
  assert.equal(storage.getItem(TRANSACTION_FILTER_STORAGE_KEY), null);
});

test('throwing storage never propagates an error', () => {
  const storage = new ThrowingStorage();
  assert.doesNotThrow(() => readStoredTransactionFilters(storage));
  assert.equal(readStoredTransactionFilters(storage), null);
  assert.doesNotThrow(() => saveTransactionFilters(sampleFilters, storage));
  assert.doesNotThrow(() => clearStoredTransactionFilters(storage));
});

test('missing storage and missing window use the supplied fallback', () => {
  assert.equal(readStoredTransactionFilters(null), null);
  assert.deepEqual(loadTransactionFilters(sampleFilters, null), sampleFilters);
  assert.equal(typeof window, 'undefined');
  assert.deepEqual(loadTransactionFilters(), { ...DEFAULT_TRANSACTION_FILTER_VALUES });
});

test('clear removes only the namespaced key', () => {
  const storage = new MemoryStorage();
  storage.setItem('unrelated:key', 'keep me');
  saveTransactionFilters(sampleFilters, storage);
  clearStoredTransactionFilters(storage);

  assert.equal(storage.getItem(TRANSACTION_FILTER_STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated:key'), 'keep me');
});

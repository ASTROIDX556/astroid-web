import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchStellarHealth } from './useStellarHealth';
import type { NetworkHealthData } from '@/features/network/types';

test('fetchStellarHealth returns valid mock data in mock mode', async () => {
  const data = await fetchStellarHealth();

  assert.ok(data);
  assert.ok(['healthy', 'degraded', 'outage'].includes(data.status));
  assert.ok(Number.isFinite(data.ledgerSequence));
  assert.ok(data.ledgerSequence > 0);
  assert.ok(Number.isFinite(data.rpcLatencyMs));
  assert.ok(data.rpcLatencyMs >= 0);
  assert.strictEqual(data.networkName, 'Stellar Testnet');
  assert.ok(['operational', 'degraded', 'down'].includes(data.sorobanStatus));
  assert.ok(['operational', 'degraded', 'down'].includes(data.horizonStatus));
  assert.ok(new Date(data.lastCheckedAt).getTime() > 0);
});

test('fetchStellarHealth returns consistent NetworkHealthData shape', async () => {
  const data = await fetchStellarHealth();

  const keys: (keyof NetworkHealthData)[] = [
    'status',
    'ledgerSequence',
    'rpcLatencyMs',
    'sorobanStatus',
    'horizonStatus',
    'networkName',
    'lastCheckedAt',
  ];

  for (const key of keys) {
    assert.ok(key in data, `Missing key: ${key}`);
  }
});

test('fetchStellarHealth maps high latency to degraded or outage status', async () => {
  // Run multiple times to exercise the random latency range
  for (let i = 0; i < 50; i++) {
    const data = await fetchStellarHealth();
    if (data.rpcLatencyMs > 600) {
      assert.strictEqual(data.status, 'outage');
    } else if (data.rpcLatencyMs > 300) {
      assert.strictEqual(data.status, 'degraded');
    }
  }
});

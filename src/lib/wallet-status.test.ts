import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveWalletStatus } from './wallet-status';

const KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

test('a shared connection shows as connected whatever this widget last saw', () => {
  for (const local of ['idle', 'checking', 'missing', 'error', 'connected'] as const) {
    assert.equal(deriveWalletStatus(local, 'connected', KEY), 'connected', local);
  }
});

test('a widget does not keep reporting connected once the shared store disconnects', () => {
  assert.equal(deriveWalletStatus('connected', 'disconnected', null), 'idle');
  assert.equal(deriveWalletStatus('connected', 'connecting', null), 'idle');
});

test('shared "connected" without an account is not a usable connection', () => {
  assert.equal(deriveWalletStatus('idle', 'connected', null), 'idle');
  assert.equal(deriveWalletStatus('connected', 'connected', null), 'idle');
});

test('transient local states are preserved while nothing is connected', () => {
  assert.equal(deriveWalletStatus('checking', 'disconnected', null), 'checking');
  assert.equal(deriveWalletStatus('missing', 'disconnected', null), 'missing');
  assert.equal(deriveWalletStatus('error', 'disconnected', null), 'error');
  assert.equal(deriveWalletStatus('idle', 'disconnected', null), 'idle');
});

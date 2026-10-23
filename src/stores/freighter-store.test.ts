import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { useFreighterStore } from './freighter-store';

const KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const OTHER = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

beforeEach(() => {
  useFreighterStore.getState().disconnect();
});

test('adoptConnection marks the wallet connected for every subscriber', () => {
  const seen: string[] = [];
  const unsubscribe = useFreighterStore.subscribe((state) => {
    seen.push(`${state.status}:${state.publicKey}`);
  });

  useFreighterStore.getState().adoptConnection(KEY);
  unsubscribe();

  const state = useFreighterStore.getState();
  assert.equal(state.status, 'connected');
  assert.equal(state.publicKey, KEY);
  assert.equal(state.isInstalled, true);
  assert.equal(state.error, null);
  assert.deepEqual(seen, [`connected:${KEY}`]);
});

test('adoptConnection replaces the account when a different one is adopted', () => {
  useFreighterStore.getState().adoptConnection(KEY);
  useFreighterStore.getState().adoptConnection(OTHER);
  assert.equal(useFreighterStore.getState().publicKey, OTHER);
});

test('adopting the already-connected account does not notify subscribers again', () => {
  useFreighterStore.getState().adoptConnection(KEY);
  let notified = 0;
  const unsubscribe = useFreighterStore.subscribe(() => {
    notified += 1;
  });
  useFreighterStore.getState().adoptConnection(KEY);
  unsubscribe();
  assert.equal(notified, 0);
});

test('adoptConnection(null) clears the session like disconnect()', () => {
  useFreighterStore.getState().adoptConnection(KEY);
  useFreighterStore.setState({ network: 'testnet', networkPassphrase: 'Test SDF Network ; September 2015' });

  useFreighterStore.getState().adoptConnection(null);

  const state = useFreighterStore.getState();
  assert.equal(state.status, 'disconnected');
  assert.equal(state.publicKey, null);
  assert.equal(state.network, null);
  assert.equal(state.networkPassphrase, null);
});

test('adoptConnection refuses a malformed address instead of storing it', () => {
  useFreighterStore.getState().adoptConnection(KEY);
  for (const bad of ['', 'not-a-key', 'SBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H']) {
    useFreighterStore.getState().adoptConnection(bad);
    assert.equal(useFreighterStore.getState().status, 'disconnected', bad);
    assert.equal(useFreighterStore.getState().publicKey, null, bad);
    useFreighterStore.getState().adoptConnection(KEY);
  }
});

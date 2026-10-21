import assert from 'node:assert/strict';
import test from 'node:test';
import { useFreighterStore } from './freighter-store';

const validPublicKey = `G${'A'.repeat(55)}`;

test('updating the public key marks the wallet connected', () => {
  useFreighterStore.getState().disconnect();

  useFreighterStore.getState().updatePublicKey(validPublicKey);

  assert.equal(useFreighterStore.getState().status, 'connected');
  assert.equal(useFreighterStore.getState().publicKey, validPublicKey);
});

test('updating with an invalid public key is rejected without changing state', () => {
  useFreighterStore.getState().disconnect();

  assert.throws(() =>
    useFreighterStore.getState().updatePublicKey('not-a-stellar-key'),
  );
  assert.equal(useFreighterStore.getState().status, 'disconnected');
  assert.equal(useFreighterStore.getState().publicKey, null);
});

test('disconnect clears the key and active network', () => {
  useFreighterStore.getState().updatePublicKey(validPublicKey);
  useFreighterStore.setState({ network: 'testnet' });

  useFreighterStore.getState().disconnect();

  assert.equal(useFreighterStore.getState().status, 'disconnected');
  assert.equal(useFreighterStore.getState().publicKey, null);
  assert.equal(useFreighterStore.getState().network, null);
});

test('network switching while disconnected fails with a useful error', async () => {
  useFreighterStore.getState().disconnect();

  const switched = await useFreighterStore.getState().switchNetwork('mainnet');

  assert.equal(switched, false);
  assert.match(useFreighterStore.getState().error ?? '', /connect a freighter wallet/i);
});

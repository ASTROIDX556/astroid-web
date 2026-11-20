import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SIGNATURE_TIMEOUT_MS,
  trackSignatureRequest,
  useFreighterStore,
  type SignatureRequestStatus,
} from './freighter-store';

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

test('signature requests record requesting then signed lifecycle states', async () => {
  const statuses: SignatureRequestStatus[] = [];

  const result = await trackSignatureRequest(
    async () => 'signed-xdr',
    (status) => statuses.push(status),
  );

  assert.equal(result, 'signed-xdr');
  assert.deepEqual(statuses, ['requesting', 'signed']);
  assert.equal(DEFAULT_SIGNATURE_TIMEOUT_MS, 45_000);
});

test('user cancellation records rejected and rethrows the original error', async () => {
  const statuses: SignatureRequestStatus[] = [];
  const rejection = new Error('User rejected the signature request.');

  await assert.rejects(
    trackSignatureRequest(
      async () => {
        throw rejection;
      },
      (status) => statuses.push(status),
    ),
    (error) => error === rejection,
  );

  assert.deepEqual(statuses, ['requesting', 'rejected']);
});

test('signature timeout records timeout and does not retry the wallet prompt', async () => {
  const statuses: SignatureRequestStatus[] = [];
  let attempts = 0;

  await assert.rejects(
    trackSignatureRequest(
      () => {
        attempts += 1;
        return new Promise<string>(() => {});
      },
      (status) => statuses.push(status),
      10,
    ),
    /signature request timed out/i,
  );

  assert.equal(attempts, 1);
  assert.deepEqual(statuses, ['requesting', 'timeout']);
});

test('invalid signature timeouts fail before entering requesting state', async () => {
  const statuses: SignatureRequestStatus[] = [];

  await assert.rejects(
    trackSignatureRequest(
      async () => 'signed-xdr',
      (status) => statuses.push(status),
      0,
    ),
    /signature timeout must be an integer/i,
  );

  assert.deepEqual(statuses, []);
});

test('unexpected signing errors reset lifecycle to idle', async () => {
  const statuses: SignatureRequestStatus[] = [];

  await assert.rejects(
    trackSignatureRequest(
      async () => {
        throw new Error('Freighter is unavailable.');
      },
      (status) => statuses.push(status),
    ),
    /Freighter is unavailable/,
  );

  assert.deepEqual(statuses, ['requesting', 'idle']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __setFreighterLoader,
  classifyFreighterError,
  FreighterError,
  FREIGHTER_MAX_RETRIES,
  useFreighterStore,
} from './freighter-store';
import { getFreighterRecovery } from '../features/wallet/freighterErrorRecovery';

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

// ---------------------------------------------------------------------------
// Error classification and recovery (#508)
// ---------------------------------------------------------------------------

type MockFreighter = Parameters<typeof __setFreighterLoader>[0];

const resetStore = () => {
  __setFreighterLoader(null);
  useFreighterStore.getState().disconnect();
  useFreighterStore.setState({ isInstalled: false });
};

const healthyFreighter = (overrides: Record<string, unknown> = {}): MockFreighter =>
  async () => ({
    isConnected: async () => ({ isConnected: true }),
    setAllowed: async () => ({ isAllowed: true }),
    getAddress: async () => ({ address: validPublicKey }),
    getNetwork: async () => ({
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    }),
    ...overrides,
  });

test('classifyFreighterError maps raw failures to specific codes', () => {
  assert.equal(classifyFreighterError(new FreighterError('locked', 'x')), 'locked');
  assert.equal(classifyFreighterError(new Error('Request timed out')), 'timeout');
  assert.equal(classifyFreighterError(new Error('User declined access')), 'user_rejected');
  assert.equal(classifyFreighterError('The user rejected this request.'), 'user_rejected');
  assert.equal(classifyFreighterError({ message: 'Freighter is locked' }), 'locked');
  assert.equal(classifyFreighterError(new Error('Freighter extension not installed')), 'not_installed');
  assert.equal(classifyFreighterError(new Error('boom')), 'unknown');
  assert.equal(classifyFreighterError(undefined), 'unknown');
});

test('connect records not_installed when the extension cannot be loaded', async () => {
  resetStore();
  __setFreighterLoader(async () => {
    throw new Error('Cannot find module');
  });

  const result = await useFreighterStore.getState().connect();
  const state = useFreighterStore.getState();

  assert.equal(result, null);
  assert.equal(state.status, 'disconnected');
  assert.equal(state.errorCode, 'not_installed');
  assert.equal(state.isInstalled, false);
  assert.ok(state.error);
  resetStore();
});

test('connect records not_installed when Freighter reports no extension', async () => {
  resetStore();
  __setFreighterLoader(healthyFreighter({ isConnected: async () => ({ isConnected: false }) }));

  await useFreighterStore.getState().connect();

  assert.equal(useFreighterStore.getState().errorCode, 'not_installed');
  resetStore();
});

test('connect records user_rejected and keeps the extension marked installed', async () => {
  resetStore();
  __setFreighterLoader(healthyFreighter({ setAllowed: async () => ({ isAllowed: false }) }));

  const result = await useFreighterStore.getState().connect();
  const state = useFreighterStore.getState();

  assert.equal(result, null);
  assert.equal(state.status, 'disconnected');
  assert.equal(state.errorCode, 'user_rejected');
  assert.equal(state.isInstalled, true);
  resetStore();
});

test('connect surfaces Freighter { error } payloads as user_rejected', async () => {
  resetStore();
  __setFreighterLoader(
    healthyFreighter({ getAddress: async () => ({ address: '', error: 'The user rejected this request.' }) }),
  );

  await useFreighterStore.getState().connect();

  assert.equal(useFreighterStore.getState().errorCode, 'user_rejected');
  assert.match(useFreighterStore.getState().error ?? '', /rejected/i);
  resetStore();
});

test('connect records invalid_response for a malformed address', async () => {
  resetStore();
  __setFreighterLoader(healthyFreighter({ getAddress: async () => ({ address: 'nope' }) }));

  await useFreighterStore.getState().connect();

  assert.equal(useFreighterStore.getState().errorCode, 'invalid_response');
  resetStore();
});

test('connect records timeout without leaving the store stuck in connecting', async () => {
  resetStore();
  __setFreighterLoader(
    healthyFreighter({
      setAllowed: async () => {
        throw new FreighterError('timeout', 'Freighter wallet request timed out.');
      },
    }),
  );

  const result = await useFreighterStore.getState().connect();
  const state = useFreighterStore.getState();

  assert.equal(result, null);
  assert.equal(state.status, 'disconnected');
  assert.equal(state.errorCode, 'timeout');
  resetStore();
});

test('connect ignores a second call while one is already in flight', async () => {
  resetStore();
  let release: () => void = () => {};
  let allowedCalls = 0;
  __setFreighterLoader(
    healthyFreighter({
      setAllowed: () => {
        allowedCalls += 1;
        return new Promise((resolve) => {
          release = () => resolve({ isAllowed: true });
        });
      },
    }),
  );

  const first = useFreighterStore.getState().connect();
  // Let the first call reach the pending setAllowed prompt.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = await useFreighterStore.getState().connect();
  release();

  assert.equal(second, null);
  assert.equal(await first, validPublicKey);
  assert.equal(allowedCalls, 1);
  resetStore();
});

test('retryConnection counts attempts and recovers after a rejection', async () => {
  resetStore();
  let allow = false;
  __setFreighterLoader(healthyFreighter({ setAllowed: async () => ({ isAllowed: allow }) }));

  await useFreighterStore.getState().connect();
  assert.equal(useFreighterStore.getState().errorCode, 'user_rejected');

  await useFreighterStore.getState().retryConnection();
  assert.equal(useFreighterStore.getState().retryCount, 1);
  assert.equal(useFreighterStore.getState().errorCode, 'user_rejected');

  allow = true;
  const publicKey = await useFreighterStore.getState().retryConnection();
  const state = useFreighterStore.getState();

  assert.equal(publicKey, validPublicKey);
  assert.equal(state.status, 'connected');
  assert.equal(state.error, null);
  assert.equal(state.errorCode, null);
  assert.equal(state.retryCount, 0);
  resetStore();
});

test('a rejected signature keeps the session connected', async () => {
  resetStore();
  __setFreighterLoader(
    healthyFreighter({
      signTransaction: async () => {
        throw new Error('User declined to sign');
      },
    }),
  );
  await useFreighterStore.getState().connect();

  await assert.rejects(() => useFreighterStore.getState().requestSignature('AAAA'));
  const state = useFreighterStore.getState();

  assert.equal(state.status, 'connected');
  assert.equal(state.errorCode, 'user_rejected');
  resetStore();
});

test('clearError dismisses the error without touching the connection', async () => {
  resetStore();
  __setFreighterLoader(healthyFreighter({ setAllowed: async () => ({ isAllowed: false }) }));
  await useFreighterStore.getState().connect();

  useFreighterStore.getState().clearError();

  assert.equal(useFreighterStore.getState().error, null);
  assert.equal(useFreighterStore.getState().errorCode, null);
  assert.equal(useFreighterStore.getState().status, 'disconnected');
  resetStore();
});

test('hydrate classifies a locked wallet', async () => {
  resetStore();
  __setFreighterLoader(healthyFreighter({ getAddress: async () => ({ address: '' }) }));

  await useFreighterStore.getState().hydrate();

  assert.equal(useFreighterStore.getState().status, 'locked');
  assert.equal(useFreighterStore.getState().errorCode, 'locked');
  resetStore();
});

test('recovery copy offers a distinct action per error code', () => {
  assert.equal(getFreighterRecovery('not_installed').action, 'install');
  assert.equal(getFreighterRecovery('user_rejected').action, 'retry');
  assert.equal(getFreighterRecovery('timeout').action, 'retry');
  assert.equal(getFreighterRecovery('locked').action, 'unlock_and_retry');
  assert.equal(getFreighterRecovery(null).action, 'retry');
  assert.equal(getFreighterRecovery('timeout', FREIGHTER_MAX_RETRIES).action, 'reload');
  // Installing is never replaced by a reload suggestion.
  assert.equal(getFreighterRecovery('not_installed', FREIGHTER_MAX_RETRIES).action, 'install');
});

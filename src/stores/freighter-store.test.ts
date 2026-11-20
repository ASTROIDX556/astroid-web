import assert from 'node:assert/strict';
import test, { afterEach, describe } from 'node:test';
import {
  FREIGHTER_ERROR_MESSAGES,
  FreighterWalletError,
  __setFreighterApiForTests,
  classifyFreighterError,
  useFreighterStore,
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

// --- Error handling and recovery (#532) -------------------------------------

const TESTNET = 'Test SDF Network ; September 2015';
const PUBLIC_NET = 'Public Global Stellar Network ; September 2015';
const signedXdr = 'AAAA-signed';

type StubApi = Parameters<typeof __setFreighterApiForTests>[0];

function resetStore(): void {
  __setFreighterApiForTests();
  useFreighterStore.setState({
    status: 'disconnected',
    isInstalled: false,
    publicKey: null,
    network: null,
    networkPassphrase: null,
    targetNetwork: 'testnet',
    isSwitching: false,
    error: null,
    errorCode: null,
  });
}

function connectedStore(): void {
  useFreighterStore.setState({
    status: 'connected',
    isInstalled: true,
    publicKey: validPublicKey,
    network: 'TESTNET',
    networkPassphrase: TESTNET,
    error: null,
    errorCode: null,
  });
}

/** What the Freighter API resolves with (it does not throw) when the user clicks "Reject". */
const declined = { error: { code: -4, message: 'The user declined this request.' } };

describe('classifyFreighterError', () => {
  test('recognises a rejected request from the message', () => {
    assert.equal(classifyFreighterError(new Error('User declined access')).code, 'user_rejected');
    assert.equal(classifyFreighterError('The request was rejected').code, 'user_rejected');
  });

  test('recognises timeouts, locked wallets and a missing extension', () => {
    assert.equal(classifyFreighterError(new Error('Freighter wallet request timed out.')).code, 'timeout');
    assert.equal(classifyFreighterError(new Error('Freighter is locked')).code, 'locked');
    assert.equal(classifyFreighterError(new Error('Freighter extension is not installed.')).code, 'not_installed');
  });

  test('keeps an unrecognised message and falls back for empty input', () => {
    assert.deepEqual(classifyFreighterError(new Error('Boom')), { code: 'unknown', message: 'Boom' });
    assert.equal(classifyFreighterError(undefined).message, FREIGHTER_ERROR_MESSAGES.unknown);
  });

  test('passes a FreighterWalletError through unchanged', () => {
    const error = new FreighterWalletError('network_mismatch', 'wrong network');
    assert.deepEqual(classifyFreighterError(error), { code: 'network_mismatch', message: 'wrong network' });
  });
});

describe('connect error states', () => {
  afterEach(resetStore);

  test('a declined connection request reports user_rejected and keeps the extension marked installed', async () => {
    resetStore();
    __setFreighterApiForTests({ isConnected: async () => true, setAllowed: async () => declined } as StubApi);

    const result = await useFreighterStore.getState().connect();
    const state = useFreighterStore.getState();

    assert.equal(result, null);
    assert.equal(state.status, 'disconnected');
    assert.equal(state.errorCode, 'user_rejected');
    assert.equal(state.error, FREIGHTER_ERROR_MESSAGES.user_rejected);
    assert.equal(state.isInstalled, true);
    assert.equal(state.publicKey, null);
  });

  test('setAllowed returning false is also a rejection', async () => {
    resetStore();
    __setFreighterApiForTests({ isConnected: async () => true, setAllowed: async () => false } as StubApi);

    await useFreighterStore.getState().connect();

    assert.equal(useFreighterStore.getState().errorCode, 'user_rejected');
  });

  test('a missing extension reports not_installed', async () => {
    resetStore();
    __setFreighterApiForTests({} as StubApi);

    await useFreighterStore.getState().connect();
    const state = useFreighterStore.getState();

    assert.equal(state.errorCode, 'not_installed');
    assert.equal(state.error, FREIGHTER_ERROR_MESSAGES.not_installed);
    assert.equal(state.isInstalled, false);
    assert.equal(state.status, 'disconnected');
  });

  test('a stalled extension reports timeout without claiming it is missing', async () => {
    resetStore();
    useFreighterStore.setState({ isInstalled: true });
    __setFreighterApiForTests({
      isConnected: async () => true,
      setAllowed: async () => true,
      getAddress: async () => {
        throw new FreighterWalletError('timeout', FREIGHTER_ERROR_MESSAGES.timeout);
      },
    } as StubApi);

    await useFreighterStore.getState().connect();
    const state = useFreighterStore.getState();

    assert.equal(state.errorCode, 'timeout');
    assert.equal(state.isInstalled, true);
  });

  test('a locked wallet moves the store to the locked status', async () => {
    resetStore();
    __setFreighterApiForTests({
      isConnected: async () => true,
      setAllowed: async () => true,
      getAddress: async () => ({ error: { code: -1, message: 'Wallet is locked, unlock it first' } }),
    } as StubApi);

    await useFreighterStore.getState().connect();

    assert.equal(useFreighterStore.getState().status, 'locked');
    assert.equal(useFreighterStore.getState().errorCode, 'locked');
  });

  test('a rejected re-connect does not tear down an existing session', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({ isConnected: async () => true, setAllowed: async () => declined } as StubApi);

    await useFreighterStore.getState().connect();
    const state = useFreighterStore.getState();

    assert.equal(state.status, 'connected');
    assert.equal(state.publicKey, validPublicKey);
    assert.equal(state.errorCode, 'user_rejected');
  });

  test('connecting again after a failure recovers and clears the error', async () => {
    resetStore();
    __setFreighterApiForTests({ isConnected: async () => true, setAllowed: async () => declined } as StubApi);
    await useFreighterStore.getState().connect();
    assert.equal(useFreighterStore.getState().errorCode, 'user_rejected');

    __setFreighterApiForTests({
      isConnected: async () => true,
      setAllowed: async () => ({ isAllowed: true }),
      getAddress: async () => ({ address: validPublicKey }),
      getNetwork: async () => ({ network: 'TESTNET', networkPassphrase: TESTNET }),
    } as StubApi);
    const key = await useFreighterStore.getState().connect();
    const state = useFreighterStore.getState();

    assert.equal(key, validPublicKey);
    assert.equal(state.status, 'connected');
    assert.equal(state.error, null);
    assert.equal(state.errorCode, null);
  });
});

describe('requestSignature error states', () => {
  afterEach(resetStore);

  test('a declined signature keeps the wallet connected and throws a typed error', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({ signTransaction: async () => declined } as StubApi);

    await assert.rejects(
      () => useFreighterStore.getState().requestSignature('AAAA'),
      (error: unknown) => error instanceof FreighterWalletError && error.code === 'user_rejected',
    );
    const state = useFreighterStore.getState();

    assert.equal(state.status, 'connected');
    assert.equal(state.publicKey, validPublicKey);
    assert.equal(state.errorCode, 'user_rejected');
    assert.equal(state.error, FREIGHTER_ERROR_MESSAGES.user_rejected);
  });

  test('signing again after a decline succeeds and clears the error', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({ signTransaction: async () => declined } as StubApi);
    await assert.rejects(() => useFreighterStore.getState().requestSignature('AAAA'));

    __setFreighterApiForTests({
      signTransaction: async () => ({ signedTxXdr: signedXdr, signerAddress: validPublicKey }),
    } as StubApi);
    const signed = await useFreighterStore.getState().requestSignature('AAAA');

    assert.equal(signed, signedXdr);
    assert.equal(useFreighterStore.getState().error, null);
    assert.equal(useFreighterStore.getState().errorCode, null);
    assert.equal(useFreighterStore.getState().status, 'connected');
  });

  test('a locked wallet while signing moves the store to locked', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({
      signTransaction: async () => ({ error: { code: -1, message: 'Freighter is locked' } }),
    } as StubApi);

    await assert.rejects(() => useFreighterStore.getState().requestSignature('AAAA'));

    assert.equal(useFreighterStore.getState().status, 'locked');
    assert.equal(useFreighterStore.getState().errorCode, 'locked');
  });

  test('a signing timeout does not disconnect the wallet', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({
      signTransaction: async () => {
        throw new FreighterWalletError('timeout', FREIGHTER_ERROR_MESSAGES.timeout);
      },
    } as StubApi);

    await assert.rejects(() => useFreighterStore.getState().requestSignature('AAAA'));

    assert.equal(useFreighterStore.getState().status, 'connected');
    assert.equal(useFreighterStore.getState().errorCode, 'timeout');
  });

  test('an empty reply is reported as an invalid response', async () => {
    resetStore();
    connectedStore();
    __setFreighterApiForTests({ signTransaction: async () => ({}) } as StubApi);

    await assert.rejects(
      () => useFreighterStore.getState().requestSignature('AAAA'),
      (error: unknown) => error instanceof FreighterWalletError && error.code === 'invalid_response',
    );
    assert.equal(useFreighterStore.getState().status, 'connected');
  });

  test('a network mismatch is reported without calling the wallet', async () => {
    resetStore();
    connectedStore();
    useFreighterStore.setState({ networkPassphrase: PUBLIC_NET });
    let called = false;
    __setFreighterApiForTests({
      signTransaction: async () => {
        called = true;
        return signedXdr;
      },
    } as StubApi);

    await assert.rejects(
      () => useFreighterStore.getState().requestSignature('AAAA'),
      (error: unknown) => error instanceof FreighterWalletError && error.code === 'network_mismatch',
    );

    assert.equal(called, false);
    assert.equal(useFreighterStore.getState().errorCode, 'network_mismatch');
    assert.equal(useFreighterStore.getState().status, 'connected');
  });
});

describe('error lifecycle helpers', () => {
  afterEach(resetStore);

  test('clearError dismisses the message but keeps the connection', () => {
    resetStore();
    connectedStore();
    useFreighterStore.setState({ error: 'x', errorCode: 'timeout' });

    useFreighterStore.getState().clearError();

    assert.equal(useFreighterStore.getState().error, null);
    assert.equal(useFreighterStore.getState().errorCode, null);
    assert.equal(useFreighterStore.getState().status, 'connected');
  });

  test('disconnect clears a stale error code', () => {
    resetStore();
    useFreighterStore.setState({ error: 'x', errorCode: 'user_rejected' });

    useFreighterStore.getState().disconnect();

    assert.equal(useFreighterStore.getState().errorCode, null);
  });

  test('switching networks while disconnected reports not_connected', async () => {
    resetStore();

    await useFreighterStore.getState().switchNetwork('mainnet');

    assert.equal(useFreighterStore.getState().errorCode, 'not_connected');
  });
});

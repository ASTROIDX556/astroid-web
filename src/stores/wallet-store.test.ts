import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

import {
  truncateWalletAddress,
  useWalletAccountStore,
  type WalletAccount,
} from './wallet-store';

const KEY_A = `G${'A'.repeat(55)}`;
const KEY_B = `G${'B'.repeat(55)}`;
const KEY_C = `G${'C'.repeat(55)}`;

function account(publicKey: string, label: string, overrides: Partial<WalletAccount> = {}): WalletAccount {
  return {
    publicKey,
    label,
    source: 'freighter',
    network: 'testnet',
    ...overrides,
  };
}

function resetStore(): void {
  useWalletAccountStore.getState().reset();
  useWalletAccountStore.getState().setInvalidator(null);
  useWalletAccountStore.getState().setActivator(null);
}

beforeEach(resetStore);

describe('wallet account store (#575)', () => {
  test('registers accounts without duplicates and ignores blank keys', () => {
    const store = useWalletAccountStore.getState();
    store.registerAccount(account(KEY_A, 'Primary'));
    store.registerAccount(account(KEY_A, 'Primary updated'));
    store.registerAccount(account('   ', 'Blank'));

    const accounts = useWalletAccountStore.getState().accounts;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.publicKey, KEY_A);
    assert.equal(accounts[0]?.label, 'Primary updated');
  });

  test('setConnected records the active key, connection status, and account', () => {
    useWalletAccountStore.getState().setConnected(KEY_A, { network: 'public' });

    const state = useWalletAccountStore.getState();
    assert.equal(state.status, 'connected');
    assert.equal(state.activePublicKey, KEY_A);
    assert.equal(state.accounts.length, 1);
    assert.equal(state.accounts[0]?.network, 'public');
    assert.equal(state.error, null);
  });

  test('re-hydration keeps the operator-selected account', () => {
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.setConnected(KEY_B);
    store.registerAccount(account(KEY_C, 'Third'));

    const state = useWalletAccountStore.getState();
    assert.deepEqual(
      state.accounts.map((entry) => entry.publicKey),
      [KEY_A, KEY_B, KEY_C],
    );
    assert.equal(state.activePublicKey, KEY_A);
  });

  test('disconnect clears the active account but preserves the session list', () => {
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(account(KEY_B, 'Second'));

    store.setDisconnected('Freighter lost connection');

    const state = useWalletAccountStore.getState();
    assert.equal(state.status, 'disconnected');
    assert.equal(state.activePublicKey, null);
    assert.equal(state.error, 'Freighter lost connection');
    assert.deepEqual(
      state.accounts.map((entry) => entry.publicKey),
      [KEY_A, KEY_B],
    );
  });

  test('switching rejects unknown accounts without changing the active key', async () => {
    let invalidations = 0;
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.setInvalidator(() => {
      invalidations += 1;
    });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_C);

    const state = useWalletAccountStore.getState();
    assert.equal(switched, false);
    assert.equal(state.activePublicKey, KEY_A);
    assert.match(state.error ?? '', /not available/i);
    assert.equal(invalidations, 0);
  });

  test('switching while disconnected fails with a reconnect message', async () => {
    const store = useWalletAccountStore.getState();
    store.setDisconnected();
    store.registerAccount(account(KEY_A, 'Primary'));

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_A);

    assert.equal(switched, false);
    assert.match(useWalletAccountStore.getState().error ?? '', /reconnect freighter/i);
  });

  test('switching invalidates wallet balances and activates the account', async () => {
    const invalidated: (string | null)[] = [];
    const activated: string[] = [];
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(account(KEY_B, 'Second'));
    store.setInvalidator(async (publicKey) => {
      invalidated.push(publicKey);
    });
    store.setActivator((publicKey) => {
      activated.push(publicKey);
    });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_B);

    const state = useWalletAccountStore.getState();
    assert.equal(switched, true);
    assert.equal(state.activePublicKey, KEY_B);
    assert.equal(state.isSwitching, false);
    assert.equal(state.error, null);
    assert.ok(typeof state.lastSwitchedAt === 'number');
    assert.deepEqual(invalidated, [KEY_B]);
    assert.deepEqual(activated, [KEY_B]);
  });

  test('switching to the already-active account is a no-op', async () => {
    let invalidations = 0;
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.setInvalidator(() => {
      invalidations += 1;
    });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_A);

    assert.equal(switched, true);
    assert.equal(invalidations, 0);
    assert.equal(useWalletAccountStore.getState().activePublicKey, KEY_A);
  });

  test('a failed cache refresh recovers to the previous active account', async () => {
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(account(KEY_B, 'Second'));
    store.setInvalidator(async () => {
      throw new Error('balance service unavailable');
    });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_B);

    const state = useWalletAccountStore.getState();
    assert.equal(switched, false);
    assert.equal(state.activePublicKey, KEY_A);
    assert.equal(state.isSwitching, false);
    assert.match(state.error ?? '', /could not refresh balances/i);
  });

  test('zero-balance accounts remain selectable', async () => {
    const invalidated: (string | null)[] = [];
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(
      account(KEY_B, 'Dormant account', { balanceXlm: 0 }),
    );
    store.setInvalidator((publicKey) => {
      invalidated.push(publicKey);
    });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_B);

    assert.equal(switched, true);
    assert.equal(useWalletAccountStore.getState().activePublicKey, KEY_B);
    assert.equal(useWalletAccountStore.getState().accounts[1]?.balanceXlm, 0);
    assert.deepEqual(invalidated, [KEY_B]);
  });

  test('a concurrent switch is ignored while another is in flight', async () => {
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(account(KEY_B, 'Second'));
    useWalletAccountStore.setState({ isSwitching: true });

    const switched = await useWalletAccountStore.getState().switchAccount(KEY_B);

    assert.equal(switched, false);
    assert.equal(useWalletAccountStore.getState().activePublicKey, KEY_A);
  });

  test('removing the active account clears the selection but keeps the rest', () => {
    const store = useWalletAccountStore.getState();
    store.setConnected(KEY_A);
    store.registerAccount(account(KEY_B, 'Second'));

    store.removeAccount(KEY_A);

    const state = useWalletAccountStore.getState();
    assert.equal(state.activePublicKey, null);
    assert.deepEqual(
      state.accounts.map((entry) => entry.publicKey),
      [KEY_B],
    );
  });

  test('formats addresses for the switcher trigger', () => {
    assert.equal(truncateWalletAddress(KEY_A), `${KEY_A.slice(0, 6)}…${KEY_A.slice(-4)}`);
    assert.equal(truncateWalletAddress('GABC'), 'GABC');
  });
});

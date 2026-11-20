'use client';

import { create } from 'zustand';

export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type WalletAccountSource = 'freighter' | 'managed';

export interface WalletAccount {
  /** Stellar public key (never a secret). */
  publicKey: string;
  /** Display label, e.g. "Freighter account 2" or a workspace wallet name. */
  label: string;
  source: WalletAccountSource;
  /** Network reported when the account was observed. */
  network?: string;
  /** Workspace wallet id when the key belongs to a managed wallet. */
  walletId?: string;
  /** Last known native balance; zero is valid and does not block switching. */
  balanceXlm?: number | null;
}

/** Invalidates cached balances and account-scoped data after a switch. */
export type WalletQueryInvalidator = (publicKey: string | null) => Promise<void> | void;

/** Optional hook so the active account can be mirrored into the wallet client. */
export type WalletAccountActivator = (publicKey: string) => void;

export interface WalletAccountsState {
  /** Every account observed in this session, newest first. */
  accounts: WalletAccount[];
  /** Public key the dashboard is currently operating on. */
  activePublicKey: string | null;
  status: WalletConnectionStatus;
  isSwitching: boolean;
  error: string | null;
  /** Timestamp of the last successful switch (null before the first one). */
  lastSwitchedAt: number | null;
  /** Registered by the query bridge; invalidates balances after a switch. */
  invalidator: WalletQueryInvalidator | null;
  /** Registered by the bridge; mirrors the active key into the wallet client. */
  activator: WalletAccountActivator | null;

  // -- wiring --
  setInvalidator: (invalidator: WalletQueryInvalidator | null) => void;
  setActivator: (activator: WalletAccountActivator | null) => void;

  // -- account list --
  registerAccount: (account: WalletAccount) => void;
  setAccounts: (accounts: WalletAccount[]) => void;
  removeAccount: (publicKey: string) => void;

  // -- connection lifecycle --
  markConnecting: () => void;
  setConnected: (publicKey: string, details?: Partial<Omit<WalletAccount, 'publicKey'>>) => void;
  setDisconnected: (reason?: string) => void;

  // -- switching --
  switchAccount: (publicKey: string) => Promise<boolean>;
  clearError: () => void;
  reset: () => void;
}

const truncate = (address: string): string =>
  address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

export function walletAccountLabel(account: Pick<WalletAccount, 'label' | 'publicKey'>): string {
  return account.label.trim() || truncate(account.publicKey);
}

/** Short display form of a Stellar address, used by the switcher trigger. */
export function truncateWalletAddress(address: string): string {
  return truncate(address);
}

function normalizeAccount(account: WalletAccount): WalletAccount | null {
  const publicKey = account.publicKey.trim();
  if (!publicKey) return null;

  const label = account.label.trim() || truncate(publicKey);
  return {
    ...account,
    publicKey,
    label,
    ...(account.network ? { network: account.network } : {}),
    ...(account.walletId ? { walletId: account.walletId } : {}),
    ...(account.balanceXlm !== undefined ? { balanceXlm: account.balanceXlm } : {}),
  };
}

/** Upserts by public key, preserving insertion order. */
function upsertAccount(
  accounts: readonly WalletAccount[],
  account: WalletAccount,
): WalletAccount[] {
  const index = accounts.findIndex((entry) => entry.publicKey === account.publicKey);
  if (index === -1) return [...accounts, account];

  return accounts.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...account } : entry,
  );
}

function sortedAccounts(accounts: readonly WalletAccount[]): WalletAccount[] {
  // Deterministic order for the switcher; zero-balance accounts are still a
  // first-class option, they are only marked in the UI.
  return [...accounts].sort((a, b) => a.label.localeCompare(b.label));
}

export const useWalletAccountStore = create<WalletAccountsState>((set, get) => ({
  accounts: [],
  activePublicKey: null,
  status: 'disconnected',
  isSwitching: false,
  error: null,
  lastSwitchedAt: null,
  invalidator: null,
  activator: null,

  setInvalidator: (invalidator) => set({ invalidator }),
  setActivator: (activator) => set({ activator }),

  registerAccount: (account) => {
    const normalized = normalizeAccount(account);
    if (!normalized) return;

    set((state) => ({
      accounts: upsertAccount(state.accounts, normalized),
      activePublicKey:
        state.activePublicKey === null && state.status === 'connected'
          ? normalized.publicKey
          : state.activePublicKey,
    }));
  },

  setAccounts: (accounts) => {
    const next = sortedAccounts(
      accounts
        .map(normalizeAccount)
        .filter((account): account is WalletAccount => account !== null)
        .filter(
          (account, index, all) =>
            all.findIndex((entry) => entry.publicKey === account.publicKey) === index,
        ),
    );
    const active = get().activePublicKey;

    set({
      accounts: next,
      activePublicKey: next.some((account) => account.publicKey === active) ? active : null,
    });
  },

  removeAccount: (publicKey) =>
    set((state) => {
      const accounts = state.accounts.filter((account) => account.publicKey !== publicKey);
      return {
        accounts,
        activePublicKey: state.activePublicKey === publicKey ? null : state.activePublicKey,
      };
    }),

  markConnecting: () => set({ status: 'connecting', error: null }),

  setConnected: (publicKey, details = {}) => {
    const normalized = normalizeAccount({
      publicKey,
      label: details.label ?? '',
      source: details.source ?? 'freighter',
      ...(details.network ? { network: details.network } : {}),
      ...(details.walletId ? { walletId: details.walletId } : {}),
      ...(details.balanceXlm !== undefined ? { balanceXlm: details.balanceXlm } : {}),
    });
    if (!normalized) {
      set({ status: 'error', error: 'Freighter returned an invalid Stellar public key.' });
      return;
    }

    set((state) => {
      const accounts = upsertAccount(state.accounts, normalized);
      return {
        accounts,
        // Keep the operator's chosen account across routine re-hydration, but
        // follow the wallet when there is nothing selected yet.
        activePublicKey:
          state.activePublicKey &&
          accounts.some((account) => account.publicKey === state.activePublicKey)
            ? state.activePublicKey
            : normalized.publicKey,
        status: 'connected',
        error: null,
        isSwitching: false,
      };
    });
  },

  setDisconnected: (reason) =>
    set({
      status: 'disconnected',
      activePublicKey: null,
      isSwitching: false,
      error: reason ?? null,
    }),

  switchAccount: async (publicKey) => {
    const state = get();
    const normalizedKey = publicKey.trim();
    const account = state.accounts.find((entry) => entry.publicKey === normalizedKey);

    if (!account) {
      set({
        error: `Account ${truncate(normalizedKey || 'unknown')} is not available in this session.`,
      });
      return false;
    }

    if (state.status !== 'connected') {
      set({ error: 'Reconnect Freighter before switching accounts.' });
      return false;
    }

    if (state.activePublicKey === normalizedKey) {
      set({ error: null });
      return true;
    }

    if (state.isSwitching) return false;

    const previousActive = state.activePublicKey;
    set({ isSwitching: true, error: null, activePublicKey: normalizedKey });

    try {
      // Balances and account-scoped data belong to the previous key, so the
      // active key only sticks once the cache refresh succeeds.
      await state.invalidator?.(normalizedKey);
      state.activator?.(normalizedKey);
      set({ isSwitching: false, lastSwitchedAt: Date.now() });
      return true;
    } catch {
      set({
        activePublicKey: previousActive,
        isSwitching: false,
        error: 'Could not refresh balances for the selected account. Try again.',
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      accounts: [],
      activePublicKey: null,
      status: 'disconnected',
      isSwitching: false,
      error: null,
      lastSwitchedAt: null,
    }),
}));

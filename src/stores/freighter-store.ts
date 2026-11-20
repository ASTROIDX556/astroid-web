'use client';

import { create } from 'zustand';
import type { StateCreator } from 'zustand';

export type FreighterConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'locked';

/**
 * Machine-readable reason behind `error`. UI can branch on this (for example
 * show an install link for `not_installed`, or stay quiet for `user_rejected`)
 * instead of pattern-matching message text.
 */
export type FreighterErrorCode =
  | 'not_installed'
  | 'user_rejected'
  | 'timeout'
  | 'locked'
  | 'network_mismatch'
  | 'not_connected'
  | 'invalid_response'
  | 'unknown';

/**
 * Stellar networks the app can target. Freighter itself owns the extension's
 * active network, so this app-side target acts as the *expected* network:
 * signing fails closed whenever the wallet's live passphrase disagrees with
 * it (see `requestSignature` and `isNetworkMismatch`).
 */
export type StellarNetworkId = 'public' | 'testnet' | 'futurenet';

export interface StellarNetworkDescriptor {
  id: StellarNetworkId;
  label: string;
  passphrase: string;
  horizonUrl: string;
}

export const STELLAR_NETWORKS: Record<StellarNetworkId, StellarNetworkDescriptor> = {
  public: {
    id: 'public',
    label: 'Mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
  },
  testnet: {
    id: 'testnet',
    label: 'Testnet',
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
  },
  futurenet: {
    id: 'futurenet',
    label: 'Futurenet',
    passphrase: 'Test SDF Future Network ; October 2022',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
  },
};

/** Passphrase for an app-side target network id (never null for known ids). */
export function resolveExpectedPassphrase(target: StellarNetworkId | null): string | null {
  return target ? STELLAR_NETWORKS[target]?.passphrase ?? null : null;
}

/** Reverse map a wallet passphrase back to a known network id, if recognized. */
export function networkIdForPassphrase(passphrase: string | null): StellarNetworkId | null {
  if (!passphrase) return null;
  const entry = (Object.values(STELLAR_NETWORKS) as StellarNetworkDescriptor[]).find(
    (network) => network.passphrase === passphrase,
  );
  return entry?.id ?? null;
}

/**
 * Fail-closed mismatch predicate: once an expected passphrase is set, a
 * missing or different wallet passphrase counts as a mismatch. Unknown wallet
 * state must never be treated as "safe to sign".
 */
export function isNetworkMismatch(
  walletPassphrase: string | null,
  expectedPassphrase: string | null,
): boolean {
  if (!expectedPassphrase) return false;
  return walletPassphrase !== expectedPassphrase;
}

/** Display label for a target id, falling back to "Unknown" for bad input. */
export function networkLabelForId(target: StellarNetworkId | null): string {
  return (target && STELLAR_NETWORKS[target]?.label) || 'Unknown';
}

export interface FreighterWalletState {
  status: FreighterConnectionStatus;
  isInstalled: boolean;
  publicKey: string | null;
  network: string | null;
  /** Live passphrase reported by the Freighter extension, null when unknown. */
  networkPassphrase: string | null;
  /** Network this app session targets; signing gates against this value. */
  targetNetwork: StellarNetworkId;
  /** True while a network switch request is in flight. */
  isSwitching: boolean;
  error: string | null;
  /** Why `error` is set; always null when `error` is null. */
  errorCode: FreighterErrorCode | null;
  /** Dismisses the current error without touching the connection. */
  clearError: () => void;
  checkExtension: () => Promise<boolean>;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  /** Re-reads the extension's active network + passphrase into state. */
  refreshNetwork: () => Promise<void>;
  /** Sets the expected network and re-syncs against the wallet. */
  switchNetwork: (target: StellarNetworkId | 'mainnet') => Promise<{ matched: boolean } | boolean>;
  /** Subscribes to Freighter account/network change events (WatchWalletChanges). */
  startWalletWatch: () => void;
  stopWalletWatch: () => void;
  /**
   * Records a connection that was established or lost outside this store, so
   * every wallet-dependent widget reflects it at once. A valid address marks
   * the wallet connected; `null` (or an invalid address) clears the session
   * exactly like `disconnect()`.
   */
  adoptConnection: (publicKey: string | null) => void;
  /** Compatibility setter retained for consumers of the original wallet API. */
  updatePublicKey: (publicKey: string) => void;
  requestSignature: (xdr: string, options?: { networkPassphrase?: string }) => Promise<string>;
  hydrate: () => Promise<void>;
}

/** Backward-compatible names retained for consumers of the previous wallet store API. */
export type StellarWalletNetwork = StellarNetworkId;
export type WalletState = FreighterWalletState;
export type WalletActions = Pick<
  FreighterWalletState,
  'checkExtension' | 'connect' | 'disconnect' | 'refreshNetwork' | 'switchNetwork' |
    'startWalletWatch' | 'stopWalletWatch' | 'adoptConnection' | 'requestSignature' | 'hydrate'
>;

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** User-facing copy for each failure mode. */
export const FREIGHTER_ERROR_MESSAGES = {
  not_installed:
    'Freighter extension is not installed or unavailable. Install it, then reload this page.',
  user_rejected: 'The request was rejected in Freighter. Approve it in the extension to continue.',
  timeout: 'Freighter wallet request timed out. Check that the extension is installed and unlocked.',
  locked: 'Freighter is locked. Unlock the extension, then try again.',
  not_connected: 'Connect a Freighter wallet before continuing.',
  invalid_response: 'Freighter returned an unexpected response.',
  unknown: 'Freighter request failed.',
} as const;

/** `FreighterApiError.code` the extension uses when the user declines a prompt. */
const FREIGHTER_USER_DECLINED_CODE = -4;

/** Error thrown by the store's wallet actions; `code` says what went wrong. */
export class FreighterWalletError extends Error {
  readonly code: FreighterErrorCode;

  constructor(code: FreighterErrorCode, message: string = FREIGHTER_ERROR_MESSAGES.unknown) {
    super(message);
    this.name = 'FreighterWalletError';
    this.code = code;
  }
}

/** Shape of the `{ error }` object the Freighter API returns instead of throwing. */
interface FreighterApiErrorLike {
  code?: number;
  message?: string;
}

/**
 * `@stellar/freighter-api` resolves with `{ error: { code, message } }` for most
 * failures rather than rejecting. Surface that as a thrown error so every
 * caller handles one path.
 */
class FreighterApiResultError extends Error {
  readonly apiCode: number | undefined;

  constructor(error: FreighterApiErrorLike) {
    super(error.message?.trim() || FREIGHTER_ERROR_MESSAGES.unknown);
    this.name = 'FreighterApiResultError';
    this.apiCode = error.code;
  }
}

const throwIfApiError = <T>(result: T): T => {
  if (result && typeof result === 'object') {
    const error = (result as { error?: unknown }).error;
    if (error && typeof error === 'object') {
      throw new FreighterApiResultError(error as FreighterApiErrorLike);
    }
    if (typeof error === 'string' && error.trim()) {
      throw new FreighterApiResultError({ message: error });
    }
  }
  return result;
};

/**
 * Maps anything a Freighter call can throw (or resolve with as `error`) to a
 * stable code plus a message that is safe to show in the UI.
 */
export function classifyFreighterError(error: unknown): { code: FreighterErrorCode; message: string } {
  if (error instanceof FreighterWalletError) {
    return { code: error.code, message: error.message };
  }

  const apiCode = error instanceof FreighterApiResultError ? error.apiCode : undefined;
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && typeof (error as FreighterApiErrorLike).message === 'string'
          ? ((error as FreighterApiErrorLike).message as string)
          : '';
  const text = raw.trim();

  if (apiCode === FREIGHTER_USER_DECLINED_CODE || /reject|declin|denied|cancel|refus/i.test(text)) {
    return { code: 'user_rejected', message: FREIGHTER_ERROR_MESSAGES.user_rejected };
  }
  if (/timed? ?out/i.test(text)) {
    return { code: 'timeout', message: FREIGHTER_ERROR_MESSAGES.timeout };
  }
  if (/locked|unlock/i.test(text)) {
    return { code: 'locked', message: FREIGHTER_ERROR_MESSAGES.locked };
  }
  if (/not installed|not detected|no freighter|extension.*(unavailable|not found)|unavailable.*extension/i.test(text)) {
    return { code: 'not_installed', message: FREIGHTER_ERROR_MESSAGES.not_installed };
  }
  return { code: 'unknown', message: text || FREIGHTER_ERROR_MESSAGES.unknown };
}

const withTimeout = async <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return await new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FreighterWalletError('timeout', FREIGHTER_ERROR_MESSAGES.timeout));
    }, ms);

    promise.then(
      (value) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
};

interface FreighterNetworkResult {
  network?: string;
  networkPassphrase?: string;
}

type FreighterApi = {
    isConnected?: () => Promise<boolean | { isConnected?: boolean; error?: FreighterApiErrorLike }>;
    setAllowed?: () => Promise<boolean | { isAllowed?: boolean; error?: FreighterApiErrorLike }>;
    getAddress?: () => Promise<string | { address?: string; publicKey?: string; error?: FreighterApiErrorLike }>;
    getNetwork?: () => Promise<string | FreighterNetworkResult>;
    signTransaction?: (xdr: string, options?: Record<string, unknown>) => Promise<string | { signedTxXdr?: string; signedXDR?: string; xdr?: string; error?: FreighterApiErrorLike }>;
    WatchWalletChanges?: new (timeout?: number) => {
      watch: (
        cb: (params: { address: string; network: string; networkPassphrase: string; error?: unknown }) => void,
      ) => { error?: unknown };
      stop: () => void;
    };
  };

const defaultFreighterLoader = async (): Promise<FreighterApi> =>
  (await import('@stellar/freighter-api')) as unknown as FreighterApi;

let freighterLoader: () => Promise<FreighterApi> = defaultFreighterLoader;

const getFreighter = (): Promise<FreighterApi> => freighterLoader();

/**
 * Test seam: swaps the dynamic `@stellar/freighter-api` import for a stub so
 * the store's error and recovery paths can run without a browser extension.
 * Call with no argument to restore the real loader.
 */
export function __setFreighterApiForTests(api?: FreighterApi): void {
  freighterLoader = api ? async () => api : defaultFreighterLoader;
}

const isValidStellarAddress = (value: string | null | undefined): value is string =>
  typeof value === 'string' && STELLAR_ADDRESS_RE.test(value);

const resolveWalletAddress = (value: unknown): string | null => {
  if (typeof value === 'string') return isValidStellarAddress(value) ? value : null;
  if (value && typeof value === 'object') {
    const candidate = (value as { address?: string; publicKey?: string }).address ?? (value as { address?: string; publicKey?: string }).publicKey;
    return isValidStellarAddress(candidate) ? candidate : null;
  }
  return null;
};

const resolveNetwork = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return (value as { network?: string }).network ?? null;
  }
  return null;
};

const resolvePassphrase = (value: unknown): string | null => {
  if (value && typeof value === 'object') {
    const passphrase = (value as { networkPassphrase?: string }).networkPassphrase;
    return passphrase && passphrase.trim() ? passphrase : null;
  }
  return null;
};

/**
 * Module-level singleton for the WatchWalletChanges subscription so multiple
 * consumers mounting/unmounting never leak duplicate polling watchers.
 */
let walletWatcher: { stop: () => void } | null = null;

const storeCreator: StateCreator<FreighterWalletState> = (set, get) => ({
  status: 'disconnected',
  isInstalled: false,
  publicKey: null,
  network: null,
  networkPassphrase: null,
  targetNetwork: 'testnet',
  isSwitching: false,
  error: null,
  errorCode: null,

  clearError: () => {
    set({ error: null, errorCode: null });
  },

  checkExtension: async () => {
    try {
      const freighter = await getFreighter();
      const connectedResult = typeof freighter.isConnected === 'function' ? await withTimeout(freighter.isConnected()) : { isConnected: true };
      const connected = typeof connectedResult === 'boolean' ? connectedResult : Boolean((connectedResult as { isConnected?: boolean } | undefined)?.isConnected);
      set({ isInstalled: true, status: connected ? 'connected' : 'disconnected' });
      return Boolean(connected);
    } catch {
      set({
        isInstalled: false,
        status: 'disconnected',
        error: FREIGHTER_ERROR_MESSAGES.not_installed,
        errorCode: 'not_installed',
      });
      return false;
    }
  },

  connect: async () => {
    // A failed *re*-connect (user closes the prompt, the extension stalls) must
    // not tear down a session that was healthy a moment ago.
    const previous = get();
    const hadSession = previous.status === 'connected' && previous.publicKey !== null;
    set({ status: 'connecting', error: null, errorCode: null });

    try {
      const freighter = await getFreighter();
      const installed = typeof window !== 'undefined' && !!(window as typeof window & { freighter?: unknown }).freighter;
      if (!installed && typeof freighter.isConnected !== 'function') {
        throw new FreighterWalletError('not_installed', FREIGHTER_ERROR_MESSAGES.not_installed);
      }

      if (typeof freighter.setAllowed === 'function') {
        const allowed = throwIfApiError(await withTimeout(freighter.setAllowed()));
        const isAllowed = typeof allowed === 'boolean' ? allowed : Boolean((allowed as { isAllowed?: boolean })?.isAllowed);
        if (!isAllowed) {
          throw new FreighterWalletError('user_rejected', FREIGHTER_ERROR_MESSAGES.user_rejected);
        }
      }

      const addressResult = typeof freighter.getAddress === 'function'
        ? throwIfApiError(await withTimeout(freighter.getAddress()))
        : null;
      const publicKey = resolveWalletAddress(addressResult);
      if (!publicKey) {
        throw new FreighterWalletError('invalid_response', 'Freighter did not return a valid Stellar public key.');
      }

      const networkResult = typeof freighter.getNetwork === 'function' ? await withTimeout(freighter.getNetwork()) : null;
      const network = resolveNetwork(networkResult) ?? 'testnet';
      // Unknown passphrase stays null on purpose: signing gates fail closed.
      const networkPassphrase = resolvePassphrase(networkResult);

      set({
        status: 'connected',
        isInstalled: true,
        publicKey,
        network,
        networkPassphrase,
        error: null,
        errorCode: null,
      });

      return publicKey;
    } catch (error) {
      const { code, message } = classifyFreighterError(error);

      // The user saying no, or a slow extension, says nothing about whether the
      // extension is installed or the earlier session is still valid.
      if (hadSession && (code === 'user_rejected' || code === 'timeout')) {
        set({ status: 'connected', error: message, errorCode: code });
        return null;
      }

      set({
        status: code === 'locked' ? 'locked' : 'disconnected',
        isInstalled:
          code === 'not_installed'
            ? false
            : code === 'timeout' || code === 'unknown'
              ? previous.isInstalled
              : true,
        publicKey: null,
        network: null,
        networkPassphrase: null,
        error: message,
        errorCode: code,
      });
      return null;
    }
  },

  disconnect: () => {
    set({ status: 'disconnected', publicKey: null, network: null, networkPassphrase: null, error: null, errorCode: null });
  },

  refreshNetwork: async () => {
    try {
      const freighter = await getFreighter();
      if (typeof freighter.getNetwork !== 'function') return;
      const result = await withTimeout(freighter.getNetwork());
      const network = resolveNetwork(result);
      const networkPassphrase = resolvePassphrase(result);
      set({
        network: network ?? get().network,
        networkPassphrase,
      });
    } catch {
      // Leave the last known values untouched; the signing gate treats an
      // unknown/unverifiable wallet network as a mismatch (fail closed).
    }
  },

  switchNetwork: async (target) => {
    const legacyMainnet = target === 'mainnet';
    if (legacyMainnet) {
      if (get().status !== 'connected' || !get().publicKey) {
        set({ error: 'Connect a Freighter wallet before switching networks.', errorCode: 'not_connected' });
        return false;
      }
    }

    const networkTarget: StellarNetworkId = legacyMainnet ? 'public' : target;
    set({ targetNetwork: networkTarget, isSwitching: true, error: null });
    await get().refreshNetwork();
    const expected = resolveExpectedPassphrase(networkTarget);
    const matched = get().networkPassphrase === expected;
    set({ isSwitching: false });
    return legacyMainnet ? matched : { matched };
  },

  startWalletWatch: () => {
    if (typeof window === 'undefined') return;
    walletWatcher?.stop();
    walletWatcher = null;

    void (async () => {
      try {
        const freighter = await getFreighter();
        const Watcher = freighter.WatchWalletChanges;
        if (typeof Watcher !== 'function') return;

        const watcher = new Watcher(4000);
        walletWatcher = watcher;
        watcher.watch(({ address, network, networkPassphrase, error }) => {
          if (error || !isValidStellarAddress(address)) {
            // Wallet locked, switched to an unsupported account, or lost the
            // connection: reflect a clean disconnected state rather than
            // keeping stale signing context around.
            set({ status: 'disconnected', publicKey: null, networkPassphrase: null });
            return;
          }

          const state = get();
          const patch: Partial<Pick<FreighterWalletState, 'status' | 'isInstalled' | 'publicKey' | 'network' | 'networkPassphrase'>> = {};
          if (state.publicKey !== address) {
            patch.publicKey = address;
            patch.status = 'connected';
            patch.isInstalled = true;
          }
          if (network && state.network !== network) patch.network = network;
          const nextPassphrase = networkPassphrase && networkPassphrase.trim() ? networkPassphrase : null;
          if (state.networkPassphrase !== nextPassphrase) patch.networkPassphrase = nextPassphrase;
          if (Object.keys(patch).length > 0) set(patch);
        });
      } catch {
        // Extension unavailable — watching is simply a no-op until connect().
      }
    })();
  },

  stopWalletWatch: () => {
    walletWatcher?.stop();
    walletWatcher = null;
  },

  adoptConnection: (publicKey) => {
    if (!isValidStellarAddress(publicKey)) {
      get().disconnect();
      return;
    }
    if (get().status === 'connected' && get().publicKey === publicKey) return;
    set({ status: 'connected', isInstalled: true, publicKey, error: null, errorCode: null });
  },

  updatePublicKey: (publicKey) => {
    if (!isValidStellarAddress(publicKey)) {
      throw new Error('Invalid Stellar public key.');
    }
    set({ status: 'connected', isInstalled: true, publicKey, error: null, errorCode: null });
  },

  requestSignature: async (xdr: string, options?: { networkPassphrase?: string }) => {
    if (!xdr || !xdr.trim()) {
      throw new Error('Transaction XDR is required to request a signature.');
    }

    // Fail-closed network gate: never sign against a wallet network that
    // differs from the expected one, and never sign when the wallet's
    // network cannot be verified at all.
    const expectedPassphrase = options?.networkPassphrase ?? resolveExpectedPassphrase(get().targetNetwork);
    let walletPassphrase = get().networkPassphrase;
    if (!walletPassphrase) {
      await get().refreshNetwork();
      walletPassphrase = get().networkPassphrase;
    }
    if (isNetworkMismatch(walletPassphrase, expectedPassphrase)) {
      const walletLabel = networkLabelForId(networkIdForPassphrase(walletPassphrase));
      const expectedLabel = networkLabelForId(networkIdForPassphrase(expectedPassphrase));
      const message = `Network mismatch: Freighter is on ${walletLabel}, but this action targets ${expectedLabel}. Switch the wallet to ${expectedLabel} before signing.`;
      set({ error: message, errorCode: 'network_mismatch' });
      throw new FreighterWalletError('network_mismatch', message);
    }

    try {
      const freighter = await getFreighter();
      if (typeof freighter.signTransaction !== 'function') {
        throw new Error('Freighter does not expose transaction signing support.');
      }

      const response = throwIfApiError(
        await withTimeout(
          freighter.signTransaction(xdr, expectedPassphrase ? { networkPassphrase: expectedPassphrase } : undefined),
        ),
      );
      const signedXdr =
        typeof response === 'string'
          ? response
          : (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedTxXdr ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedXDR ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.xdr;

      if (!signedXdr) {
        throw new FreighterWalletError('invalid_response', 'Freighter did not return a signed transaction payload.');
      }

      set({ error: null, errorCode: null });
      return signedXdr;
    } catch (error) {
      const { code, message } = classifyFreighterError(error);

      // Only a locked or missing wallet changes the connection. A declined
      // prompt, a timeout, or a malformed reply leaves the session intact so the
      // user can simply try signing again instead of reconnecting.
      if (code === 'locked') {
        set({ error: message, errorCode: code, status: 'locked' });
      } else if (code === 'not_installed') {
        set({ error: message, errorCode: code, status: 'disconnected', isInstalled: false });
      } else {
        set({ error: message, errorCode: code });
      }
      throw error instanceof FreighterWalletError ? error : new FreighterWalletError(code, message);
    }
  },

  hydrate: async () => {
    try {
      const freighter = await getFreighter();
      const connectedResult = typeof freighter.isConnected === 'function'
        ? await withTimeout(freighter.isConnected())
        : false;
      const connected = typeof connectedResult === 'boolean'
        ? connectedResult
        : Boolean((connectedResult as { isConnected?: boolean } | null)?.isConnected);

      if (!connected) {
        set({ status: 'disconnected', publicKey: null, network: null, networkPassphrase: null, isInstalled: false, error: null });
        return;
      }

      const addressResult = typeof freighter.getAddress === 'function'
        ? await withTimeout(freighter.getAddress())
        : null;
      const walletAddress = resolveWalletAddress(addressResult);

      if (!walletAddress) {
        // The extension answered but exposed no address: the wallet is locked
        // or access was not granted. Surface a dedicated `locked` state so the
        // top bar can alert and offer a reconnect instead of silently showing
        // a generic disconnect.
        set({
          status: 'locked',
          publicKey: null,
          network: null,
          networkPassphrase: null,
          isInstalled: true,
          error: 'Freighter is locked or wallet access is unavailable.',
        });
        return;
      }

      // A network lookup failure must not invalidate an otherwise healthy
      // connection: keep the last-known values and let the signing gate fail
      // closed on an unknown passphrase.
      const networkResult =
        typeof freighter.getNetwork === 'function'
          ? await withTimeout(freighter.getNetwork()).catch(() => null)
          : null;

      set({
        isInstalled: true,
        status: 'connected',
        publicKey: walletAddress,
        network: resolveNetwork(networkResult) ?? 'testnet',
        networkPassphrase: resolvePassphrase(networkResult),
        error: null,
      });
    } catch (error) {
      const { code, message } = classifyFreighterError(error);
      const isLocked = code === 'locked';
      set({
        status: isLocked ? 'locked' : 'disconnected',
        publicKey: null,
        network: null,
        networkPassphrase: null,
        isInstalled: isLocked,
        error: code === 'unknown' ? 'Freighter wallet status is unavailable.' : message,
        errorCode: code,
      });
    }
  },
});

export const useFreighterStore = create<FreighterWalletState>()(storeCreator);
export const isValidStellarPublicKey = isValidStellarAddress;

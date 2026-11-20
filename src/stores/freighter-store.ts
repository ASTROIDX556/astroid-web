'use client';

import { create } from 'zustand';
import type { StateCreator } from 'zustand';

export type FreighterConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'locked';

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

/**
 * Machine-readable reason for the last failed Freighter interaction. The UI
 * keys its recovery copy and actions off this code instead of parsing the
 * human-readable `error` string.
 *
 * - `not_installed`    — the extension is missing or cannot be reached.
 * - `user_rejected`    — the operator declined the access/signing prompt.
 * - `timeout`          — the extension did not answer in time.
 * - `locked`           — the extension answered but the wallet is locked.
 * - `network_mismatch` — the wallet is on a different network than expected.
 * - `invalid_response` — the extension answered with an unusable payload.
 * - `unknown`          — anything else.
 */
export type FreighterErrorCode =
  | 'not_installed'
  | 'user_rejected'
  | 'timeout'
  | 'locked'
  | 'network_mismatch'
  | 'invalid_response'
  | 'unknown';

/** Error carrying a {@link FreighterErrorCode}, thrown by the store's internals. */
export class FreighterError extends Error {
  readonly code: FreighterErrorCode;

  constructor(code: FreighterErrorCode, message: string) {
    super(message);
    this.name = 'FreighterError';
    this.code = code;
  }
}

export const FREIGHTER_TIMEOUT_MS = 15000;

/** Upper bound on automatic-free manual retries before the UI suggests a reload. */
export const FREIGHTER_MAX_RETRIES = 3;

const DEFAULT_ERROR_MESSAGES: Record<FreighterErrorCode, string> = {
  not_installed: 'Freighter extension is not installed or unavailable.',
  user_rejected: 'Freighter access was rejected. Please approve the connection request.',
  timeout: 'Freighter wallet request timed out. Check that the extension is installed and unlocked.',
  locked: 'Freighter is locked or wallet access is unavailable.',
  network_mismatch: 'Freighter is connected to a different Stellar network.',
  invalid_response: 'Freighter returned an unexpected response.',
  unknown: 'Unable to connect to the Freighter wallet.',
};

/**
 * Maps any thrown value (or a Freighter `{ error }` payload) to an error code.
 * Pure so the classification rules can be unit-tested on their own.
 */
export function classifyFreighterError(error: unknown): FreighterErrorCode {
  if (error instanceof FreighterError) return error.code;

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
  const message = raw.toLowerCase();

  if (!message) return 'unknown';
  if (/timed out|timeout/.test(message)) return 'timeout';
  if (/not installed|not detected|unavailable|no extension|extension not found|cannot find module/.test(message)) {
    return 'not_installed';
  }
  if (/reject|declin|denied|cancel|not allowed|user refused/.test(message)) return 'user_rejected';
  if (/locked|unlock/.test(message)) return 'locked';
  if (/network mismatch|wrong network/.test(message)) return 'network_mismatch';
  return 'unknown';
}

/** Human-readable message for a thrown value, falling back to the code's default copy. */
function messageFor(error: unknown, code: FreighterErrorCode): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return DEFAULT_ERROR_MESSAGES[code];
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
  /** Classified reason for `error`; null whenever `error` is null. */
  errorCode: FreighterErrorCode | null;
  /** Consecutive failed connection attempts since the last success. */
  retryCount: number;
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
  /** Re-runs the connection flow after a failure, tracking the attempt count. */
  retryConnection: () => Promise<string | null>;
  /** Dismisses the current error without changing the connection status. */
  clearError: () => void;
}

/** Backward-compatible names retained for consumers of the previous wallet store API. */
export type StellarWalletNetwork = StellarNetworkId;
export type WalletState = FreighterWalletState;
export type WalletActions = Pick<
  FreighterWalletState,
  'checkExtension' | 'connect' | 'disconnect' | 'refreshNetwork' | 'switchNetwork' |
    'startWalletWatch' | 'stopWalletWatch' | 'adoptConnection' | 'requestSignature' | 'hydrate' |
    'retryConnection' | 'clearError'
>;

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const withTimeout = async <T>(promise: Promise<T>, ms = FREIGHTER_TIMEOUT_MS): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return await new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FreighterError('timeout', DEFAULT_ERROR_MESSAGES.timeout));
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
  isConnected?: () => Promise<boolean | { isConnected?: boolean }>;
  setAllowed?: () => Promise<boolean | { isAllowed?: boolean }>;
  getAddress?: () => Promise<string | { address?: string; publicKey?: string }>;
  getNetwork?: () => Promise<string | FreighterNetworkResult>;
  signTransaction?: (xdr: string, options?: Record<string, unknown>) => Promise<string | { signedTxXdr?: string; signedXDR?: string; xdr?: string }>;
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

/**
 * Test seam: swaps the module that stands in for `@stellar/freighter-api`.
 * Pass `null` to restore the real extension bridge.
 */
export function __setFreighterLoader(loader: (() => Promise<Partial<FreighterApi>>) | null): void {
  freighterLoader = loader ? (loader as () => Promise<FreighterApi>) : defaultFreighterLoader;
}

const getFreighter = async (): Promise<FreighterApi> => {
  try {
    return await freighterLoader();
  } catch {
    throw new FreighterError('not_installed', DEFAULT_ERROR_MESSAGES.not_installed);
  }
};

/** Freighter v2+ resolves `{ error }` payloads instead of rejecting; surface them as throws. */
const throwIfFreighterError = (value: unknown): void => {
  if (value && typeof value === 'object' && 'error' in value) {
    const raw = (value as { error?: unknown }).error;
    if (raw) {
      const code = classifyFreighterError(raw);
      throw new FreighterError(code, messageFor(typeof raw === 'string' ? raw : (raw as { message?: string }).message, code));
    }
  }
};

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
  retryCount: 0,

  checkExtension: async () => {
    try {
      const freighter = await getFreighter();
      const connectedResult = typeof freighter.isConnected === 'function' ? await withTimeout(freighter.isConnected()) : { isConnected: true };
      throwIfFreighterError(connectedResult);
      const connected = typeof connectedResult === 'boolean' ? connectedResult : Boolean((connectedResult as { isConnected?: boolean } | undefined)?.isConnected);
      set({ isInstalled: true, status: connected ? 'connected' : 'disconnected' });
      return Boolean(connected);
    } catch (error) {
      const code = classifyFreighterError(error);
      set({
        isInstalled: code !== 'not_installed' ? get().isInstalled : false,
        status: 'disconnected',
        error: messageFor(error, code),
        errorCode: code,
      });
      return false;
    }
  },

  connect: async () => {
    // Re-entrancy guard: a second click while a prompt is open must not spawn
    // a parallel request that later races the first one's result.
    if (get().status === 'connecting') return null;
    set({ status: 'connecting', error: null, errorCode: null });

    try {
      const freighter = await getFreighter();

      if (typeof freighter.isConnected === 'function') {
        const detected = await withTimeout(freighter.isConnected());
        throwIfFreighterError(detected);
        const present = typeof detected === 'boolean' ? detected : Boolean((detected as { isConnected?: boolean })?.isConnected);
        if (!present) {
          throw new FreighterError('not_installed', 'Freighter extension is not installed.');
        }
      } else {
        const installed = typeof window !== 'undefined' && !!(window as typeof window & { freighter?: unknown }).freighter;
        if (!installed) {
          throw new FreighterError('not_installed', 'Freighter extension is not installed.');
        }
      }

      if (typeof freighter.setAllowed === 'function') {
        const allowed = await withTimeout(freighter.setAllowed());
        throwIfFreighterError(allowed);
        const isAllowed = typeof allowed === 'boolean' ? allowed : Boolean((allowed as { isAllowed?: boolean })?.isAllowed);
        if (!isAllowed) {
          throw new FreighterError('user_rejected', DEFAULT_ERROR_MESSAGES.user_rejected);
        }
      }

      const addressResult = typeof freighter.getAddress === 'function' ? await withTimeout(freighter.getAddress()) : null;
      throwIfFreighterError(addressResult);
      const publicKey = resolveWalletAddress(addressResult);
      if (!publicKey) {
        throw new FreighterError('invalid_response', 'Freighter did not return a valid Stellar public key.');
      }

      const networkResult = typeof freighter.getNetwork === 'function'
        ? await withTimeout(freighter.getNetwork()).catch(() => null)
        : null;
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
        retryCount: 0,
      });

      return publicKey;
    } catch (error) {
      const code = classifyFreighterError(error);
      set({
        // A locked wallet answers through the extension, so it is installed.
        status: code === 'locked' ? 'locked' : 'disconnected',
        // Only a missing extension flips `isInstalled`; a rejection or timeout
        // proves nothing about whether the extension exists.
        isInstalled: code === 'not_installed' ? false : code === 'locked' || code === 'user_rejected' ? true : get().isInstalled,
        publicKey: null,
        network: null,
        networkPassphrase: null,
        error: messageFor(error, code),
        errorCode: code,
      });
      return null;
    }
  },

  retryConnection: async () => {
    set((state) => ({ retryCount: state.retryCount + 1 }));
    return await get().connect();
  },

  clearError: () => {
    set({ error: null, errorCode: null });
  },

  disconnect: () => {
    set({
      status: 'disconnected',
      publicKey: null,
      network: null,
      networkPassphrase: null,
      error: null,
      errorCode: null,
      retryCount: 0,
    });
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
        set({ error: 'Connect a Freighter wallet before switching networks.', errorCode: 'unknown' });
        return false;
      }
    }

    const networkTarget: StellarNetworkId = legacyMainnet ? 'public' : target;
    set({ targetNetwork: networkTarget, isSwitching: true, error: null, errorCode: null });
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
    set({ status: 'connected', isInstalled: true, publicKey, error: null, errorCode: null, retryCount: 0 });
  },

  updatePublicKey: (publicKey) => {
    if (!isValidStellarAddress(publicKey)) {
      throw new Error('Invalid Stellar public key.');
    }
    set({ status: 'connected', isInstalled: true, publicKey, error: null, errorCode: null, retryCount: 0 });
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
      throw new FreighterError('network_mismatch', message);
    }

    try {
      const freighter = await getFreighter();
      if (typeof freighter.signTransaction !== 'function') {
        throw new FreighterError('not_installed', 'Freighter does not expose transaction signing support.');
      }

      const response = await withTimeout(
        freighter.signTransaction(xdr, expectedPassphrase ? { networkPassphrase: expectedPassphrase } : undefined),
      );
      throwIfFreighterError(response);
      const signedXdr =
        typeof response === 'string'
          ? response
          : (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedTxXdr ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedXDR ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.xdr;

      if (!signedXdr) {
        throw new FreighterError('invalid_response', 'Freighter did not return a signed transaction payload.');
      }

      return signedXdr;
    } catch (error) {
      const code = classifyFreighterError(error);
      const message = error instanceof Error && error.message ? error.message : 'Signature request failed.';
      // Declining a single signature leaves the session intact; only failures
      // that mean the wallet is gone or unusable drop the connection.
      const keepsSession = code === 'user_rejected' || code === 'network_mismatch';
      set({
        error: message,
        errorCode: code,
        ...(keepsSession ? {} : { status: code === 'locked' ? 'locked' : 'disconnected' }),
      });
      throw error;
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
        set({ status: 'disconnected', publicKey: null, network: null, networkPassphrase: null, isInstalled: false, error: null, errorCode: null });
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
          error: DEFAULT_ERROR_MESSAGES.locked,
          errorCode: 'locked',
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
        errorCode: null,
      });
    } catch (error) {
      const code = classifyFreighterError(error);
      const isLocked = code === 'locked';
      set({
        status: isLocked ? 'locked' : 'disconnected',
        publicKey: null,
        network: null,
        networkPassphrase: null,
        isInstalled: isLocked,
        error: error instanceof Error && error.message ? error.message : 'Freighter wallet status is unavailable.',
        errorCode: code,
      });
    }
  },
});

export const useFreighterStore = create<FreighterWalletState>()(storeCreator);
export const isValidStellarPublicKey = isValidStellarAddress;

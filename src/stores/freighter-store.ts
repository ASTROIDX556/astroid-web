'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FreighterConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type StellarWalletNetwork = 'testnet' | 'mainnet';

export interface WalletState {
  status: FreighterConnectionStatus;
  isInstalled: boolean;
  publicKey: string | null;
  network: string | null;
  error: string | null;
}

export interface WalletActions {
  checkExtension: () => Promise<boolean>;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  updatePublicKey: (publicKey: string | null) => void;
  refreshNetwork: () => Promise<StellarWalletNetwork | null>;
  switchNetwork: (network: StellarWalletNetwork) => Promise<boolean>;
  requestSignature: (xdr: string) => Promise<string>;
  hydrate: () => Promise<void>;
}

export interface FreighterWalletState extends WalletState, WalletActions {}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const withTimeout = async <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return await new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          'Freighter wallet request timed out. Check that the extension is installed and unlocked.',
        ),
      );
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

const getFreighter = async () =>
  (await import('@stellar/freighter-api')) as unknown as {
    isConnected?: () => Promise<boolean | { isConnected?: boolean }>;
    setAllowed?: () => Promise<boolean | { isAllowed?: boolean }>;
    getAddress?: () => Promise<string | { address?: string; publicKey?: string }>;
    getNetwork?: () => Promise<string | { network?: string }>;
    setNetwork?: (network: 'TESTNET' | 'PUBLIC') => Promise<unknown>;
    signTransaction?: (
      xdr: string,
      options?: Record<string, unknown>,
    ) => Promise<string | { signedTxXdr?: string; signedXDR?: string; xdr?: string }>;
  };

const isValidStellarAddress = (value: string | null | undefined): value is string =>
  typeof value === 'string' && STELLAR_ADDRESS_RE.test(value);

const resolveWalletAddress = (value: unknown): string | null => {
  if (typeof value === 'string') return isValidStellarAddress(value) ? value : null;
  if (value && typeof value === 'object') {
    const candidate =
      (value as { address?: string; publicKey?: string }).address ??
      (value as { address?: string; publicKey?: string }).publicKey;
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

const normalizeNetwork = (value: string | null): StellarWalletNetwork | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('test')) return 'testnet';
  if (normalized === 'public' || normalized.includes('main')) return 'mainnet';
  return null;
};

let connectionAttempt = 0;

export const useFreighterStore = create<FreighterWalletState>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      isInstalled: false,
      publicKey: null,
      network: null,
      error: null,

      checkExtension: async () => {
        try {
          const freighter = await getFreighter();
          const connectedResult =
            typeof freighter.isConnected === 'function'
              ? await withTimeout(freighter.isConnected())
              : { isConnected: true };
          const connected =
            typeof connectedResult === 'boolean'
              ? connectedResult
              : Boolean(
                  (connectedResult as { isConnected?: boolean } | undefined)
                    ?.isConnected,
                );
          set({
            isInstalled: true,
            status: connected ? 'connected' : 'disconnected',
            ...(connected ? {} : { publicKey: null, network: null }),
          });
          return Boolean(connected);
        } catch {
          set({
            isInstalled: false,
            status: 'disconnected',
            publicKey: null,
            network: null,
            error: 'Freighter extension is not installed or unavailable.',
          });
          return false;
        }
      },

      connect: async () => {
        const attempt = ++connectionAttempt;
        set({ status: 'connecting', error: null });

        try {
          const freighter = await getFreighter();
          const installed =
            typeof window !== 'undefined' &&
            !!(window as typeof window & { freighter?: unknown }).freighter;
          if (!installed && typeof freighter.isConnected !== 'function') {
            if (attempt !== connectionAttempt) return null;
            set({
              isInstalled: false,
              status: 'disconnected',
              error: 'Freighter extension is not installed.',
            });
            return null;
          }

          if (typeof freighter.setAllowed === 'function') {
            const allowed = await withTimeout(freighter.setAllowed());
            const isAllowed =
              typeof allowed === 'boolean'
                ? allowed
                : Boolean((allowed as { isAllowed?: boolean })?.isAllowed);
            if (!isAllowed) {
              throw new Error(
                'Freighter access was rejected. Please approve the connection request.',
              );
            }
          }

          const addressResult =
            typeof freighter.getAddress === 'function'
              ? await withTimeout(freighter.getAddress())
              : null;
          const publicKey = resolveWalletAddress(addressResult);
          if (!publicKey) {
            throw new Error('Freighter did not return a valid Stellar public key.');
          }

          const networkResult =
            typeof freighter.getNetwork === 'function'
              ? await withTimeout(freighter.getNetwork())
              : null;
          const network = resolveNetwork(networkResult) ?? 'testnet';

          if (attempt !== connectionAttempt) return null;

          set({
            status: 'connected',
            isInstalled: true,
            publicKey,
            network,
            error: null,
          });

          return publicKey;
        } catch (error) {
          if (attempt !== connectionAttempt) return null;
          const message =
            error instanceof Error
              ? error.message
              : 'Unable to connect to the Freighter wallet.';
          set({
            status: 'disconnected',
            isInstalled: true,
            publicKey: null,
            network: null,
            error: message,
          });
          return null;
        }
      },

      disconnect: () => {
        connectionAttempt += 1;
        set({ status: 'disconnected', publicKey: null, network: null, error: null });
      },

      updatePublicKey: (publicKey) => {
        if (publicKey !== null && !isValidStellarAddress(publicKey)) {
          throw new Error('A valid Stellar public key is required.');
        }
        connectionAttempt += 1;
        set({ publicKey, status: publicKey ? 'connected' : 'disconnected' });
        if (!publicKey) set({ network: null });
      },

      refreshNetwork: async () => {
        const publicKey = get().publicKey;
        if (!publicKey || get().status !== 'connected') return null;

        try {
          const freighter = await getFreighter();
          const result =
            typeof freighter.getNetwork === 'function'
              ? await withTimeout(freighter.getNetwork())
              : null;
          const network = normalizeNetwork(resolveNetwork(result));
          if (
            network &&
            get().publicKey === publicKey &&
            get().status === 'connected'
          ) {
            set({ network, error: null });
          }
          return network;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Unable to read the Freighter network.',
          });
          return null;
        }
      },

      switchNetwork: async (network) => {
        if (get().status !== 'connected') {
          set({ error: 'Connect a Freighter wallet before switching networks.' });
          return false;
        }

        try {
          const freighter = await getFreighter();
          if (typeof freighter.setNetwork !== 'function') {
            throw new Error(
              'Switch networks in Freighter, then refresh the wallet network.',
            );
          }
          await withTimeout(
            freighter.setNetwork(network === 'testnet' ? 'TESTNET' : 'PUBLIC'),
          );
          const activeNetwork = await get().refreshNetwork();
          if (activeNetwork !== network) {
            throw new Error('Freighter did not switch to the requested network.');
          }
          set({ error: null });
          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Unable to switch the Freighter network.',
          });
          return false;
        }
      },

      requestSignature: async (xdr: string) => {
        if (!xdr || !xdr.trim()) {
          throw new Error('Transaction XDR is required to request a signature.');
        }

        try {
          const freighter = await getFreighter();
          if (typeof freighter.signTransaction !== 'function') {
            throw new Error('Freighter does not expose transaction signing support.');
          }

          const response = await withTimeout(freighter.signTransaction(xdr));
          const signedXdr =
            typeof response === 'string'
              ? response
              : ((
                  response as { signedTxXdr?: string; signedXDR?: string; xdr?: string }
                )?.signedTxXdr ??
                (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })
                  ?.signedXDR ??
                (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })
                  ?.xdr);

          if (!signedXdr) {
            throw new Error('Freighter did not return a signed transaction payload.');
          }

          return signedXdr;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Signature request failed.';
          set({ error: message });
          throw error;
        }
      },

      hydrate: async () => {
        try {
          const freighter = await getFreighter();
          const connectedResult =
            typeof freighter.isConnected === 'function'
              ? await withTimeout(freighter.isConnected()).catch(() => false)
              : false;
          const isConnected =
            typeof connectedResult === 'boolean'
              ? connectedResult
              : Boolean(
                  (connectedResult as { isConnected?: boolean } | undefined)
                    ?.isConnected,
                );
          const walletAddress = isConnected
            ? resolveWalletAddress(
                typeof freighter.getAddress === 'function'
                  ? await withTimeout(freighter.getAddress()).catch(() => null)
                  : null,
              )
            : null;

          if (!walletAddress) {
            set({
              status: 'disconnected',
              publicKey: null,
              network: null,
              isInstalled: false,
              error: null,
            });
            return;
          }

          const network = resolveNetwork(
            typeof freighter.getNetwork === 'function'
              ? await withTimeout(freighter.getNetwork()).catch(() => null)
              : null,
          );

          set({
            isInstalled: true,
            status: 'connected',
            publicKey: walletAddress,
            network: network ?? 'testnet',
            error: null,
          });
        } catch {
          set({
            status: 'disconnected',
            publicKey: null,
            network: null,
            isInstalled: false,
            error: null,
          });
        }
      },
    }),
    {
      name: 'astroid-freighter-wallet',
      version: 1,
      partialize: ({ publicKey, network, isInstalled }) => ({
        publicKey,
        network,
        isInstalled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.publicKey) void state.hydrate();
      },
    },
  ),
);
export const isValidStellarPublicKey = isValidStellarAddress;

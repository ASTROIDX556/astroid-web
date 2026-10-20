'use client';

import { create } from 'zustand';
import type { StateCreator } from 'zustand';

export type FreighterConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface FreighterWalletState {
  status: FreighterConnectionStatus;
  isInstalled: boolean;
  publicKey: string | null;
  network: string | null;
  error: string | null;
  checkExtension: () => Promise<boolean>;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  requestSignature: (xdr: string) => Promise<string>;
  hydrate: () => Promise<void>;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

const withTimeout = async <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return await new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Freighter wallet request timed out. Check that the extension is installed and unlocked.'));
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
    signTransaction?: (xdr: string, options?: Record<string, unknown>) => Promise<string | { signedTxXdr?: string; signedXDR?: string; xdr?: string }>;
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

const storeCreator: StateCreator<FreighterWalletState> = (set) => ({
  status: 'disconnected',
  isInstalled: false,
  publicKey: null,
  network: null,
  error: null,

  checkExtension: async () => {
    try {
      const freighter = await getFreighter();
      const connectedResult = typeof freighter.isConnected === 'function' ? await withTimeout(freighter.isConnected()) : { isConnected: true };
      const connected = typeof connectedResult === 'boolean' ? connectedResult : Boolean((connectedResult as { isConnected?: boolean } | undefined)?.isConnected);
      set({ isInstalled: true, status: connected ? 'connected' : 'disconnected' });
      return Boolean(connected);
    } catch {
      set({ isInstalled: false, status: 'disconnected', error: 'Freighter extension is not installed or unavailable.' });
      return false;
    }
  },

  connect: async () => {
    set({ status: 'connecting', error: null });

    try {
      const freighter = await getFreighter();
      const installed = typeof window !== 'undefined' && !!(window as typeof window & { freighter?: unknown }).freighter;
      if (!installed && typeof freighter.isConnected !== 'function') {
        set({ isInstalled: false, status: 'disconnected', error: 'Freighter extension is not installed.' });
        return null;
      }

      if (typeof freighter.setAllowed === 'function') {
        const allowed = await withTimeout(freighter.setAllowed());
        const isAllowed = typeof allowed === 'boolean' ? allowed : Boolean((allowed as { isAllowed?: boolean })?.isAllowed);
        if (!isAllowed) {
          throw new Error('Freighter access was rejected. Please approve the connection request.');
        }
      }

      const addressResult = typeof freighter.getAddress === 'function' ? await withTimeout(freighter.getAddress()) : null;
      const publicKey = resolveWalletAddress(addressResult);
      if (!publicKey) {
        throw new Error('Freighter did not return a valid Stellar public key.');
      }

      const networkResult = typeof freighter.getNetwork === 'function' ? await withTimeout(freighter.getNetwork()) : null;
      const network = resolveNetwork(networkResult) ?? 'testnet';

      set({ status: 'connected', isInstalled: true, publicKey, network, error: null });
      return publicKey;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect Freighter wallet.';
      set({ status: 'disconnected', error: message });
      return null;
    }
  },

  disconnect: () => {
    set({ status: 'disconnected', publicKey: null, network: null, error: null });
  },

  requestSignature: async (xdr: string) => {
    const freighter = await getFreighter();
    if (typeof freighter.signTransaction !== 'function') {
      throw new Error('Freighter signTransaction is not available.');
    }
    const res = await withTimeout(freighter.signTransaction(xdr));
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object') {
      const signed = (res as { signedTxXdr?: string; signedXDR?: string; xdr?: string }).signedTxXdr
        ?? (res as { signedTxXdr?: string; signedXDR?: string; xdr?: string }).signedXDR
        ?? (res as { signedTxXdr?: string; signedXDR?: string; xdr?: string }).xdr;
      if (typeof signed === 'string') return signed;
    }
    throw new Error('Freighter did not return a signed transaction.');
  },

  hydrate: async () => {
    try {
      const freighter = await getFreighter();
      if (typeof freighter.isConnected === 'function') {
        const connectedResult = await withTimeout(freighter.isConnected()).catch(() => false);
        const connected = typeof connectedResult === 'boolean' ? connectedResult : Boolean((connectedResult as { isConnected?: boolean })?.isConnected);
        if (connected && typeof freighter.getAddress === 'function') {
          const addressResult = await withTimeout(freighter.getAddress()).catch(() => null);
          const publicKey = resolveWalletAddress(addressResult);
          if (publicKey) {
            const networkResult = typeof freighter.getNetwork === 'function' ? await withTimeout(freighter.getNetwork()).catch(() => null) : null;
            const network = resolveNetwork(networkResult) ?? 'testnet';
            set({ status: 'connected', isInstalled: true, publicKey, network });
            return;
          }
        }
        set({ isInstalled: true, status: 'disconnected' });
      }
    } catch {
      set({ isInstalled: false, status: 'disconnected' });
    }
  },
});

import { persist } from 'zustand/middleware';

export const useFreighterStore = create<FreighterWalletState>()(
  persist(storeCreator, {
    name: 'freighter-wallet-storage',
    partialize: (state) => ({
      status: state.status,
      publicKey: state.publicKey,
      network: state.network,
      isInstalled: state.isInstalled,
    }),
  }),
);

export const isValidStellarPublicKey = isValidStellarAddress;

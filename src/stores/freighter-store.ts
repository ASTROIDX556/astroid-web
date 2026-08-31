'use client';

import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { Server, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from '@stellar/stellar-sdk';
import { z } from 'zod';

export type FreighterConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type AccountBalance = {
  asset_code?: string;
  asset_issuer?: string;
  asset_type: string;
  balance: string;
  limit?: string;
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
  is_clawback_enabled?: boolean;
};

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
  balances: AccountBalance[];
  balancesLoading: boolean;
  loadBalances: () => Promise<void>;
  addTrustline: (params: { assetCode: string; issuer: string }) => Promise<void>;
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const ASSET_CODE_RE = /^[A-Za-z0-9]{1,12}$/;

export const stellarPublicKeySchema = z.string().regex(STELLAR_ADDRESS_RE);
export const assetCodeSchema = z.string().regex(ASSET_CODE_RE);

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
  typeof value === 'string' && stellarPublicKeySchema.safeParse(value).success;

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

const getHorizonUrl = (network: string): string =>
  network === 'mainnet' || network === 'public' || network === 'PUBLIC' || network === Networks.PUBLIC ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org';

const getNetworkPassphrase = (network: string): string =>
  network === 'mainnet' || network === 'public' || network === 'PUBLIC' || network === Networks.PUBLIC ? Networks.PUBLIC : Networks.TESTNET;

const getServer = (network: string): Server => new Server(getHorizonUrl(network));

const storeCreator: StateCreator<FreighterWalletState> = (set, get) => ({
  status: 'disconnected',
  isInstalled: false,
  publicKey: null,
  network: null,
  error: null,
  balances: [],
  balancesLoading: false,

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

    const installed = typeof window !== 'undefined' && !!(window as typeof window & { freighter?: unknown }).freighter;
    try {
      const freighter = await getFreighter();
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

      set({
        status: 'connected',
        isInstalled: true,
        publicKey,
        network,
        error: null,
      });

      return publicKey;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to the Freighter wallet.';
      set({
        status: 'disconnected',
        isInstalled: installed,
        publicKey: null,
        network: null,
        error: message,
      });
      return null;
    }
  },

  disconnect: () => {
    set({ status: 'disconnected', publicKey: null, network: null, error: null, balances: [], balancesLoading: false });
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
          : (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedTxXdr ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.signedXDR ??
            (response as { signedTxXdr?: string; signedXDR?: string; xdr?: string })?.xdr;

      if (!signedXdr) {
        throw new Error('Freighter did not return a signed transaction payload.');
      }

      return signedXdr;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signature request failed.';
      set({ error: message });
      throw error;
    }
  },

  hydrate: async () => {
    await get().checkExtension();
    const freighter = await getFreighter();
    const walletAddress = resolveWalletAddress(
      typeof freighter.getAddress === 'function' ? await withTimeout(freighter.getAddress()).catch(() => null) : null,
    );

    if (!walletAddress) {
      set({ status: 'disconnected', publicKey: null, network: null, error: null });
      return;
    }

    const network = resolveNetwork(
      typeof freighter.getNetwork === 'function' ? await withTimeout(freighter.getNetwork()).catch(() => null) : null,
    );

    set({
      isInstalled: true,
      status: 'connected',
      publicKey: walletAddress,
      network: network ?? 'testnet',
      error: null,
    });
  },

  loadBalances: async () => {
    const { publicKey, network } = get();
    if (!publicKey) {
      set({ balances: [], balancesLoading: false });
      return;
    }

    set({ balancesLoading: true, error: null });
    try {
      const server = getServer(network ?? 'testnet');
      const account = await server.loadAccount(publicKey);
      set({ balances: account.balances as AccountBalance[], balancesLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load account balances.';
      set({ balances: [], balancesLoading: false, error: message });
      throw error;
    }
  },

  addTrustline: async ({ assetCode, issuer }: { assetCode: string; issuer: string }) => {
    const { publicKey, network, requestSignature } = get();
    if (!publicKey) {
      throw new Error('No wallet connected.');
    }

    const server = getServer(network ?? 'testnet');
    const networkPassphrase = getNetworkPassphrase(network ?? 'testnet');

    try {
      const assetCodeResult = assetCodeSchema.safeParse(assetCode);
      const issuerResult = stellarPublicKeySchema.safeParse(issuer);
      if (!assetCodeResult.success || !issuerResult.success) {
        throw new Error('Invalid asset code or issuer address.');
      }

      const account = await server.loadAccount(publicKey);
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase,
      })
        .addOperation(Operation.changeTrust({ asset: new Asset(assetCode, issuer) }))
        .setTimeout(30)
        .build();

      const signedXdr = await requestSignature(transaction.toXDR());
      await server.submitTransaction(signedXdr);
      try {
        await get().loadBalances();
      } catch {
        // Balance refresh is best-effort; the trustline transaction succeeded.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add trustline.';
      set({ error: message });
      throw error;
    }
  },
});

export const useFreighterStore = create<FreighterWalletState>()(storeCreator);
export const isValidStellarPublicKey = isValidStellarAddress;

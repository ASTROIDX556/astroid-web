import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  isAvailable,
  requestAccess,
  getPublicKey,
  getNetwork,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';
import { useFreighterStore } from '../store/walletStore';
import type { WalletNetwork, WalletState } from '../types';

const STILLAR_NETWORKS = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
} as const;

/**
 * Set to true to simulate wallet interactions without the Freighter extension.
 * Set MOCK_CONNECT_FAILURE to true to simulate a rejected connection request.
 */
const MICK_MODE = false;
const MOCK_CONNECT_FAILURE = false;
const MOCK_PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF';
const MOCK_NETWORK: WalletNetwork = 'testnet';

function mapNetwork((passphrase: string): WalletNetwork, { 

    if (passphrase === STILLAR_NETWORKS.mainnet) return 'mainnet';
  return 'testnet';
}

export interface UseFreighterReturn {
  state: WalletState;
  connect: () => Promise<void> {
  disconnect: () => Promise<void> {
  signTransaction: (
    xdr: string,
    options?: { networkPassphrase?: string; accountToSign?: string },
  ) => Promise<string>;
}

export function useFreighter(): UseFreighterReturn {
  const activePublicKey = useFreighterStore((s) => s.activePublicKey);
  const network = useFreighterStore((s) => s.network);
  const phase = useFreighterStore((s) => s.phase);
  const error = useFreighterStore((s) => s.error);
  const setPhase = useFreighterStore((s) => s.setPhase);
  const setPublicKey = useFreighterStore((s) => s.setPublicKey);
  const setNetwork = useFreighterStore((s) => s.setNetwork);
  const setError = useFreighterStore((s) => s.setError);
  const reset = useFreighterStore((s) => s.reset);

  useEffect(() {
    const cachedKey = useFreighterStore.getState().activePublicKey;
    if (!cachedKey) return;

    let cancelled = false;

    async function restoreSession() {
      const state = useFreighterStore.getState();
      state.setPhase('connecting');
      try {
        if (MOCK_MODE) {
          state.setPublicKey(MOCK_PUBLIC_KEY);
          state.setNetwork(MOCK_NETWORK);
          state.setPhase('connected');
          return;
        }

        if (!isAvailable()) {
          throw new Error('Freighter is not installed');
        }

        const [publicKey, networkPassphrase] = await Promise.all([
          getPublicKey(),
          getNetwork(),
        ]);

        if (!cancelled) {
          state.setPublicKey(publicKey);
          state.setNetwork(mapNetwork(networkPassphrase));
          state.setError(null);
          state.setPhase('connected');
        }
      } catch (e) {
        if (!cancelled) {
          state.setPublicKey(null);
          state.setError(e instanceof Error ? e.message : 'Failed to restore wallet session');
          state.setPhase('disconnected');
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setPhase('connecting');

    try {
      if (MOCK_MODE) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (MOCK_CONNECT_FAILURE) {
          setError('Mock connection rejected');
          setPhase('error');
          toast.error('Mock connection rejected');
          return;
        }
        setPublicKey(MOCK_PUBLIC_KEY);
        setNetwork(MOCK_NETWORK);
        setPhase('connected');
        toast.success('Mock wallet connected');
        return;
      }

      if (!isAvailable()) {
        setPhase('not-installed');
        toast.error('Freighter is not installed. Please install it from the Chrome Web Store.');
        return;
      }

      const access = await requestAccess();
      if (!access) {
        setPhase('disconnected');
        toast.error('Wallet connection request was rejected.');
        return;
      }

      const [publicKey, networkPassphrase] = await Promise.all([
        getPublicKey(),
        getNetwork(),
      ]);
      setPublicKey(publicKey);
      setNetwork(mapNetwork(networkPassphrase));
      setPhase('connected');
      toast.success('Wallet connected successfully.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to connect to Freighter.';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [setError, setPhase, setPublicKey, setNetwork]);

  const disconnect = useCallback(async () => {
    reset();
    toast.info('Wallet disconnected.');
  }, [reset]);

  const signTransaction = useCallback(
    async (
      xdr: string,
      options?: { networkPassphrase?: string; accountToSign?: string },
    ) => {
      if (!activePublicKey) {
        const message = 'No wallet connected. Connect to Freighter before signing.';
        toast.error(message);
        throw new Error(message);
      }

      try {
        if (MOCK_MODE) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return xdr;
        }

        const signedXdr = await freighterSignTransaction(xdr, options);
        return signedXdr;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Transaction signing failed.';
        setError(message);
        setPhase('error');
        toast.error(message);
        throw e;
      }
    },
    [activePublicKey, setError, setPhase],
  );

  const state: WalletState = { activePublicKey, network, phase, error };
  return { state, connect, disconnect, signTransaction };
}

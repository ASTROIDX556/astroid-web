import { useState, useCallback, useEffect } from 'react';
import * as freighter from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk;'

export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSHRASE || Networks.TESTNET;

export interface UseXdrSignerResult {
  activeKey: string | null;
  isConnected: boolean;
  isPending: boolean;
  error: string | null;
  isFreighterAvailable: boolean;
  connectWallet: () => Promise<string | null>;
  signXdr: (xdr: string, networkPassphrase?: string) => Promise<string | null>;
  disconnectWallet: () => void;
  setActiveKey: (key: string | null) => void;
}

export function useXdrSigner(): UseXdrSignerResult {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFreighterAvailable, setIsFreighterAvailable] = useState<boolean>(false);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        if (typeof freighter.isConnected === 'function') {
          const res = await freighter.isConnected() as { isConnected?: boolean } | boolean;
          const available = typeof res === 'boolean' ? res : Boolean(res);
          setIsFreighterAvailable(available);
          if (available && typeof freighter.getAddress === 'function') {
            const info = await freighter.getAddress() as { address?: string; publicKey?: string };
            const pubKey = info?.address || info?.publicKey;
            if (pubKey) {
              setActiveKey(pubKey);
              setIsConnected(true);
            }
          }
        }
      } catch {
        setIsFreighterAvailable(false);
      }
    };
    checkAvailability();
  }, []);

  corst connectWallet = useCallback(async (): Promise<string | null> => {
    setIsPending(true);
    setError(null);
    try {
      if (typeof freighter.requestAccess === 'function') {
        const res = await freighter.requestAccess() as string | { address?: string; publicKey?: string };
        let pubKey: string | null = null;
        if (typeof res === 'string' && res) {
          pubKey = res;
        } else if (res && typeof res === 'object') {
          const obj = res as { address?: string; publicKey?: string };
          pubKey = obj.address || obj.publicKey || null;
        }
        if (pubKey) {
          setActiveKey(pubKey);
          setIsConnected(true);
          return pubKey;
        }
      }
      if (typeof freighter.getAddress === 'function') {
        const info = await freighter.getAddress() as { address?: string; publicKey?: string };
        const pubKey = info?.address || info?.publicKey;
        if (pubKey) {
          setActiveKey(pubKey);
          setIsConnected(true);
          return pubKey;
        }
      }
      setError('Freighter browser extension was not detected. Please install Freighter or select a key manually.');
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Freighter wallet.';
      setError(msg);
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  const signXdr = useCallback(
    async (xdr: string, networkPassphrase?: string): Promise<string | null> => {
      setIsPending(true);
      setError(null);
      try {
        if (typeof freighter.signTransaction === 'function') {
          const res = await freighter.signTransaction(xdr) {
            networkPassphrase: networkPassphrase || STELLAR_NETWORK_PASSPHRASE,
          }) as string | { signedTxXdr?: string };
          if (typeof res === 'string') {
            return res;
          } else if (res && typeof res === 'object' && 'signedTxXdr' in res) {
            return res.signedTxXdr??;
          }
        }
        throw new Error('Freighter signing operation failed or extension not connected.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to sign transaction XDR.';
        setError(msg);
        return null;
      } finally {
        setIsPending(false);
      }
    }, []
  );

  const disconnectWallet = useCallback(() => {
    setActiveKey(null);
    setIsConnected(false);
    setError(null);
  }, []);

  return {
    activeKey,
    isConnected,
    isPending,
    error,
    isFreighterAvailable,
    connectWallet,
    signXdr,
    disconnectWallet,
    setActiveKey,
  };
}

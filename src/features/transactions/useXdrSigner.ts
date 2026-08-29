import { useState, useCallback, useEffect } from 'react';
import * as freighter from '@stellar/freighter-api';

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
          const res = await freighter.isConnected();
          const available = typeof res === 'boolean' ? res : Boolean(res?.isConnected);
          setIsFreighterAvailable(available);
          if (available && typeof freighter.getAddress === 'function') {
            const info = await freighter.getAddress();
            if (info?.address) {
              setActiveKey(info.address);
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

  const connectWallet = useCallback(async (): Promise<string | null> => {
    setIsPending(true);
    setError(null);
    try {
      if (typeof freighter.requestAccess === 'function') {
        const res = await freighter.requestAccess();
        if (typeof res === 'string' && res) {
          setActiveKey(res);
          setIsConnected(true);
          return res;
        } else if (res && typeof res === 'object' && 'address' in res && res.address) {
          const addr = (res as { address: string }).address;
          setActiveKey(addr);
          setIsConnected(true);
          return addr;
        }
      }
      if (typeof freighter.getAddress === 'function') {
        const info = await freighter.getAddress();
        if (info?.address) {
          setActiveKey(info.address);
          setIsConnected(true);
          return info.address;
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
          const res = await freighter.signTransaction(xdr, {
            networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
          });
          if (typeof res === 'string') {
            return res;
          } else if (res && typeof res === 'object' && 'signedTxXdr' in res) {
            return res.signedTxXdr;
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
    },
    []
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

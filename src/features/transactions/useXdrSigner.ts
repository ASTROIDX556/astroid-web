import { useState, useCallback, useEffect } from 'react';
import * as freighter from '@stellar/freighter-api';

export type XdrSigningStatus = 'idle' | 'requesting' | 'signing' | 'signed' | 'failed' | 'rejected';

export interface UseXdrSignerResult {
  activeKey: string | null;
  isConnected: boolean;
  isPending: boolean;
  status: XdrSigningStatus;
  error: string | null;
  isFreighterAvailable: boolean;
  connectWallet: () => Promise<string | null>;
  signXdr: (xdr: string, networkPassphrase?: string) => Promise<string | null>;
  disconnectWallet: () => void;
  setActiveKey: (key: string | null) => void;
  beginMockSignature: () => void;
  completeMockSignature: () => void;
}

function isUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /reject|denied|cancelled|canceled|declined/i.test(message);
}

export function useXdrSigner(): UseXdrSignerResult {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [status, setStatus] = useState<XdrSigningStatus>('idle');
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
    setStatus('requesting');
    setError(null);
    try {
      if (typeof freighter.requestAccess === 'function') {
        const res = await freighter.requestAccess();
        if (typeof res === 'string' && res) {
          setActiveKey(res);
          setIsConnected(true);
          setStatus('idle');
          return res;
        } else if (res && typeof res === 'object' && 'address' in res && res.address) {
          const addr = (res as { address: string }).address;
          setActiveKey(addr);
          setIsConnected(true);
          setStatus('idle');
          return addr;
        }
      }
      if (typeof freighter.getAddress === 'function') {
        const info = await freighter.getAddress();
        if (info?.address) {
          setActiveKey(info.address);
          setIsConnected(true);
          setStatus('idle');
          return info.address;
        }
      }
      setStatus('failed');
      setError('Freighter browser extension was not detected. Please install Freighter or select a key manually.');
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect Freighter wallet.';
      setError(msg);
      setStatus(isUserRejection(err) ? 'rejected' : 'failed');
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  const signXdr = useCallback(
    async (xdr: string, networkPassphrase?: string): Promise<string | null> => {
      setIsPending(true);
      setStatus('signing');
      setError(null);
      try {
        if (typeof freighter.signTransaction === 'function') {
          const res = await freighter.signTransaction(xdr, {
            networkPassphrase: networkPassphrase || 'Test SDF Network ; September 2015',
          });
          if (typeof res === 'string') {
            setStatus('signed');
            return res;
          } else if (res && typeof res === 'object' && 'signedTxXdr' in res) {
            setStatus('signed');
            return res.signedTxXdr;
          }
        }
        throw new Error('Freighter signing operation failed or extension not connected.');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to sign transaction XDR.';
        setError(msg);
        setStatus(isUserRejection(err) ? 'rejected' : 'failed');
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
    setStatus('idle');
    setError(null);
  }, []);

  const beginMockSignature = useCallback(() => {
    setIsPending(true);
    setError(null);
    setStatus('signing');
  }, []);

  const completeMockSignature = useCallback(() => {
    setIsPending(false);
    setError(null);
    setStatus('signed');
  }, []);

  return {
    activeKey,
    isConnected,
    isPending,
    status,
    error,
    isFreighterAvailable,
    connectWallet,
    signXdr,
    disconnectWallet,
    setActiveKey,
    beginMockSignature,
    completeMockSignature,
  };
}

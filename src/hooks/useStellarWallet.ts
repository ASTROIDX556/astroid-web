'use client';

import { useCallback, useEffect, useState } from 'react';

export type StellarWalletStatus = 'idle' | 'checking' | 'connected' | 'missing' | 'error';

type FreighterModule = typeof import('@stellar/freighter-api');

const withTimeout = async <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Freighter timed out. Install the extension or unlock it before continuing.'));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};

async function loadFreighter(): Promise<FreighterModule | null> {
  if (typeof window === 'undefined') return null;

  try {
    const api = await import('@stellar/freighter-api');
    return api;
  } catch {
    return null;
  }
}

export function useStellarWallet() {
  const [status, setStatus] = useState<StellarWalletStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshConnection = useCallback(async () => {
    const api = await loadFreighter();
    if (!api) {
      setStatus('missing');
      setPublicKey(null);
      setError('Freighter is not installed. Please install the wallet extension and try again.');
      return false;
    }

    try {
      const connected = await withTimeout(api.isConnected());
      setStatus(connected ? 'connected' : 'idle');
      if (connected) {
        const address = await withTimeout(api.getAddress());
        const nextKey = typeof address === 'string' ? address : address?.address ?? null;
        setPublicKey(nextKey);
        setError(null);
      }
      return Boolean(connected);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not connect to the Freighter wallet.');
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  const connect = useCallback(async () => {
    const api = await loadFreighter();
    if (!api) {
      setStatus('missing');
      setError('Freighter is not installed. Please install the wallet extension and try again.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const allowed = await withTimeout(api.setAllowed());
      const isAllowed =
        typeof allowed === 'boolean'
          ? allowed
          : (allowed as { isAllowed?: boolean } | null)?.isAllowed ?? false;

      if (!isAllowed) {
        throw new Error('Freighter approval was rejected. Please approve the connection in the browser extension.');
      }

      const address = await withTimeout(api.getAddress());
      const nextKey = typeof address === 'string' ? address : address?.address ?? null;

      setPublicKey(nextKey);
      setStatus(nextKey ? 'connected' : 'idle');
      return nextKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Freighter connection failed.';
      setStatus('error');
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    const api = await loadFreighter();
    if (!api) {
      setStatus('missing');
      setError('Freighter is not installed. Please install the wallet extension and try again.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await withTimeout(api.signTransaction(xdr));
      const signature =
        typeof response === 'string'
          ? response
          : (response as { signedTxXdr?: string } | null)?.signedTxXdr ?? null;

      setStatus(signature ? 'connected' : 'idle');
      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction signing failed.';
      setStatus('error');
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    status,
    publicKey,
    error,
    isLoading,
    isAvailable: status !== 'missing' && status !== 'error',
    isConnected: status === 'connected',
    refreshConnection,
    connect,
    signTransaction,
  };
}

export default useStellarWallet;

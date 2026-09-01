'use client';

import { useCallback, useEffect, useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { z } from 'zod';

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

const trustlineSchema = z.object({
  assetCode: z.string().min(1, 'Asset code is required.').max(12).regex(/^[a-zA-Z0-9]{1,12}$/, 'Invalid asset code.'),
  issuer: z.string().regex(/^G[2-7A-H-J-NP-Z]{55}$/, 'Invalid Stellar public key.'),
});

export type AccountBalance = {
  assetCode: string;
  assetIssuer: string | null;
  balance: string;
  limit?: string;
};

export function useStellarWallet() {
  const [status, setStatus] = useState<StellarWalletStatus>('checking');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [isBalancesLoading, setIsBalancesLoading] = useState(false);

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
      } else {
        setPublicKey(null);
        setBalances([]);
      }
      return Boolean(connected);
    } catch (err) {
      setStatus('error');
      setPublicKey(null);
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
      if (!nextKey) {
        setBalances([]);
      }
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

  const signTransaction = useCallback(async (xdr: string, networkPassphrase?: string) => {
    const api = await loadFreighter();
    if (!api) {
      setStatus('missing');
      setError('Freighter is not installed. Please install the wallet extension and try again.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = networkPassphrase
        ? await withTimeout(api.signTransaction(xdr, { networkPassphrase }))
        : await withTimeout(api.signTransaction(xdr));
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

  const getNetworkDetails = useCallback(async () => {
    const api = await loadFreighter();
    if (!api) {
      setStatus('missing');
      setError('Freighter is not installed.');
      return null;
    }

    try {
      const network = await withTimeout(api.getNetwork());
      if (typeof network === 'string') {
        const networkName = network.toUpperCase();
        const isTestnet = networkName === 'TESTNET' || networkName.includes('TESTNET');
        return {
          networkUrl: isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org',
          networkPassphrase: isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC,
        };
      }
      return {
        networkUrl: network.networkUrl,
        networkPassphrase: network.networkPassphrase,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch network details.');
      return null;
    }
  }, []);

  const getAccountBalances = useCallback(async (): Promise<AccountBalance[] | null> => {
    if (!publicKey) {
      setError('No connected wallet address.');
      return null;
    }

    const network = await getNetworkDetails();
    if (!network) return null;

    try {
      const server = new StellarSdk.Server(network.networkUrl);
      const account = await server.loadAccount(publicKey);
      const nextBalances = account.balances.map((balance) => {
        if (balance.asset_type === 'native') {
          return {
            assetCode: 'XLM',
            assetIssuer: null,
            balance: balance.balance,
            limit: undefined,
          };
        }
        const assetLine = balance as StellarSdk.Horizon.BalanceLineAsset;
        return {
          assetCode: assetLine.asset_code,
          assetIssuer: assetLine.asset_issuer,
          balance: balance.balance,
          limit: assetLine.limit,
        };
      });
      setBalances(nextBalances);
      return nextBalances;
    } catch (err) {
      setBalances([]);
      setError(err instanceof Error ? err.message : 'Failed to load account balances.');
      return null;
    }
  }, [publicKey, getNetworkDetails]);

  useEffect(() => {
    if (publicKey) {
      void getAccountBalances();
    } else {
      setBalances([]);
    }
  }, [publicKey, getAccountBalances]);

  const addTrustline = useCallback(
    async (assetCode: string, issuer: string): Promise<string | null> => {
      if (!publicKey) {
        setError('No connected wallet address.');
        return null;
      }

      const parsed = trustlineSchema.safeParse({ assetCode, issuer });
      if (!parsed.success) {
        setError(parsed.error.issues.map((i) => i.message).join(', '));
        return null;
      }

      const network = await getNetworkDetails();
      if (!network) return null;

      try {
        const server = new StellarSdk.Server(network.networkUrl);
        const account = await server.loadAccount(publicKey);
        const fee = await server.fetchBaseFee();
        const asset = new StellarSdk.Asset(assetCode, issuer);
        const transaction = new StellarSdk.TransactionBuilder(account, {
          fee: fee.toString(),
          networkPassphrase: network.networkPassphrase,
        })
          .addOperation(StellarSdk.Operation.changeTrust({ asset }))
          .setTimeout(30)
          .build();

        const xdr = transaction.toXDR();
        const signedXdr = await signTransaction(xdr, network.networkPassphrase);
        if (!signedXdr) return null;

        const result = await server.submitTransaction(signedXdr);
        return result.hash;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create trustline.');
        return null;
      }
    },
    [publicKey, getNetworkDetails, signTransaction],
  );

  const refreshBalances = useCallback(async (): Promise<AccountBalance[] | null> => {
    setIsBalancesLoading(true);
    try {
      return await getAccountBalances();
    } finally {
      setIsBalancesLoading(false);
    }
  }, [getAccountBalances]);

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
    getNetworkDetails,
    getAccountBalances,
    refreshBalances,
    balances,
    isBalancesLoading,
    addTrustline,
  };
}

export default useStellarWallet;

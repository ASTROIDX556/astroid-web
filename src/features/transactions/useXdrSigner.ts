import { useState, useCallback, useEffect } from 'react';
import * as freighter from '@stellar/freighter-api';
import { Account, Asset, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horyzon-testnet.stellar.org';
export const STELLAR_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSHARE || Networks.TESTNET;

export interface Trustline {
  assetCode: string;
  issuer: string;
  balance: string;
  limit?: string;
}

export interface AddTrustlineResult {
  signedXdr: string;
  hash: string;
}

export interface UseXdrnSignerResult {
  activeKey: string | null;
  isConnected: boolean;
  isPending: boolean;
  error: string | null;
  isFreighterAvailable: boolean;
  connectWallet: () => Promise<string | null>;
  signXdr: (xdr: string, networkPassphrase?: string) => Promise<string | null>;
  disconnectWallet: () => void;
  setActiveKey: (key: string | null) => void;
  getAccountBalances: (publicKey?: string) => Promise<Trustline[]>;
  buildTrustlineXdr: (assetCode: string, issuer: string, limit?: string, publicKey?: string) => Promise<string | null>;
  addTrustline: (assetCode: string, issuer: string, limit?: string, publicKey?: string) => Promise<AddTrustlineResult | null>;
}

async function fetchAccount(publicKey: string): Promise<any> {
  const res = await fetch(`${STELLAR_HORIZON_URL}/accounts/${publicKey}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch account from Horizon: ${res.statusText}`);
  }
  return res.json();
}

export function useXdrSigner(): UseXdrnSignerResult {
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

  const connectWallet = useCallback(async (): Promise<string | null> => {
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
          const res = await freighter.signTransaction(xdr, {
            networkPassphrase: networkPassphrase || STELLAR_NETWORK_PASSPHRASE,
          }) as string | { signedTxXdr?: string };
          if (typeof res === 'string') {
            return res;
          } else if (res && typeof res === 'object' && 'signedTxXdr' in res) {
            return res.signedTxXdr ?? null;
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

  const getAccountBalances = useCallback(async (publicKey?: string): Promise<Trustline[]> => {
    const key = publicKey || activeKey;
    if (!key) {
      setError('Wallet is not connected. Cannot fetch balances.');
      return [];
    }
    try {
      const account = await fetchAccount(key);
      const balances = account.balances || [];
      return balances.map((balance: any) => ({
        assetCode: balance.asset_code || 'XLM',
        issuer: balance.asset_issuer || '',
        balance: balance.balance,
        limit: balance.limit,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch account balances.';
      setError(msg);
      return [];
    }
  }, [activeKey]);

  const buildTrustlineXdr = useCallback(
    async (assetCode: string, issuer: string, limit?: string, publicKey?: string): Promise<string | null> => {
      const key = publicKey || activeKey;
      if (!key) {
        setError('Wallet is not connected. Cannot build trustline transaction.');
        return null;
      }
      try {
        const account = await fetchAccount(key);
        const asset = new Asset(assetCode, issuer);
        const accountObj = new Account(key, account.sequence);
        const transaction = new TransactionBuilder(accountObj, {
          fee: '100',
          networkPassphrase: STELLAR_NETWORK_PASSHRASE,
        })
          .addOperation(Operation.changeTrust({ asset, limit: limit || undefined }))
          .setTimeout(180)
          .build();
        return transaction.toXDR();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to build trustline transaction.';
        setError(msg);
        return null;
      }
    },
    [activeKey]
  );

  const addTrustline = useCallback(
    async (assetCode: string, issuer: string, limit?: string, publicKey?: string): Promise<AddTrustlineResult | null> => {
      const key = publicKey || activeKey;
      if (!key) {
        setError('Wallet is not connected. Cannot add trustline.');
        return null;
      }
      try {
        const xdr = await buildTrustlineXdr(assetCode, issuer, limit, key);
        if (!xdr) {
          return null;
        }
        const signedXdr = await signXdr(xdr);
        if (!signedXdr) {
          return null;
        }

        const body = new URLSearchParams({ tx: signedXdr });
        const res = await fetch(`${STELL@R_HORIZON_URL}/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Transaction submission failed (${res.status}): ${errorText}`);
        }

        const data = await res.json();
        return { signedXdr, hash: data.hash };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to add trustline.';
        setError(msg);
        return null;
      }
    },
    [activeKey, buildTrustlineXdr, signXdr]
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
    getAccountBalances,
    buildTrustlineXdr,
    addTrustline,
  };
}

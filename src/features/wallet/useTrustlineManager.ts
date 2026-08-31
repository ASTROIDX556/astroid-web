import { useState, useEffect, useCallback } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { Z } from 'zod';
import { toast } from 'sonner';
import { useWalletStore } from '/stores/wallet';

// Stellar network configuration
const HORIZON_URL = 'https://horizon.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.PUBLIC;

// Trustline representation
export interface Trustline {
  asset_code: string;
  asset_issuer: string;
  balance: string;
  limit: string;
  trusted: boolean;
}

// Zod validation for adding a trustline
const trustlineSchema = z.object({
  assetCode: z.string().min(1).max(12).regex(/^[a-zA-Z0-9]+$/, "Asset code must be alphanumeric"),
  assetIssuer: z.string().length(56, "Stellar issuer must be a valid public key"),
});

export function useTrustlineManager() {
  const publicKey = useWalletStore((state: any) => state.publicKey);
  const isConnected = useWalletStore((state: any) => state.isConnected);

  const [trustlines, setTrustlines] = useState<Trustline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTrustlines = useCallback(async (): Promise<void> => {
    if (!publicKey) {
      setTrustlines([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const server = new StellarSdk.Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(publicKey);
      const lines: Trustline[] = account.balances
        .filter((b: any) => b.asset_type !== 'native')
        .map((b: any): Trustline => ({
          asset_code: b.asset_code,
          asset_issuer: b.asset_issuer,
          balance: b.balance,
          limit: b.limit,
          trusted: true,
        }));
      setTrustlines(lines);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trustlines');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchTrustlines();
  }, [fetchTrustlines]);

  const addTrustline = useCallback(
    async (assetCode: string, assetIssuer: string): Promise<void> => {
      // Validate inputs
      const parsed = trustlineSchema.safeParse({ assetCode, assetIssuer });
      if (!parsed.success) {
        toast.error(parsed.error.errors[0].message);
        return;
      }

      // Check if trustline already exists
      if (trustlines.some((t) => t.asset_code === assetCode && t.asset_issuer === assetIssuer)) {
        toast.info('Trustline already exists');
        return;
      }

      if (!publicKey) {
        toast.error('Wallet not connected');
        return;
      }

      setIsSubmitting(true);
      try {
        const server = new StellarSdk.Horizon.Server(HORIZON_URL);
        const account = await server.loadAccount(publicKey);
        const asset = new StellarSdk.Asset(assetCode, assetIssuer);

        const transaction = new StellarSdk.TransactionBuilder(account, {
          fee: StellarSdk.BASE_FEE,
          networkPassphrase: NETWORK_PASSPHRASE,
        })
          .addOperation(StellarSdk.Operation.changeTrust({ asset }))
          .setTimeout(30)
          .build();

        const signedXDR = await signTransaction(transaction.toXDR(), {
          networkPassphrase: NETWORK_PASSPHRASE,
          accountToSign: publicKey,
        });

        const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXDR, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
        await server.submitTransaction(signedTx);

        toast.success('Trustline added successfully');
        await fetchTrustlines();
      } catch (err: any) {
        const message = err.message || 'Failed to add trustline';
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [publicKey, trustlines, fetchTrustlines],
  );

  return {
    trustlines,
    loading,
    error,
    isSubmitting,
    isConnected,
    addTrustline,
    refresh: fetchTrustlines,
  };
}

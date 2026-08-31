import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useWalletStore } from '/stores/wallet';
import {
  getSupportedAssetStatuses,
  buildTrustlineTransaction,
  signAndSubmitTransaction,
  SupportedAssetStatus,
} from '../../services/stellar';

export function useTrustlineManager() {
  const publicKey = useWalletStore((state: any) => state.publicKey);
  const isConnected = useWalletStore((state: any) => state.isConnected);

  const [assets, setAssets] = useState<SupportedAssetStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!publicKey) {
      setAssets([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const statuses = await getSupportedAssetStatuses(publicKey);
      setAssets(statuses);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch asset balances';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() {
    fetchAssets();
  }, [fetchAssets]);

  const addTrustline = useCallback(
    async (assetCode: string, assetIssuer: string) => {
      if (!publicKey) {
        toast.error('Wallet not connected');
        return;
      }

      const existing = assets.find(
        (a) => a.assetCode === assetCode && a.issuer === assetIssuer
      );
      if (existing?.trustlineActive) {
        toast.info('Trustline already exists');
        return;
      }

      setIsSubmitting(true);
      try {
        const xdr = await buildTrustlineTransaction(publicKey, assetCode, assetIssuer);
        await signAndSubmitTransaction(xdr);
        toast.success('Trustline added successfully');
        await fetchAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add trustline';
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [publicKey, assets, fetchAssets]
  );

  return {
    assets,
    loading,
    error,
    isSubmitting,
    isConnected,
    addTrustline,
    refresh: fetchAssets,
  };
}
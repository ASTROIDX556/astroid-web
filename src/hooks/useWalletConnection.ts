'use client';

import { useEffect } from 'react';
import {
  STELLAR_NETWORKS,
  isNetworkMismatch,
  networkIdForPassphrase,
  networkLabelForId,
  resolveExpectedPassphrase,
  useFreighterStore,
  type FreighterConnectionStatus,
  type StellarNetworkId,
} from '@/stores/freighter-store';

/**
 * Short display form of a public key for header widgets, e.g.
 * `GBZX…7Q3D` style: first six and last six characters with an ellipsis.
 */
export function truncateStellarAddress(publicKey: string | null | undefined): string {
  if (!publicKey) return '';
  if (publicKey.length <= 12) return publicKey;
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`;
}

/**
 * Reusable wallet connection-state hook over {@link useFreighterStore}.
 *
 * Unlike {@link useStellarWallet}, which keeps per-component local state and
 * is blind to the extension's network, this hook is the store-backed view:
 * hydrates the persisted Freighter session on mount, subscribes to wallet
 * change events (account switches + disconnections) via `WatchWalletChanges`,
 * and exposes the network context the switcher widget and signing call sites
 * consume.
 */
export function useWalletConnection() {
  const status = useFreighterStore((s) => s.status);
  const isInstalled = useFreighterStore((s) => s.isInstalled);
  const publicKey = useFreighterStore((s) => s.publicKey);
  const network = useFreighterStore((s) => s.network);
  const networkPassphrase = useFreighterStore((s) => s.networkPassphrase);
  const targetNetwork = useFreighterStore((s) => s.targetNetwork);
  const isSwitching = useFreighterStore((s) => s.isSwitching);
  const error = useFreighterStore((s) => s.error);

  // Hydrate once and watch the extension for account/network changes for as
  // long as a consumer is mounted. startWalletWatch() stops any previous
  // watcher, so overlapping mounts cannot leak polling subscriptions.
  useEffect(() => {
    const store = useFreighterStore.getState();
    if (store.status !== 'connected') {
      void store.hydrate().then(() => useFreighterStore.getState().startWalletWatch());
    } else {
      useFreighterStore.getState().startWalletWatch();
    }
    return () => {
      useFreighterStore.getState().stopWalletWatch();
    };
  }, []);

  const expectedPassphrase = resolveExpectedPassphrase(targetNetwork);
  const mismatch = status === 'connected' && isNetworkMismatch(networkPassphrase, expectedPassphrase);
  const walletNetworkId = networkIdForPassphrase(networkPassphrase);

  return {
    status: status as FreighterConnectionStatus,
    isInstalled,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isSwitching,
    publicKey,
    truncatedPublicKey: truncateStellarAddress(publicKey),
    /** Raw network tag reported by the extension ('PUBLIC' | 'TESTNET' | …). */
    network,
    networkPassphrase,
    /** Network id the wallet is actually on, null when unrecognized. */
    walletNetworkId,
    walletNetworkLabel: networkLabelForId(walletNetworkId),
    /** Network id this app session expects; the signing gate's source of truth. */
    targetNetwork: targetNetwork as StellarNetworkId,
    targetNetworkLabel: STELLAR_NETWORKS[targetNetwork]?.label ?? 'Unknown',
    expectedPassphrase,
    /** True when connected but the wallet network ≠ target network (fail closed). */
    networkMismatch: mismatch,
    error,
    connect: () => useFreighterStore.getState().connect(),
    disconnect: () => useFreighterStore.getState().disconnect(),
    switchNetwork: (target: StellarNetworkId) => useFreighterStore.getState().switchNetwork(target),
    refreshNetwork: () => useFreighterStore.getState().refreshNetwork(),
  };
}

export default useWalletConnection;

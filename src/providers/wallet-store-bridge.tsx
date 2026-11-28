'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/services/query-keys';
import { useFreighterStore, type FreighterWalletState } from '@/stores/freighter-store';
import { useWalletAccountStore } from '@/stores/wallet-store';

/**
 * Wires the wallet account slice to the two systems it must stay consistent
 * with: the Freighter connection state and the TanStack Query cache.
 *
 * Mounted once inside the query provider. Every account switch invalidates the
 * wallet/balance/account-scoped queries automatically (so the dashboard never
 * shows the previous account's balances), and Freighter connection changes are
 * mirrored into the account list.
 */
export function WalletStoreBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const walletStore = useWalletAccountStore.getState();

    walletStore.setInvalidator(async (publicKey) => {
      await Promise.all([
        // Covers `wallets`, `wallet(id)`, and `walletBalances(id)`.
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        ...(publicKey
          ? [queryClient.invalidateQueries({ queryKey: queryKeys.walletAccount(publicKey) })]
          : []),
        // Covers Horizon balance snapshots keyed by public key.
        queryClient.invalidateQueries({ queryKey: ['stellar'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.proposals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.overview }),
      ]);
    });

    walletStore.setActivator((publicKey) => {
      const account = useWalletAccountStore
        .getState()
        .accounts.find((entry) => entry.publicKey === publicKey);
      // Workspace-managed wallets are not Freighter keys; only mirror accounts
      // the extension actually exposed.
      if (account?.source === 'freighter') {
        useFreighterStore.getState().adoptConnection(publicKey);
      }
    });

    const sync = (state: FreighterWalletState) => {
      const accountStore = useWalletAccountStore.getState();
      if (state.status === 'connected' && state.publicKey) {
        accountStore.setConnected(state.publicKey, {
          ...(state.network ? { network: state.network } : {}),
        });
        return;
      }

      if (state.status === 'connecting') {
        accountStore.markConnecting();
        return;
      }

      accountStore.setDisconnected(
        state.error ??
          (state.status === 'locked'
            ? 'Freighter is locked or wallet access is unavailable.'
            : undefined),
      );
    };

    sync(useFreighterStore.getState());
    const unsubscribe = useFreighterStore.subscribe(sync);

    return () => {
      unsubscribe();
      useWalletAccountStore.getState().setInvalidator(null);
      useWalletAccountStore.getState().setActivator(null);
    };
  }, [queryClient]);

  return null;
}

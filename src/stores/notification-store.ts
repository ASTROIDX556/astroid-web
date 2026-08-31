import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';
import type { AppNotification, NotificationType } from '@/types/domain';
import { isAvailable as freighterIsAvailable, requestAccess, getPublicKey, getNetwork, signTransaction as freighterSignTransaction } from '@stellar/freighter-api';
interface NotificationFilters {
  type: NotificationType | 'all';
}

// Wallet domain types
export type ConnectionPhase = 'not-installed' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WalletState {
  publicKey: string | null;
  networkType: 'testnet' | 'mainnet' | null;
  connectionPhase: ConnectionPhase;
  errorMessage?: string | null;
}

const STELLAR_NETWORKS = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
} as const;

// Developer mock to simulate wallet connection without extension
const MOCK_MODE = false;

interface NotificationState {
  /** Raw notifications seeded from the query / mock layer. */
  notifications: AppNotification[];
  /** IDs of notifications dismissed in this session (never re-added). */
  dismissedIds: Set<string>;
  /** Active category filter. */
  filter: NotificationFilters;
  /** Whether the popover is currently open. */
  open: boolean;
  /** Current wallet connection state. */
  wallet: WalletState;

  // -- actions --
  setNotifications: (items: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  setFilter: (filter: NotificationFilters['type']) => void;
  setOpen: (value: boolean) => void;
  toggle: () => void;
  setWallet: (wallet: WalletState) => void;
  updateWallet: (partial: Partial<WalletState>) => void;
  addNotification: (notification: AppNotification) => void;

  // -- derived helpers --
  unreadCount: () => number;
  visibleNotifications: () => AppNotification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      dismissedIds: new Set(),
      filter: { type: 'all' },
      open: false,
      wallet: {
        publicKey: null,
        networkType: null,
        connectionPhase: 'disconnected',
        errorMessage: null,
      },

      setNotifications: (items) => set({ notifications: items }),
      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
      dismiss: (id) =>
        set((state) => ({
          dismissedIds: new Set(state.dismissedIds).add(id),
        })),
      setFilter: (type) => set({ filter: { type } }),
      setOpen: (value) => set({ open: value }),
      toggle: () => set((state) => ({ open: !state.open })),
      setWallet: (wallet) => set({ wallet }),
      updateWallet: (partial) =>
        set((state) => ({ wallet: { ...state.wallet, ...partial } })),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
        })),

      unreadCount: () =>
        get().notifications.filter(
          (n) => !n.read && !get().dismissedIds.has(n.id)
        ).length,
      visibleNotifications: () =>
        get().notifications.filter(
          (n) =>
            !get().dismissedIds.has(n.id) &&
            (get().filter.type === 'all' || n.type === get().filter.type)
        ),
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({
        wallet: {
          publicKey: state.wallet.publicKey,
          networkType: state.wallet.networkType,
        },
      }),
      merge: (persistedState, currentState) => {
        const persistedWallet = (persistedState as Partial<NotificationState>)?.wallet;
        return {
          ...currentState,
          wallet: {
            ...currentState.wallet,
            ...(persistedWallet || {}),
          },
        };
      },
    }
  )
);

// Developer mock settings
const MOCK_PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MOCK_NETWORK_TYPE = 'testnet' as const;
const MOCK_CONNECT_FAILURE = false;

export function useFreighter() {
  const wallet = useNotificationStore((state) => state.wallet);
  const updateWallet = useNotificationStore((state) => state.updateWallet);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const connect = useCallback(async () => {
    if (MOCK_MODE) {
      updateWallet({ connectionPhase: 'connecting' });
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (MOCK_CONNECT_FAILURE) {
        updateWallet({
          connectionPhase: 'error',
          errorMessage: 'Mock connection rejected',
        });
        return;
      }
      updateWallet({
        publicKey: MOCK_PUBLIC_KEY,
        networkType: MOCK_NETWORK_TYPE,
        connectionPhase: 'connected',
        errorMessage: null,
      });
      return;
    }

    if (!freighterIsAvailable()) {
      addNotification({
        id: crypto.randomUUID(),
        type: 'error',
        title: 'Freighter not installed',
        message: 'Please install Freighter to connect your wallet.',
        read: false,
        createdAt: new Date().toISOString(),
      });
      updateWallet({
        connectionPhase: 'not-installed',
        errorMessage: 'Freighter extension is not installed.',
      });
      return;
    }

    updateWallet({ connectionPhase: 'connecting', errorMessage: null });
    try {
      await requestAccess();
      const publicKey = await getPublicKey();
      const network = await getNetwork();
      const networkType =
        network === STELLAR_NETWORKS.mainnet ? 'mainnet' : 'testnet';
      updateWallet({
        publicKey,
        networkType,
        connectionPhase: 'connected',
        errorMessage: null,
      });
    } catch (error) {
      updateWallet({
        connectionPhase: 'error',
        errorMessage: error instanceof Error ? error.message : 'Connection failed',
      });
      addNotification({
        id: crypto.randomUUID(),
        type: 'error',
        title: 'Connection failed',
        message: error instanceof Error ? error.message : 'Unable to connect to Freighter',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }, [updateWallet, addNotification]);

  const disconnect = useCallback(() => {
    updateWallet({
      publicKey: null,
      networkType: null,
      connectionPhase: 'disconnected',
      errorMessage: null,
    });
  }, [updateWallet]);

  const signTransaction = useCallback(
    async (transactionXDR: string) => {
      if (MOCK_MODE) {
        return transactionXDR;
      }
      try {
        const signedTransaction = await freighterSignTransaction(transactionXDR);
        return signedTransaction;
      } catch (error) {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Signing failed',
          message: error instanceof Error ? error.message : 'Transaction signing was rejected',
          read: false,
          createdAt: new Date().toISOString(),
        });
        throw error;
      }
    },
    [addNotification]
  );

  return { connect, disconnect, signTransaction, wallet };
}
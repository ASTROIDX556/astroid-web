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

export const useNotificationStore = create<NotificationState>()(persist(...
import { create } from 'zustand';
import type { AppNotification, NotificationType } from '@/types/domain';

interface NotificationFilters {
  type: NotificationType | 'all';
}

interface NotificationState {
  /** Raw notifications seeded from the query / mock layer. */
  notifications: AppNotification[];
  /** IDs of notifications dismissed in this session (never re-added). */
  dismissedIds: Set<string>;
  /** Active category filter. */
  filter: NotificationFilters;
  /** Whether the popover is currently open. */
  open: boolean;

  // -- actions --
  setNotifications: (items: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  setFilter: (filter: NotificationFilters['type']) => void;
  setOpen: (value: boolean) => void;
  toggle: () => void;

  // -- derived helpers --
  unreadCount: () => number;
  visibleNotifications: () => AppNotification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  dismissedIds: new Set<string>(),
  filter: { type: 'all' },
  open: false,

  setNotifications: (items) => set({ notifications: items }),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  dismiss: (id) =>
    set((s) => {
      const next = new Set(s.dismissedIds);
      next.add(id);
      return { dismissedIds: next };
    }),

  setFilter: (type) => set({ filter: { type } }),

  setOpen: (value) => set({ open: value }),
  toggle: () => set((s) => ({ open: !s.open })),

  unreadCount: () =>
    get().notifications.filter((n) => !n.read && !get().dismissedIds.has(n.id)).length,

  visibleNotifications: () =>
    get().notifications.filter((n) => {
      if (get().dismissedIds.has(n.id)) return false;
      if (get().filter.type === 'all') return true;
      return n.type === get().filter.type;
    }),
}));

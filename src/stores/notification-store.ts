import { create } from 'zustand';
import type { AppNotification } from '@/types/domain';
import { notificationSeverity, type NotificationSeverity } from '@/lib/notifications';

export type NotificationSeverityFilter = NotificationSeverity | 'all';

interface NotificationFilters {
  severity: NotificationSeverityFilter;
}

interface NotificationState {
  /** Raw notifications seeded from the query / mock layer. */
  notifications: AppNotification[];
  /** IDs of notifications dismissed in this session (never re-added). */
  dismissedIds: Set<string>;
  /** Active severity filter. */
  filter: NotificationFilters;
  /** Whether the drawer is currently open. */
  open: boolean;

  // -- actions --
  addNotification: (notification: AppNotification) => void;
  setNotifications: (items: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  /** Dismisses every notification currently in the centre. */
  clearAll: () => void;
  setFilter: (severity: NotificationSeverityFilter) => void;
  setOpen: (value: boolean) => void;
  toggle: () => void;

  // -- derived helpers --
  unreadCount: () => number;
  visibleNotifications: () => AppNotification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  dismissedIds: new Set<string>(),
  filter: { severity: 'all' },
  open: false,

  addNotification: (notification) =>
    set((s) => {
      if (s.notifications.some((n) => n.id === notification.id)) return s;
      return { notifications: [notification, ...s.notifications] };
    }),

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

  clearAll: () =>
    set((s) => ({
      dismissedIds: new Set([...s.dismissedIds, ...s.notifications.map((n) => n.id)]),
    })),

  setFilter: (severity) => set({ filter: { severity } }),

  setOpen: (value) => set({ open: value }),
  toggle: () => set((s) => ({ open: !s.open })),

  unreadCount: () =>
    get().notifications.filter((n) => !n.read && !get().dismissedIds.has(n.id)).length,

  visibleNotifications: () =>
    get()
      .notifications.filter((n) => {
        if (get().dismissedIds.has(n.id)) return false;
        const { severity } = get().filter;
        if (severity === 'all') return true;
        return notificationSeverity(n.type) === severity;
      }),
}));

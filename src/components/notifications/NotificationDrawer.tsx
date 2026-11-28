'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Trash2,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useNotifications } from '@/hooks/use-queries';
import {
  groupNotificationsBySeverity,
  notificationSeverity,
  type NotificationSeverity,
} from '@/lib/notifications';
import {
  useNotificationStore,
  type NotificationSeverityFilter,
} from '@/stores/notification-store';
import type { AppNotification, NotificationType } from '@/types/domain';

// ---------------------------------------------------------------------------
// Presentation metadata
// ---------------------------------------------------------------------------

const NOTIFICATION_ICON: Record<NotificationType, React.ElementType> = {
  budget_exceeded: AlertCircle,
  proposal_created: FileText,
  proposal_approved: CheckCircle2,
  proposal_rejected: XCircle,
  wallet_funded: Wallet,
  payment_failed: XCircle,
  policy_violation: AlertTriangle,
  risk_alert: ShieldAlert,
};

const SEVERITY_META: Record<
  NotificationSeverity,
  { label: string; text: string; dot: string; ring: string; badge: string }
> = {
  critical: {
    label: 'Critical',
    text: 'text-danger',
    dot: 'bg-danger',
    ring: 'border-danger/30 bg-danger-soft/40',
    badge: 'bg-danger-soft text-danger',
  },
  warning: {
    label: 'Warning',
    text: 'text-warning',
    dot: 'bg-warning',
    ring: 'border-warning/30 bg-warning-soft/40',
    badge: 'bg-warning-soft text-warning',
  },
  info: {
    label: 'Info',
    text: 'text-info',
    dot: 'bg-info',
    ring: 'border-info/30 bg-info-soft/40',
    badge: 'bg-info-soft text-info',
  },
};

const FILTER_OPTIONS: { label: string; value: NotificationSeverityFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
];

/** Shared, brand-tinted focus ring for drawer controls (WCAG AA). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Notification item
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: () => void;
}

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onNavigate,
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICON[notification.type] ?? Bell;
  const severity = notificationSeverity(notification.type);
  const meta = SEVERITY_META[severity];

  const openNotification = () => {
    onMarkRead(notification.id);
    onNavigate();
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          'group relative flex items-start gap-3 border-b border-border px-4 py-3 transition-colors duration-fast',
          notification.read ? 'bg-transparent' : 'bg-gold-soft/30',
        )}
      >
        {!notification.read && (
          <span
            className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-gold"
            aria-label="Unread"
          />
        )}

        <span className={cn('mt-0.5 shrink-0', meta.text)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          {notification.href ? (
            <Link
              href={notification.href}
              onClick={openNotification}
              className={cn(
                'block rounded-xs text-xs font-medium leading-snug underline-offset-2 hover:underline',
                notification.read ? 'text-foreground-secondary' : 'text-foreground',
                FOCUS_RING,
              )}
            >
              {notification.title}
            </Link>
          ) : (
            <p
              className={cn(
                'text-xs font-medium leading-snug',
                notification.read ? 'text-foreground-secondary' : 'text-foreground',
              )}
            >
              {notification.title}
            </p>
          )}
          <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-foreground-muted">
            {notification.body}
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 text-2xs text-foreground-muted">
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label} · {timeAgo(notification.createdAt)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {!notification.read && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              className={cn(
                'grid h-6 w-6 place-items-center rounded-xs text-foreground-muted transition-colors hover:bg-surface-secondary hover:text-foreground',
                FOCUS_RING,
              )}
              aria-label={`Mark "${notification.title}" as read`}
              title="Mark as read"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className={cn(
              'grid h-6 w-6 place-items-center rounded-xs text-foreground-muted transition-colors hover:bg-danger-soft hover:text-danger',
              FOCUS_RING,
            )}
            aria-label={`Dismiss "${notification.title}"`}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------
// Notification drawer
// ---------------------------------------------------------------------------

/**
 * Global notification centre: a right-side slide-over that categorises alerts
 * by severity (critical → warning → info), keeps unread counts, and supports
 * per-notification dismissal plus a clear-all action.
 *
 * Accessibility: the panel is a modal dialog with a focus trap (Tab/Shift+Tab
 * cycle inside, Escape closes), focus is restored to the bell trigger on close,
 * and the background is blurred and inert to pointer input. Content is
 * mounted in a body portal so the drawer is never clipped by the sticky topbar.
 */
export function NotificationDrawer() {
  const open = useNotificationStore((s) => s.open);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const toggle = useNotificationStore((s) => s.toggle);
  // Subscribe to the raw slices (not the derived store functions) so read and
  // dismissal mutations re-render the list.
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissedIds = useNotificationStore((s) => s.dismissedIds);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const filter = useNotificationStore((s) => s.filter);
  const setFilter = useNotificationStore((s) => s.setFilter);
  const setNotifications = useNotificationStore((s) => s.setNotifications);

  const notificationsQuery = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Mirror the query payload into the store so optimistic read/dismiss
  // updates live in one place.
  useEffect(() => {
    if (notificationsQuery.data) setNotifications(notificationsQuery.data);
  }, [notificationsQuery.data, setNotifications]);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: () => setOpen(false),
    initialFocusRef: closeButtonRef,
  });

  const activeNotifications = notifications.filter((notification) => !dismissedIds.has(notification.id));
  const unread = activeNotifications.filter((notification) => !notification.read).length;
  const visible = activeNotifications.filter(
    (notification) =>
      filter.severity === 'all' || notificationSeverity(notification.type) === filter.severity,
  );
  const groups = groupNotificationsBySeverity(visible);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-button text-foreground-secondary transition-colors duration-fast hover:bg-surface-secondary hover:text-foreground',
          FOCUS_RING,
        )}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-drawer"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-xs bg-gold px-1 text-[10px] font-bold text-gold-foreground"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[100]">
                <motion.div
                  key="notification-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                  aria-hidden
                />

                <motion.div
                  key="notification-panel"
                  ref={panelRef}
                  id="notification-drawer"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Notification center"
                  tabIndex={-1}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-background-primary shadow-soft-3 focus:outline-none"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                    <div>
                      <h2 className="font-display text-base font-semibold text-foreground">
                        Notifications
                      </h2>
                      <p className="mt-0.5 text-2xs text-foreground-secondary" role="status" aria-live="polite">
                        {unread > 0
                          ? `${unread} unread · ${visible.length} visible`
                          : `All caught up · ${visible.length} visible`}
                      </p>
                    </div>
                    <button
                      ref={closeButtonRef}
                      type="button"
                      onClick={() => setOpen(false)}
                      className={cn(
                        'grid h-8 w-8 place-items-center rounded-button text-foreground-muted transition-colors hover:bg-surface-secondary hover:text-foreground',
                        FOCUS_RING,
                      )}
                      aria-label="Close notifications"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  {/* Actions + severity filter */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-5 py-2.5">
                    {FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFilter(option.value)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-2xs font-medium transition-colors',
                          filter.severity === option.value
                            ? 'bg-gold text-gold-foreground'
                            : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-secondary/80',
                          FOCUS_RING,
                        )}
                        aria-pressed={filter.severity === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-2">
                    <button
                      type="button"
                      onClick={markAllRead}
                      disabled={unread === 0}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-2xs font-medium text-gold transition-colors hover:bg-gold-soft disabled:pointer-events-none disabled:opacity-50',
                        FOCUS_RING,
                      )}
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                      Mark all as read
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      disabled={visible.length === 0}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-2xs font-medium text-foreground-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-50',
                        FOCUS_RING,
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Clear all
                    </button>
                  </div>

                  {/* Categorized list */}
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {visible.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                        <Bell className="mb-3 h-8 w-8 text-foreground-muted" aria-hidden />
                        <p className="text-sm font-medium text-foreground-secondary">
                          You&apos;re all caught up
                        </p>
                        <p className="mt-1 max-w-xs text-2xs text-foreground-muted">
                          {filter.severity === 'all'
                            ? 'Budget alerts, approval requests, and risk events will appear here.'
                            : `No ${filter.severity} notifications right now.`}
                        </p>
                      </div>
                    ) : (
                      groups.map((group) => {
                        const meta = SEVERITY_META[group.severity];
                        return (
                          <section key={group.severity} aria-labelledby={`severity-${group.severity}`}>
                            <h3
                              id={`severity-${group.severity}`}
                              className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background-primary/95 px-5 py-2 text-2xs font-semibold uppercase tracking-wide text-foreground-muted backdrop-blur"
                            >
                              <span className={cn('h-2 w-2 rounded-full', meta.dot)} aria-hidden />
                              {meta.label}
                              <span
                                className={cn(
                                  'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                  meta.badge,
                                )}
                              >
                                {group.notifications.length}
                              </span>
                            </h3>
                            <ul>
                              <AnimatePresence initial={false} mode="popLayout">
                                {group.notifications.map((notification) => (
                                  <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkRead={markRead}
                                    onDismiss={dismiss}
                                    onNavigate={() => setOpen(false)}
                                  />
                                ))}
                              </AnimatePresence>
                            </ul>
                          </section>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                    <Link
                      href="/notifications"
                      onClick={() => setOpen(false)}
                      className={cn(
                        'text-xs font-medium text-gold transition-colors hover:text-gold-strong',
                        FOCUS_RING,
                      )}
                    >
                      View all notifications
                    </Link>
                    <span className="text-2xs text-foreground-muted">Esc to close</span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default NotificationDrawer;

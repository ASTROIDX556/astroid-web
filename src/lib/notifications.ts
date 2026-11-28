import type { AppNotification, NotificationType } from '@/types/domain';

/**
 * Alert severity, derived from the notification's domain type.
 *
 * The domain notification type describes *what happened* (a budget breach, a
 * blocked payment, a proposal) while operators triage by *how urgent* it is.
 * Keeping the mapping in one pure module lets the store, the drawer, and tests
 * agree on the same categorization.
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export const NOTIFICATION_SEVERITY_ORDER: readonly NotificationSeverity[] = [
  'critical',
  'warning',
  'info',
] as const;

const SEVERITY_BY_TYPE: Record<NotificationType, NotificationSeverity> = {
  risk_alert: 'critical',
  payment_failed: 'critical',
  budget_exceeded: 'warning',
  policy_violation: 'warning',
  proposal_rejected: 'warning',
  proposal_created: 'info',
  proposal_approved: 'info',
  wallet_funded: 'info',
};

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

/** Maps a domain notification type to its triage severity. */
export function notificationSeverity(type: NotificationType): NotificationSeverity {
  return SEVERITY_BY_TYPE[type] ?? 'info';
}

/** Human-readable label for a severity, e.g. for section headings. */
export function notificationSeverityLabel(severity: NotificationSeverity): string {
  return SEVERITY_LABEL[severity];
}

/** Newest-first ordering that never mutates the input array. */
export function sortNotificationsNewestFirst(
  notifications: readonly AppNotification[],
): AppNotification[] {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export interface NotificationSeverityGroup {
  severity: NotificationSeverity;
  label: string;
  notifications: AppNotification[];
}

/**
 * Groups notifications by severity in triage order (critical → warning → info),
 * newest first inside each group. Empty groups are omitted so the drawer never
 * renders a heading with nothing under it.
 */
export function groupNotificationsBySeverity(
  notifications: readonly AppNotification[],
): NotificationSeverityGroup[] {
  const sorted = sortNotificationsNewestFirst(notifications);

  return NOTIFICATION_SEVERITY_ORDER.flatMap((severity) => {
    const group = sorted.filter((notification) => notificationSeverity(notification.type) === severity);
    return group.length > 0
      ? [{ severity, label: notificationSeverityLabel(severity), notifications: group }]
      : [];
  });
}

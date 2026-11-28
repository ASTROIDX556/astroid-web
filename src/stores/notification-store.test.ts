import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';

import { useNotificationStore } from './notification-store';
import {
  groupNotificationsBySeverity,
  notificationSeverity,
} from '@/lib/notifications';
import type { AppNotification, NotificationType } from '@/types/domain';

function makeNotification(
  id: string,
  type: NotificationType,
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id,
    userId: 'usr_test',
    title: `Notification ${id}`,
    body: 'Detail',
    type,
    channel: 'dashboard',
    read: false,
    createdAt: '2026-07-31T08:00:00.000Z',
    ...overrides,
  };
}

function resetStore(): void {
  useNotificationStore.setState({
    notifications: [],
    dismissedIds: new Set<string>(),
    filter: { severity: 'all' },
    open: false,
  });
}

beforeEach(resetStore);

describe('notification store (#563)', () => {
  test('adds new notifications newest-first and ignores duplicate ids', () => {
    const store = useNotificationStore.getState();
    store.addNotification(makeNotification('ntf_1', 'proposal_created'));
    store.addNotification(makeNotification('ntf_2', 'risk_alert'));

    assert.deepEqual(
      useNotificationStore.getState().notifications.map((n) => n.id),
      ['ntf_2', 'ntf_1'],
    );

    store.addNotification(makeNotification('ntf_1', 'wallet_funded'));
    assert.equal(useNotificationStore.getState().notifications.length, 2);
    assert.equal(
      useNotificationStore.getState().notifications.find((n) => n.id === 'ntf_1')?.type,
      'proposal_created',
    );
  });

  test('dismiss hides a single notification and updates the unread count', () => {
    const store = useNotificationStore.getState();
    store.setNotifications([
      makeNotification('ntf_1', 'proposal_created'),
      makeNotification('ntf_2', 'risk_alert'),
    ]);

    assert.equal(store.unreadCount(), 2);

    store.dismiss('ntf_1');

    const state = useNotificationStore.getState();
    assert.deepEqual(state.visibleNotifications().map((n) => n.id), ['ntf_2']);
    assert.equal(state.unreadCount(), 1);
  });

  test('clearAll dismisses every notification, including read ones', () => {
    const store = useNotificationStore.getState();
    store.setNotifications([
      makeNotification('ntf_1', 'proposal_created'),
      makeNotification('ntf_2', 'risk_alert', { read: true }),
    ]);

    store.clearAll();

    const state = useNotificationStore.getState();
    assert.equal(state.visibleNotifications().length, 0);
    assert.equal(state.unreadCount(), 0);

    // New notifications still arrive after a clear-all.
    state.addNotification(makeNotification('ntf_3', 'budget_exceeded'));
    assert.deepEqual(
      useNotificationStore.getState().visibleNotifications().map((n) => n.id),
      ['ntf_3'],
    );
  });

  test('markAllRead clears unread state but keeps notifications visible', () => {
    const store = useNotificationStore.getState();
    store.setNotifications([
      makeNotification('ntf_1', 'proposal_created'),
      makeNotification('ntf_2', 'policy_violation'),
    ]);

    store.markAllRead();

    const state = useNotificationStore.getState();
    assert.equal(state.unreadCount(), 0);
    assert.equal(state.visibleNotifications().length, 2);
    assert.ok(state.visibleNotifications().every((n) => n.read));
  });

  test('severity filter narrows the visible list', () => {
    const store = useNotificationStore.getState();
    store.setNotifications([
      makeNotification('ntf_1', 'proposal_created'), // info
      makeNotification('ntf_2', 'budget_exceeded'), // warning
      makeNotification('ntf_3', 'risk_alert'), // critical
    ]);

    store.setFilter('critical');
    assert.deepEqual(useNotificationStore.getState().visibleNotifications().map((n) => n.id), [
      'ntf_3',
    ]);

    useNotificationStore.getState().setFilter('all');
    assert.equal(useNotificationStore.getState().visibleNotifications().length, 3);
  });

  test('open state toggles through the store', () => {
    assert.equal(useNotificationStore.getState().open, false);
    useNotificationStore.getState().toggle();
    assert.equal(useNotificationStore.getState().open, true);
    useNotificationStore.getState().setOpen(false);
    assert.equal(useNotificationStore.getState().open, false);
  });
});

describe('notification severity categorization (#563)', () => {
  test('maps domain notification types to triage severities', () => {
    assert.equal(notificationSeverity('risk_alert'), 'critical');
    assert.equal(notificationSeverity('payment_failed'), 'critical');
    assert.equal(notificationSeverity('budget_exceeded'), 'warning');
    assert.equal(notificationSeverity('policy_violation'), 'warning');
    assert.equal(notificationSeverity('proposal_created'), 'info');
    assert.equal(notificationSeverity('wallet_funded'), 'info');
  });

  test('groups by critical → warning → info, newest first, omitting empty groups', () => {
    const groups = groupNotificationsBySeverity([
      makeNotification('info-old', 'wallet_funded', {
        createdAt: '2026-07-29T08:00:00.000Z',
      }),
      makeNotification('critical', 'risk_alert', {
        createdAt: '2026-07-30T08:00:00.000Z',
      }),
      makeNotification('info-new', 'proposal_created', {
        createdAt: '2026-07-31T08:00:00.000Z',
      }),
    ]);

    assert.deepEqual(groups.map((group) => group.severity), ['critical', 'info']);
    assert.deepEqual(groups[1]?.notifications.map((n) => n.id), ['info-new', 'info-old']);
  });
});

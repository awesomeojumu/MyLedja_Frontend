import type { AppNotification } from '@/data/workspace/model';

import { filterNotifications, formatNotificationWhen, groupNotifications, unreadCount } from '../helpers';

describe('notification helpers', () => {
  const base: AppNotification = {
    id: 'n1',
    createdAt: '2026-10-28T09:00:00.000Z',
    title: 'Test',
    category: 'bills',
    read: false,
    action: 'mark_paid',
  };

  it('groups by today, week, earlier', () => {
    const groups = groupNotifications(
      [
        { ...base, id: 'a', createdAt: '2026-10-28T10:00:00.000Z' },
        { ...base, id: 'b', createdAt: '2026-10-27T10:00:00.000Z' },
        { ...base, id: 'c', createdAt: '2026-10-01T10:00:00.000Z' },
      ],
      '2026-10-28',
    );
    expect(groups.today).toHaveLength(1);
    expect(groups.week).toHaveLength(1);
    expect(groups.earlier).toHaveLength(1);
  });

  it('filters categories', () => {
    expect(filterNotifications([base, { ...base, id: '2', category: 'budget' }], 'bills')).toHaveLength(1);
  });

  it('counts unread', () => {
    expect(unreadCount([base, { ...base, id: '2', read: true }])).toBe(1);
  });

  it('formats when label for today', () => {
    expect(formatNotificationWhen('2026-10-28T09:00:00.000Z', '2026-10-28')).toBe('9 a.m.');
  });
});

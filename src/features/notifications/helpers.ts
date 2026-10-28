import type { AppNotification, NotificationCategory } from '@/data/workspace/model';
import { addDays } from '@/features/transactions/helpers';

export type NotificationGroup = 'today' | 'week' | 'earlier';

export function groupNotifications(items: AppNotification[], today: string): Record<NotificationGroup, AppNotification[]> {
  const weekStart = addDays(today, -7);
  const out: Record<NotificationGroup, AppNotification[]> = { today: [], week: [], earlier: [] };
  for (const n of items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const day = n.createdAt.slice(0, 10);
    if (day >= today) out.today.push(n);
    else if (day >= weekStart) out.week.push(n);
    else out.earlier.push(n);
  }
  return out;
}

export function filterNotifications(items: AppNotification[], category: NotificationCategory | 'all'): AppNotification[] {
  if (category === 'all') return items;
  return items.filter((n) => n.category === category);
}

export function unreadCount(items: AppNotification[]): number {
  return items.filter((n) => !n.read).length;
}

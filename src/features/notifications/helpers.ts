import { formatDay } from '@/design/components/overlays';
import type { AppNotification, NotificationCategory } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { rowFor } from '@/features/budget/helpers';
import { addDays } from '@/features/transactions/helpers';
import { monthOf } from '@/ledger';
import { t } from '@/i18n';

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

export function isSnoozed(n: AppNotification, today: string): boolean {
  return Boolean(n.snoozedUntil && n.snoozedUntil > today);
}

export function visibleNotifications(items: AppNotification[], today: string): AppNotification[] {
  return items.filter((n) => !isSnoozed(n, today));
}

/** DESIGN page 27: budget overspend warnings appear in the inbox when spending crosses 80% of plan. */
export function mergeDerivedNotifications(snapshot: Snapshot, stored: AppNotification[], today: string): AppNotification[] {
  const month = monthOf(today);
  const seen = new Set(stored.map((n) => n.id));
  const derived: AppNotification[] = [];
  for (const cat of snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden && c.countInBudget)) {
    const row = rowFor(snapshot, month, cat.id);
    const plan = row.carried + row.assigned;
    if (plan <= 0n) continue;
    const pct = Number((row.activity * 100n) / plan);
    if (pct < 80) continue;
    const id = `derived:budget:${cat.id}:${month}`;
    if (seen.has(id)) continue;
    derived.push({
      id,
      createdAt: `${today}T09:00:00.000Z`,
      title: t('notifications.budgetHigh', { name: cat.name, pct: Math.min(pct, 999).toString() }),
      category: 'budget',
      read: false,
      action: 'see_budget',
    });
  }
  return [...stored, ...derived];
}

export type NotificationIcon = 'due' | 'missed' | 'budget' | 'goal' | 'security' | 'default';

export function notificationIcon(n: AppNotification): NotificationIcon {
  if (n.category === 'security') return 'security';
  if (n.category === 'budget') return 'budget';
  if (n.category === 'goals') return 'goal';
  if (n.action === 'match') return 'missed';
  if (n.category === 'bills' && n.action === 'mark_paid') return 'due';
  if (n.category === 'income' && n.action === 'mark_received') return 'due';
  return 'default';
}

export function formatNotificationWhen(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) {
    const d = new Date(iso);
    const hours = d.getHours();
    const mins = d.getMinutes();
    const h12 = hours % 12 || 12;
    const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
    return mins === 0 ? `${h12} ${suffix}` : `${h12}:${mins.toString().padStart(2, '0')} ${suffix}`;
  }
  if (day === addDays(today, -1)) return t('add.yesterday');
  const weekStart = addDays(today, -7);
  if (day >= weekStart) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
  }
  return formatDay(day);
}

function expenseAmount(snapshot: Snapshot, event: TxEvent): bigint {
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  return event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + l.amountMinor, 0n);
}

export function matchCandidates(snapshot: Snapshot, billAmountMinor: string | undefined, today: string, limit = 12): TxEvent[] {
  const target = billAmountMinor ? BigInt(billAmountMinor) : null;
  const since = addDays(today, -90);
  return snapshot.events
    .filter((e) => e.status === 'posted' && e.type === 'expense' && e.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .filter((e) => (target === null ? true : expenseAmount(snapshot, e) === target))
    .slice(0, limit);
}

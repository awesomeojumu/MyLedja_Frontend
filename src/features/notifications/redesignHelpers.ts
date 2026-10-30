import { t, type TextKey } from '@/i18n';

/** Figma Phone Notifications trailing times: `9:00`, `28 Oct`. */
export function formatRedesignNotificationWhen(iso: string, today: string): string {
  const day = iso.slice(0, 10);
  if (day === today) {
    const d = new Date(iso);
    const hours = d.getHours();
    const mins = d.getMinutes();
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
  const [, mo, d] = day.split('-').map(Number) as [number, number, number];
  const month = t(`date.month.${mo}` as TextKey);
  return `${d} ${month}`;
}

export function redesignNotificationSubtitle(n: {
  body?: string;
  amountMinor?: string;
  category: string;
}): string | undefined {
  if (n.body?.trim()) return n.body.trim();
  return undefined;
}

export function redesignEmptyCopy(): { title: TextKey; body: TextKey } {
  return {
    title: 'notifications.redesign.emptyTitle',
    body: 'notifications.redesign.emptyBody',
  };
}

/** Prefer Today / Earlier labels; keep This week when present. */
export function redesignGroupLabel(key: 'today' | 'week' | 'earlier'): TextKey {
  return `notifications.group.${key}` as TextKey;
}

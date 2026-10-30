import { t, type TextKey } from '@/i18n';
import { today } from './helpers';

const WEEKDAY_KEYS = [
  'plan.weekday.sun',
  'plan.weekday.mon',
  'plan.weekday.tue',
  'plan.weekday.wed',
  'plan.weekday.thu',
  'plan.weekday.fri',
  'plan.weekday.sat',
] as const;

/** Figma day headers: "Today" or "Wednesday, 28 October". */
export function formatTxDayHeader(iso: string, now = today()): string {
  if (iso === now) return t('date.today');
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const month = t(`date.monthLong.${mo}` as TextKey);
  return t('tx.redesign.dayHeader', {
    weekday: t(WEEKDAY_KEYS[weekday]!),
    d,
    month,
  });
}

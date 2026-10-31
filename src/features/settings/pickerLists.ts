import type { DateFormat } from '@/data/workspace/model';
import { t, type TextKey } from '@/i18n';

export { currencyLabel } from '@/features/setup/currencies';

export const WEEK_OPTIONS = ['monday', 'sunday', 'saturday'] as const;

export function weekLabel(day: string): string {
  if (day === 'sunday') return t('settings.redesign.sunday');
  if (day === 'saturday') return t('settings.redesign.saturday');
  return t('settings.redesign.monday');
}

export const LANGUAGE_OPTIONS = ['en'] as const;

export const NUMBER_FORMAT_OPTIONS = ['1,234.56'] as const;

export const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export function dateFormatLabel(fmt: DateFormat): string {
  return t(`import.format.${fmt}` as TextKey);
}

export const MONTH_STARTS = ['1', '15', 'last'] as const;
export type MonthStart = (typeof MONTH_STARTS)[number];

export function monthStartLabel(value: string): string {
  if (value === '15') return t('settings.redesign.monthStarts15');
  if (value === 'last') return t('settings.redesign.monthStartsLast');
  return t('settings.redesign.monthStartsDay');
}

export const WARN_AT_OPTIONS = [50, 75, 80, 90, 100] as const;
export type WarnAt = (typeof WARN_AT_OPTIONS)[number];

export const QUIET_HOURS = [
  { start: '22:00', end: '07:00', labelKey: 'settings.redesign.quietHoursValue' },
  { start: '21:00', end: '06:00', labelKey: 'settings.redesign.quietHours9' },
  { start: '23:00', end: '08:00', labelKey: 'settings.redesign.quietHours11' },
  { start: '', end: '', labelKey: 'settings.redesign.quietHoursOff' },
] as const;

export function quietHoursLabel(start?: string, end?: string): string {
  if (start === '' && end === '') return t('settings.redesign.quietHoursOff');
  const hit = QUIET_HOURS.find((row) => row.start === (start ?? '22:00') && row.end === (end ?? '07:00'));
  return t((hit ?? QUIET_HOURS[0]).labelKey);
}

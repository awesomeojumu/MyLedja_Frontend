import { t } from '@/i18n';
import { parseAmount } from '@/money';

/** Digits in a typed amount, ignoring currency, commas, sign and the decimal point (addendum §1.1). */
export function amountDigitCount(input: string): number {
  return input.replace(/[^\d]/g, '').length;
}

/** Exact Amount error words from addendum §1.1. Null while the person is still typing an empty optional field. */
export function amountFieldError(
  value: string,
  opts: { allowZero?: boolean; required?: boolean } = {},
): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return opts.required ? t('money.unreadable') : null;
  if (amountDigitCount(trimmed) > 15) return t('money.tooLarge');
  const parsed = parseAmount(trimmed);
  if (!parsed.ok) return t('money.unreadable');
  if (!opts.allowZero && parsed.minor === 0n) return t('money.zero');
  return null;
}

/** Text (one line): empty when needed, or over 60 characters. */
export function textFieldError(
  value: string,
  opts: { required?: boolean; fieldNoun?: string; max?: number } = {},
): string | null {
  const max = opts.max ?? 60;
  const trimmed = value.trim();
  if (!trimmed) {
    if (!opts.required) return null;
    return opts.fieldNoun ? t('fields.addNamed', { field: opts.fieldNoun }) : t('fields.addName');
  }
  if (value.length > max) return t('fields.tooLong');
  return null;
}

/** Notes: up to 500 characters, counter from 400. */
export function notesFieldError(value: string): string | null {
  return value.length > 500 ? t('fields.notesTooLong') : null;
}

/** Percent: 0 to 100, up to 2 decimals. */
export function percentFieldError(value: string, opts: { required?: boolean } = {}): string | null {
  const trimmed = value.trim().replace(/%$/, '');
  if (trimmed === '') return opts.required ? t('fields.percent') : null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return t('fields.percent');
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 100) return t('fields.percent');
  return null;
}

/** Date: refuse a future day when the field is for a transaction (addendum §1.1). */
export function dateFieldError(isoDay: string, opts: { allowFuture?: boolean; today?: string } = {}): string | null {
  if (opts.allowFuture) return null;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  return isoDay > today ? t('fields.futureDate') : null;
}

/** Picker: nothing chosen when needed. */
export function pickerFieldError(value: string | null | undefined, thing: string): string | null {
  return value ? null : t('fields.chooseNamed', { thing });
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function yesterdayIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

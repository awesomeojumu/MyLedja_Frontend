import { t, type TextKey } from '@/i18n';

/** Currencies shown in Welcome step 2. Only NGN is active in Phase 1–2. */
export const WELCOME_CURRENCIES: { code: 'NGN' | 'USD' | 'GBP' | 'EUR'; labelKey: TextKey; active: boolean }[] = [
  { code: 'NGN', labelKey: 'welcome.step2.ngn', active: true },
  { code: 'USD', labelKey: 'welcome.currency.usd', active: false },
  { code: 'GBP', labelKey: 'welcome.currency.gbp', active: false },
  { code: 'EUR', labelKey: 'welcome.currency.eur', active: false },
];

export function filterCurrencies(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return WELCOME_CURRENCIES;
  return WELCOME_CURRENCIES.filter((c) => t(c.labelKey).toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
}

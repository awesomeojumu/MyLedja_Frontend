/** Query keys for debts popups/tabs (addendum PU-34…36, 58; TB-06…07). */
export const DEBT_URL = {
  tab: 'tab',
  debt: 'debt',
  payment: 'payment',
  debtSchedule: 'debtSchedule',
  direction: 'direction',
  view: 'view',
} as const;

export type DebtsListTab = 'all' | 'owed' | 'owe' | 'settled';
export type DebtDetailTab = 'timeline' | 'schedule';
export type DebtDirectionParam = 'lent' | 'borrowed';

export function parseDebtsListTab(raw: string | undefined): DebtsListTab {
  if (raw === 'owed' || raw === 'owedToMe' || raw === 'they_owe_me') return 'owed';
  if (raw === 'owe' || raw === 'iOwe' || raw === 'i_owe_them') return 'owe';
  if (raw === 'settled') return 'settled';
  return 'all';
}

/** PU-34 web address `?direction=lent|borrowed` beside `tab=`. */
export function parseDebtDirection(raw: string | undefined): DebtDirectionParam | undefined {
  if (raw === 'lent' || raw === 'borrowed') return raw;
  return undefined;
}

export function directionToDebtDirection(raw: DebtDirectionParam | undefined): 'owedToMe' | 'iOwe' | undefined {
  if (raw === 'lent') return 'owedToMe';
  if (raw === 'borrowed') return 'iOwe';
  return undefined;
}

export function debtsListTabToFilter(tab: DebtsListTab): 'all' | 'owedToMe' | 'iOwe' | 'settled' {
  if (tab === 'owed') return 'owedToMe';
  if (tab === 'owe') return 'iOwe';
  return tab;
}

export function filterToDebtsListTab(filter: 'all' | 'owedToMe' | 'iOwe' | 'settled'): DebtsListTab {
  if (filter === 'owedToMe') return 'owed';
  if (filter === 'iOwe') return 'owe';
  return filter;
}

export function parseDebtDetailTab(raw: string | undefined): DebtDetailTab {
  return raw === 'schedule' ? 'schedule' : 'timeline';
}

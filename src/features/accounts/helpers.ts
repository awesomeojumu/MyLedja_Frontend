import { ACCOUNT_GROUPS, ACCOUNT_KIND_INFO, ACCOUNT_KINDS, type Account, type AccountGroup, type AccountKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

import type { RegisterRow } from './AccountScreen';

export type AccountSort = 'custom' | 'balance' | 'name' | 'type';

export const ACCOUNT_KINDS_BY_GROUP: Record<AccountGroup, AccountKind[]> = ACCOUNT_GROUPS.reduce(
  (acc, group) => {
    acc[group] = ACCOUNT_KINDS.filter((k) => ACCOUNT_KIND_INFO[k].group === group);
    return acc;
  },
  {} as Record<AccountGroup, AccountKind[]>,
);

export function accountInitials(name: string, institution?: string): string {
  const src = (institution?.trim() || name).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function sortAccountRows<T extends { account: Account; balance: bigint }>(rows: T[], mode: AccountSort): T[] {
  const copy = [...rows];
  if (mode === 'custom') return copy.sort((a, b) => a.account.order - b.account.order);
  if (mode === 'balance') return copy.sort((a, b) => (a.balance === b.balance ? a.account.name.localeCompare(b.account.name) : a.balance > b.balance ? -1 : 1));
  if (mode === 'name') return copy.sort((a, b) => a.account.name.localeCompare(b.account.name));
  return copy.sort((a, b) => {
    const ga = ACCOUNT_KIND_INFO[a.account.type].group;
    const gb = ACCOUNT_KIND_INFO[b.account.type].group;
    const gi = ACCOUNT_GROUPS.indexOf(ga) - ACCOUNT_GROUPS.indexOf(gb);
    return gi !== 0 ? gi : a.account.name.localeCompare(b.account.name);
  });
}

export type DayGroup = { day: string; net: bigint; rows: RegisterRow[] };

/** Phone-style day headers with net for the account register (DESIGN page 9). */
export function groupRegisterByDay(rows: RegisterRow[]): DayGroup[] {
  const map = new Map<string, RegisterRow[]>();
  for (const r of rows) {
    const list = map.get(r.event.date) ?? [];
    list.push(r);
    map.set(r.event.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, dayRows]) => ({ day, rows: dayRows, net: dayRows.reduce((s, r) => s + r.line, 0n) }));
}

export function importRulesApplied(
  snapshot: Snapshot,
  rows: { payee: string; amount: bigint }[],
): number {
  let n = 0;
  for (const row of rows) {
    const payee = snapshot.payees.find((p) => p.name.toLowerCase() === row.payee.toLowerCase() || p.aliases?.some((a) => a.toLowerCase() === row.payee.toLowerCase()));
    if (payee?.defaultCategoryId) n += 1;
  }
  return n;
}

export function isInvestmentAccount(type: AccountKind): boolean {
  return type === 'investment';
}

export function hasValueTab(type: AccountKind): boolean {
  return type === 'property' || type === 'investment';
}

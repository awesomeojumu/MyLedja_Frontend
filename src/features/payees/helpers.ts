import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { rulesForPayee } from '@/features/rules/ruleEngine';
import { monthOf } from '@/ledger';

export type PayeeRow = {
  payee: Payee;
  txCount: number;
  spentThisYear: bigint;
  lastUsed: string | null;
  defaultCategoryName: string;
  rulesCount: number;
};

export type PayeeSort = 'name' | 'mostUsed' | 'mostSpent';

/** Figma Phone / Payees chips: All · Most used · Not sorted. */
export type PayeeChipFilter = 'all' | 'mostUsed' | 'notSorted';

export function applyPayeeChipFilter(rows: PayeeRow[], filter: PayeeChipFilter): PayeeRow[] {
  if (filter === 'notSorted') {
    return sortPayeeRows(
      rows.filter((r) => !r.payee.defaultCategoryId),
      'name',
    );
  }
  if (filter === 'mostUsed') return sortPayeeRows(rows, 'mostUsed');
  return sortPayeeRows(rows, 'name');
}

/** Row subtitle: "Groceries, 14 times" / "Not sorted, 4 times". */
export function payeeRowSubtitle(row: PayeeRow, notSortedLabel: string, timesLabel: (n: number) => string): string {
  const cat = row.defaultCategoryName.trim() || notSortedLabel;
  if (row.txCount <= 0) return cat;
  return `${cat}, ${timesLabel(row.txCount)}`;
}

export function payeeRows(snapshot: Snapshot, year: number): PayeeRow[] {
  const catName = (id?: string) => snapshot.categories.find((c) => c.id === id)?.name ?? '';
  const stats = new Map<string, { count: number; spent: bigint; last: string | null }>();
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || !e.payeeId || e.type === 'transfer' || e.type === 'opening_balance') continue;
    const y = Number(e.date.slice(0, 4));
    const cur = stats.get(e.payeeId) ?? { count: 0, spent: 0n, last: null };
    cur.count += 1;
    if (!cur.last || e.date > cur.last) cur.last = e.date;
    if (y === year && e.type === 'expense') {
      const accountIds = new Set(snapshot.accounts.map((a) => a.id));
      for (const line of e.lines) {
        if (!accountIds.has(line.ledgerAccountId) && line.amountMinor > 0n) cur.spent += line.amountMinor;
      }
    }
    stats.set(e.payeeId, cur);
  }
  return snapshot.payees.map((payee) => {
    const s = stats.get(payee.id) ?? { count: 0, spent: 0n, last: null };
    return {
      payee,
      txCount: s.count,
      spentThisYear: s.spent,
      lastUsed: s.last,
      defaultCategoryName: catName(payee.defaultCategoryId),
      rulesCount: rulesForPayee(snapshot.rules, payee).length,
    };
  });
}

export function sortPayeeRows(rows: PayeeRow[], sort: PayeeSort): PayeeRow[] {
  const copy = [...rows];
  if (sort === 'mostUsed') {
    copy.sort((a, b) => b.txCount - a.txCount || a.payee.name.localeCompare(b.payee.name));
  } else if (sort === 'mostSpent') {
    copy.sort((a, b) => {
      if (a.spentThisYear === b.spentThisYear) return a.payee.name.localeCompare(b.payee.name);
      return a.spentThisYear > b.spentThisYear ? -1 : 1;
    });
  } else {
    copy.sort((a, b) => a.payee.name.localeCompare(b.payee.name));
  }
  return copy;
}

/** Latest transactions for the payee panel (PU-46: latest 10, newest first). */
export function payeeTransactions(snapshot: Snapshot, payeeId: string, limit = 10) {
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  return snapshot.events
    .filter((e) => e.status === 'posted' && e.payeeId === payeeId && e.type !== 'transfer')
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
    .map((e) => {
      const categoryLine = e.lines.find((l) => !accountIds.has(l.ledgerAccountId));
      const category = snapshot.categories.find((c) => c.id === categoryLine?.ledgerAccountId)?.name ?? '';
      const accountLine = e.lines.find((l) => accountIds.has(l.ledgerAccountId));
      const accountName = snapshot.accounts.find((a) => a.id === accountLine?.ledgerAccountId)?.name ?? '';
      const amount = e.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + l.amountMinor, 0n);
      return { id: e.id, date: e.date, category, accountName, amount };
    });
}

export function mergeTransactionCount(snapshot: Snapshot, mergeIds: string[]): number {
  return snapshot.events.filter((e) => e.payeeId && mergeIds.includes(e.payeeId)).length;
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Who already owns this bank name (PU46-2). */
export function aliasOwner(snapshot: Snapshot, alias: string, exceptPayeeId?: string): Payee | undefined {
  const key = alias.trim().toLowerCase();
  if (!key) return undefined;
  return snapshot.payees.find((p) => {
    if (exceptPayeeId && p.id === exceptPayeeId) return false;
    if (p.name.toLowerCase() === key) return true;
    return (p.aliases ?? []).some((a) => a.toLowerCase() === key);
  });
}

/** Find a payee by display name or bank alias. */
export function findPayeeByName(snapshot: Snapshot, name: string): Payee | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return (
    snapshot.payees.find((p) => p.name.toLowerCase() === key) ??
    snapshot.payees.find((p) => (p.aliases ?? []).some((a) => a.toLowerCase() === key))
  );
}

export function debtForPayee(snapshot: Snapshot, payeeId: string) {
  return snapshot.debts.find((d) => d.payeeId === payeeId);
}

export { monthOf };

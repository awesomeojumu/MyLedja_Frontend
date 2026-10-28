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

export function payeeTransactions(snapshot: Snapshot, payeeId: string, limit = 12) {
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  return snapshot.events
    .filter((e) => e.status === 'posted' && e.payeeId === payeeId && e.type !== 'transfer')
    .slice(0, limit)
    .map((e) => {
      const categoryLine = e.lines.find((l) => !accountIds.has(l.ledgerAccountId));
      const category = snapshot.categories.find((c) => c.id === categoryLine?.ledgerAccountId)?.name ?? '';
      const amount = e.lines
        .filter((l) => accountIds.has(l.ledgerAccountId))
        .reduce((s, l) => s + l.amountMinor, 0n);
      return { id: e.id, date: e.date, category, amount };
    });
}

export function mergeTransactionCount(snapshot: Snapshot, mergeIds: string[]): number {
  return snapshot.events.filter((e) => e.payeeId && mergeIds.includes(e.payeeId)).length;
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export { monthOf };

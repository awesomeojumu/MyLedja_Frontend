import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf } from '@/ledger';

export type PayeeRow = {
  payee: Payee;
  txCount: number;
  spentThisYear: bigint;
  lastUsed: string | null;
  defaultCategoryName: string;
};

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
  return snapshot.payees
    .map((payee) => {
      const s = stats.get(payee.id) ?? { count: 0, spent: 0n, last: null };
      return {
        payee,
        txCount: s.count,
        spentThisYear: s.spent,
        lastUsed: s.last,
        defaultCategoryName: catName(payee.defaultCategoryId),
      };
    })
    .sort((a, b) => a.payee.name.localeCompare(b.payee.name));
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export { monthOf };

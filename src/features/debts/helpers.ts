import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

export type DebtFilter = 'all' | 'owedToMe' | 'iOwe' | 'settled';

export type DebtRow = {
  debt: PersonDebt;
  balance: bigint;
};

export function debtRows(snapshot: Snapshot, filter: DebtFilter, onDate?: string): DebtRow[] {
  return snapshot.debts
    .filter((d) => {
      if (filter === 'all') return true;
      if (filter === 'settled') return d.status === 'settled';
      if (filter === 'owedToMe') return d.direction === 'owedToMe' && d.status === 'open';
      return d.direction === 'iOwe' && d.status === 'open';
    })
    .map((debt) => ({
      debt,
      balance: snapshot.chart.get(debt.ledgerAccountId)
        ? balanceFor(snapshot, debt, onDate)
        : 0n,
    }))
    .sort((a, b) => (a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1));
}

function balanceFor(snapshot: Snapshot, debt: PersonDebt, onDate?: string): bigint {
  const account = snapshot.chart.get(debt.ledgerAccountId)!;
  let total = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || (onDate && e.date > onDate)) continue;
    for (const l of e.lines) if (l.ledgerAccountId === debt.ledgerAccountId) total += l.amountMinor;
  }
  return account.kind === 'liability' ? -total : total;
}

export function debtTotals(rows: DebtRow[]) {
  let owedToMe = 0n;
  let iOwe = 0n;
  for (const row of rows) {
    if (row.debt.status !== 'open') continue;
    if (row.debt.direction === 'owedToMe') owedToMe += row.balance;
    else iOwe += row.balance;
  }
  return { owedToMe, iOwe, net: owedToMe - iOwe };
}

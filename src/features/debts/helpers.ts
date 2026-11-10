import type { PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

export type DebtFilter = 'all' | 'owedToMe' | 'iOwe' | 'settled';

export type DebtRow = {
  debt: PersonDebt;
  balance: bigint;
};

export function debtRows(snapshot: Snapshot, filter: DebtFilter, onDate?: string): DebtRow[] {
  const today = onDate ?? '9999-12-31';
  return snapshot.debts
    .filter((d) => {
      if (filter === 'all') return d.status === 'open';
      if (filter === 'settled') return d.status === 'settled' || d.status === 'written_off';
      if (filter === 'owedToMe') return d.direction === 'owedToMe' && d.status === 'open';
      return d.direction === 'iOwe' && d.status === 'open';
    })
    .map((debt) => ({
      debt,
      balance: snapshot.chart.get(debt.ledgerAccountId) ? balanceFor(snapshot, debt, onDate) : 0n,
    }))
    .sort((a, b) => {
      const aOver = a.debt.nextDueDate && a.debt.nextDueDate < today && a.debt.status === 'open' ? 0 : 1;
      const bOver = b.debt.nextDueDate && b.debt.nextDueDate < today && b.debt.status === 'open' ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const aDue = a.debt.nextDueDate ?? '9999-12-31';
      const bDue = b.debt.nextDueDate ?? '9999-12-31';
      if (aDue !== bDue) return aDue.localeCompare(bDue);
      return a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1;
    });
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

/** Sum interest lines on collect / loan_repayment events (P16-08). */
export function debtInterestTotal(debt: PersonDebt, snapshot: Snapshot): bigint {
  const interestId = snapshot.chart.system('interest_earned')?.id;
  const chargesId = snapshot.chart.system('interest_and_charges')?.id;
  let sum = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.debtId !== debt.id) continue;
    for (const l of e.lines) {
      if (debt.direction === 'owedToMe' && l.ledgerAccountId === interestId && l.amountMinor < 0n) sum += -l.amountMinor;
      if (debt.direction === 'iOwe' && l.ledgerAccountId === chargesId && l.amountMinor > 0n) sum += l.amountMinor;
    }
  }
  return sum;
}

export function findRecentPayment(debtId: string, snapshot: Snapshot, amount: bigint, date: string): string | null {
  const recent = snapshot.debtEntries.find((e) => e.debtId === debtId && e.kind === 'payment' && e.date === date && BigInt(e.amountMinor) === amount);
  return recent ? recent.date : null;
}

/** DESIGN row monogram: "(TO) Tunde O." */
export function debtInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

/**
 * Settled / written-off date (TB-06).
 * Prefer a write_off entry (its own date), else the latest debt entry, else the
 * write-off / last collect / repayment event on the debt.
 */
export function debtClosedDate(debtId: string, snapshot: Snapshot): string | undefined {
  const entries = snapshot.debtEntries.filter((e) => e.debtId === debtId);
  const writeOff = entries
    .filter((e) => e.kind === 'write_off')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (writeOff) return writeOff.date;
  if (entries.length > 0) {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]!.date;
  }
  const events = snapshot.events
    .filter(
      (e) =>
        e.debtId === debtId &&
        e.status === 'posted' &&
        (e.type === 'write_off' || e.type === 'collect' || e.type === 'loan_repayment'),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return events[0]?.date;
}

export type StrategyResult = {
  totalMonths: number;
  totalInterest: bigint;
  firstVictoryDays: number;
};

export type StrategyComparison = {
  snowball: StrategyResult;
  avalanche: StrategyResult;
  interestSaved: bigint;
  monthsEarlier: number;
  snowballFirstVictoryDays: number;
};

export function simulatePayoffStrategy(
  rows: DebtRow[],
  order: 'smallest' | 'interest',
  extraMonthly: bigint = 0n,
): StrategyResult {
  const active = rows.filter((r) => r.balance > 0n);
  if (active.length === 0) {
    return { totalMonths: 0, totalInterest: 0n, firstVictoryDays: 0 };
  }

  type SimDebt = {
    id: string;
    balance: bigint;
    minPayment: bigint;
    monthlyRatePct: number;
    fixedInterest: bigint;
  };

  const debts: SimDebt[] = active.map((r) => {
    const scheduled = r.debt.scheduleAmountMinor ? BigInt(r.debt.scheduleAmountMinor) : 0n;
    const minPayment = scheduled > 0n ? scheduled : r.balance > 2_000_000n ? r.balance / 20n : r.balance;
    let monthlyRatePct = 0;
    let fixedInterest = 0n;
    if (r.debt.interest?.kind === 'percent_month') {
      monthlyRatePct = r.debt.interest.percent;
    } else if (r.debt.interest?.kind === 'fixed') {
      fixedInterest = BigInt(r.debt.interest.amountMinor);
    }
    return {
      id: r.debt.id,
      balance: r.balance,
      minPayment: minPayment > 0n ? minPayment : 100_000n,
      monthlyRatePct,
      fixedInterest,
    };
  });

  if (order === 'smallest') {
    debts.sort((a, b) => (a.balance === b.balance ? 0 : a.balance < b.balance ? -1 : 1));
  } else {
    debts.sort((a, b) => {
      if (b.monthlyRatePct !== a.monthlyRatePct) return b.monthlyRatePct - a.monthlyRatePct;
      return a.balance === b.balance ? 0 : a.balance < b.balance ? -1 : 1;
    });
  }

  let totalInterest = 0n;
  let months = 0;
  let firstVictoryDays = 0;
  const initialCount = debts.length;
  const totalBudget = debts.reduce((s, d) => s + d.minPayment, 0n) + (extraMonthly > 0n ? extraMonthly : 0n);

  while (debts.some((d) => d.balance > 0n) && months < 360) {
    months += 1;
    let availableForMonth = totalBudget;

    for (const d of debts) {
      if (d.balance <= 0n) continue;
      let monthInt = 0n;
      if (d.monthlyRatePct > 0) {
        monthInt = (d.balance * BigInt(Math.round(d.monthlyRatePct * 100))) / 10_000n;
      } else if (d.fixedInterest > 0n) {
        monthInt = d.fixedInterest;
      }
      d.balance += monthInt;
      totalInterest += monthInt;
    }

    for (const d of debts) {
      if (d.balance <= 0n) continue;
      const payment = d.balance < d.minPayment ? d.balance : d.minPayment;
      const actual = availableForMonth < payment ? availableForMonth : payment;
      d.balance -= actual;
      availableForMonth -= actual;
      if (d.balance === 0n && firstVictoryDays === 0 && debts.filter((x) => x.balance === 0n).length === 1) {
        firstVictoryDays = months * 30;
      }
    }

    for (const d of debts) {
      if (availableForMonth <= 0n) break;
      if (d.balance <= 0n) continue;
      const pay = availableForMonth < d.balance ? availableForMonth : d.balance;
      d.balance -= pay;
      availableForMonth -= pay;
      if (d.balance === 0n && firstVictoryDays === 0 && debts.filter((x) => x.balance === 0n).length === 1) {
        firstVictoryDays = months * 30;
      }
    }
  }

  if (firstVictoryDays === 0 && initialCount > 0) {
    firstVictoryDays = months * 30;
  }

  return { totalMonths: months, totalInterest, firstVictoryDays };
}

export function comparePayoffStrategies(
  rows: DebtRow[],
  extraMonthly: bigint = 0n,
): StrategyComparison | null {
  const active = rows.filter((r) => r.balance > 0n);
  if (active.length === 0) return null;

  const snowball = simulatePayoffStrategy(active, 'smallest', extraMonthly);
  const avalanche = simulatePayoffStrategy(active, 'interest', extraMonthly);

  const interestSaved =
    snowball.totalInterest > avalanche.totalInterest ? snowball.totalInterest - avalanche.totalInterest : 0n;
  const monthsEarlier =
    snowball.totalMonths > avalanche.totalMonths ? snowball.totalMonths - avalanche.totalMonths : 0;

  return {
    snowball,
    avalanche,
    interestSaved,
    monthsEarlier,
    snowballFirstVictoryDays: Math.max(30, snowball.firstVictoryDays),
  };
}

export function calculateRealApr(
  monthlyPct: number,
  principalMinor: bigint,
  tenorMonths = 6,
): { annualAprPct: number; totalInterestMinor: bigint } {
  const annualAprPct = Math.round(monthlyPct * 12 * 10) / 10;
  const totalInterestMinor =
    (principalMinor * BigInt(Math.round(monthlyPct * 100)) * BigInt(tenorMonths)) / 10_000n;
  return { annualAprPct, totalInterestMinor };
}

export function calculateCashFlowFreed(row: DebtRow): bigint {
  if (row.debt.scheduleAmountMinor) {
    const s = BigInt(row.debt.scheduleAmountMinor);
    if (s > 0n) return s;
  }
  return row.balance > 2_000_000n ? row.balance / 20n : row.balance;
}

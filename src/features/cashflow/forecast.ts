import type { Snapshot } from '@/data/workspace/repository';
import { ledgerBalance } from '@/ledger';

const CASH_TYPES = new Set(['bank', 'savings', 'cash', 'wallet', 'card']);

export type ForecastDay = {
  date: string;
  inflow: bigint;
  outflow: bigint;
  balance: bigint;
};

export type CashFlowForecast = {
  currentLiquid: bigint;
  horizonDays: number;
  days: ForecastDay[];
  minBalance: bigint;
  minBalanceDate: string;
  hasDangerDip: boolean;
  safetyFloor: bigint;
  totalProjectedInflow: bigint;
  totalProjectedOutflow: bigint;
  dailyRunRate: bigint;
  bufferDays: number;
};

export type SimulatorOptions = {
  expenseMinor?: bigint;
  paydayDelayDays?: number;
};

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysToDate(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Calculates forward-looking cash flow forecast merging:
 * 1. Current liquid account balances
 * 2. Scheduled recurring bills and income
 * 3. Debt amortizations
 * 4. Trailing 30-day discretionary run-rate
 * 5. What-if expense or payday delay simulation
 */
export function calculateCashFlowForecast(
  snapshot: Snapshot,
  todayStr: string,
  horizonDays: number = 30,
  sim?: SimulatorOptions,
): CashFlowForecast {
  const safetyFloor = 100_000_00n; // ₦100,000 safety threshold

  // 1. Current Liquid Balance
  const liquidAccounts = snapshot.accounts.filter((a) => CASH_TYPES.has(a.type) && !a.archived);
  let currentLiquid = 0n;
  for (const a of liquidAccounts) {
    currentLiquid += ledgerBalance(a.id, snapshot.events);
  }

  // 2. Trailing 30-day run rate
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const thirtyDaysAgoStr = formatIso(addDaysToDate(todayDate, -30));
  const trailingExpenses = snapshot.events
    .filter((e) => e.date >= thirtyDaysAgoStr && e.date <= todayStr && e.type === 'expense' && e.status === 'posted')
    .reduce((sum, e) => {
      const expenseAmount = e.lines
        .filter((l) => l.amountMinor < 0n)
        .reduce((s, l) => s + -l.amountMinor, 0n);
      return sum + expenseAmount;
    }, 0n);
  const dailyRunRate = trailingExpenses > 0n ? trailingExpenses / 30n : 0n;

  // 3. Map out day-by-day projections
  const dayInflows = new Map<string, bigint>();
  const dayOutflows = new Map<string, bigint>();

  // Scheduled recurring
  for (const r of snapshot.recurring) {
    if (r.cancelled) continue;
    const isIncome = r.kind === 'income';
    const dayOfMonth = r.rule?.on ?? 1;

    for (let m = 0; m <= Math.ceil(horizonDays / 30); m++) {
      const d = new Date(todayDate.getTime());
      d.setUTCMonth(d.getUTCMonth() + m);
      d.setUTCDate(Math.min(dayOfMonth, 28));
      const origDate = formatIso(d);
      if (origDate < todayStr || (r.startDate && origDate < r.startDate)) continue;
      let effDate = origDate;
      if (isIncome && sim?.paydayDelayDays) {
        const delayed = addDaysToDate(new Date(`${effDate}T00:00:00Z`), sim.paydayDelayDays);
        effDate = formatIso(delayed);
      }
      if (effDate >= todayStr && effDate <= formatIso(addDaysToDate(todayDate, horizonDays))) {
        const amount = BigInt(r.amountMinor);
        if (isIncome) {
          dayInflows.set(effDate, (dayInflows.get(effDate) ?? 0n) + amount);
        } else {
          dayOutflows.set(effDate, (dayOutflows.get(effDate) ?? 0n) + amount);
        }
      }
    }
  }

  // Active debts monthly minimum payments
  for (const debt of snapshot.debts) {
    if (debt.status !== 'open' || debt.direction !== 'iOwe') continue;
    const payment = debt.scheduleAmountMinor ? BigInt(debt.scheduleAmountMinor) : 0n;
    if (payment > 0n) {
      // Due around middle of each future month (day 15)
      for (let m = 0; m <= Math.ceil(horizonDays / 30); m++) {
        const d = new Date(todayDate.getTime());
        d.setUTCMonth(d.getUTCMonth() + m);
        d.setUTCDate(15);
        const debtDate = formatIso(d);
        if (debtDate >= todayStr && debtDate <= formatIso(addDaysToDate(todayDate, horizonDays))) {
          dayOutflows.set(debtDate, (dayOutflows.get(debtDate) ?? 0n) + payment);
        }
      }
    }
  }

  // Add simulated expense on Day 7 (or Day 1 if horizon is short)
  if (sim?.expenseMinor && sim.expenseMinor > 0n) {
    const simDay = formatIso(addDaysToDate(todayDate, Math.min(7, horizonDays)));
    dayOutflows.set(simDay, (dayOutflows.get(simDay) ?? 0n) + sim.expenseMinor);
  }

  // 4. Construct Day-by-Day Forecast Curve
  const days: ForecastDay[] = [];
  let runningBalance = currentLiquid;
  let minBalance = currentLiquid;
  let minBalanceDate = todayStr;
  let totalProjectedInflow = 0n;
  let totalProjectedOutflow = 0n;
  let bufferDays = horizonDays;

  for (let i = 1; i <= horizonDays; i++) {
    const curDate = formatIso(addDaysToDate(todayDate, i));
    const inflow = dayInflows.get(curDate) ?? 0n;
    const scheduledOutflow = dayOutflows.get(curDate) ?? 0n;
    const totalDayOutflow = scheduledOutflow + dailyRunRate;

    runningBalance = runningBalance + inflow - totalDayOutflow;
    totalProjectedInflow += inflow;
    totalProjectedOutflow += totalDayOutflow;

    if (runningBalance < minBalance) {
      minBalance = runningBalance;
      minBalanceDate = curDate;
    }

    if (runningBalance < safetyFloor && bufferDays === horizonDays) {
      bufferDays = i;
    }

    days.push({
      date: curDate,
      inflow,
      outflow: totalDayOutflow,
      balance: runningBalance,
    });
  }

  return {
    currentLiquid,
    horizonDays,
    days,
    minBalance,
    minBalanceDate,
    hasDangerDip: minBalance < safetyFloor,
    safetyFloor,
    totalProjectedInflow,
    totalProjectedOutflow,
    dailyRunRate,
    bufferDays,
  };
}

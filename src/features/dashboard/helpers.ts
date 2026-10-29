import type { Recurring } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetForMonth, budgetCategories, barFor, rowFor, assignedOf } from '@/features/budget/helpers';
import { activeGoals, goalCards, type GoalCard } from '@/features/goals/helpers';
import { debtRows, debtTotals } from '@/features/debts/helpers';
import { dueDateInMonth } from '@/features/plan/recurrence';
import { addDays, rowsFor, today as todayInWorkspace } from '@/features/transactions/helpers';
import { leftToSpend } from '@/ledger/budget';
import {
  categoryActivity,
  ledgerBalance,
  monthOf,
  monthSpent,
  monthsEndingAt,
  netWorth,
  nextMonth,
  periodTotals,
  prevMonth,
  shownBalance,
} from '@/ledger';
import { budgetableIncomeReceived } from '@/features/income/budgetableIncome';
import { t, catalogue, type TextKey } from '@/i18n';

function groupLabel(group: string): string {
  return group in catalogue ? t(group as TextKey) : group;
}

export function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m, 0).getDate();
  return `${month}-${String(d).padStart(2, '0')}`;
}

export function shortMonthLabel(month: string): string {
  const m = Number(month.slice(5, 7));
  return t(`date.month.${m}` as TextKey);
}

export function pctChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return current === 0n ? 0 : null;
  return Number(((current - previous) * 10000n) / (previous < 0n ? -previous : previous)) / 100;
}

export type ChecklistItem = { key: string; done: boolean; labelKey: TextKey; href: string };

export function checklist(snapshot: Snapshot, hidden: boolean) {
  if (hidden) return [];
  const hasTx = snapshot.events.some((e) => e.type !== 'opening_balance' && e.type !== 'reversal');
  const hasPlan = snapshot.assigns.size > 0;
  const items: ChecklistItem[] = [
    { key: 'account', done: snapshot.accounts.some((a) => !a.archived), labelKey: 'dashboard.check.account', href: '/accounts' },
    { key: 'tx', done: hasTx, labelKey: 'dashboard.check.transactions', href: '/transactions' },
    { key: 'plan', done: hasPlan, labelKey: 'dashboard.check.plan', href: '/budget' },
    { key: 'recurring', done: snapshot.recurring.length > 0, labelKey: 'dashboard.check.import', href: '/plan' },
    { key: 'goal', done: snapshot.goals.some((g) => g.status === 'active'), labelKey: 'dashboard.check.goal', href: '/goals' },
    { key: 'twofa', done: false, labelKey: 'dashboard.check.twoFactor', href: '/settings/security' },
  ];
  return items;
}

export function assetDebtTotals(snapshot: Snapshot, onDate: string) {
  let assets = 0n;
  let debts = 0n;
  for (const account of snapshot.chart.all()) {
    if (account.kind !== 'asset' && account.kind !== 'liability') continue;
    const shown = shownBalance(account, ledgerBalance(account.id, snapshot.events, onDate));
    if (account.kind === 'asset' && shown > 0n) assets += shown;
    if (account.kind === 'liability' && shown > 0n) debts += shown;
  }
  return { assets, debts };
}

export function daysLeftInMonth(month: string, todayStr: string): number | null {
  if (monthOf(todayStr) !== month) return null;
  const end = endOfMonth(month);
  const [, , dEnd] = end.split('-').map(Number) as [number, number, number];
  const day = Number(todayStr.slice(8, 10));
  return Math.max(0, dEnd - day);
}

function isPaid(snapshot: Snapshot, recurringId: string, dueDate: string): boolean {
  const occId = `${recurringId}:${dueDate}`;
  return snapshot.occurrences.find((o) => o.id === occId)?.status === 'paid';
}

function dueDatesInRange(recurring: Recurring, from: string, to: string): string[] {
  const out: string[] = [];
  if (recurring.endDate && recurring.endDate < from) return out;
  let month = monthOf(from);
  const endMonth = monthOf(to);
  while (month <= endMonth) {
    if (recurring.rule.every === 'month') {
      const due = dueDateInMonth(recurring.rule, month);
      if (due && due >= recurring.startDate && due >= from && due <= to && (!recurring.endDate || due <= recurring.endDate)) {
        out.push(due);
      }
    }
    month = nextMonth(month);
  }
  if (recurring.rule.every === 'week') {
    let cursor = from;
    while (cursor <= to) {
      const d = new Date(`${cursor}T12:00:00Z`);
      if (d.getUTCDay() === recurring.rule.on && cursor >= recurring.startDate && (!recurring.endDate || cursor <= recurring.endDate)) {
        out.push(cursor);
      }
      cursor = addDays(cursor, 1);
    }
  }
  return out;
}

export type ComingUpRow = {
  recurring: Recurring;
  dueDate: string;
  amountMinor: bigint;
  overdue: boolean;
};

/** P05-10: next 14 days of bills and income, overdue first. */
export function comingUp(snapshot: Snapshot, todayStr: string, horizonDays = 14): ComingUpRow[] {
  const end = addDays(todayStr, horizonDays);
  const lookback = addDays(todayStr, -60);
  const rows: ComingUpRow[] = [];
  for (const recurring of snapshot.recurring) {
    for (const dueDate of dueDatesInRange(recurring, lookback, end)) {
      if (isPaid(snapshot, recurring.id, dueDate)) continue;
      const overdue = dueDate < todayStr;
      if (!overdue && dueDate > end) continue;
      rows.push({
        recurring,
        dueDate,
        amountMinor: BigInt(recurring.amountMinor),
        overdue,
      });
    }
  }
  return rows.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function goalsDashboard(snapshot: Snapshot, todayStr: string): GoalCard[] {
  return activeGoals(goalCards(snapshot, todayStr)).slice(0, 3);
}

export function debtsDashboard(snapshot: Snapshot) {
  const rows = debtRows(snapshot, 'all', todayInWorkspace());
  return debtTotals(rows);
}

export function dashboardModel(snapshot: Snapshot, month: string) {
  const totals = periodTotals(snapshot.events);
  const prev = prevMonth(month);
  const income = budgetableIncomeReceived(snapshot, month);
  const spent = monthSpent(snapshot.chart, totals, month);
  const netCash = income - spent;
  const budget = budgetForMonth(snapshot, month);
  const budgetLeft = snapshot.settings.budgetStyle === 'envelope' ? budget.leftToPlan : leftToSpend(budget);
  const worthNow = netWorth(snapshot.chart, snapshot.events, endOfMonth(month)).total;
  const worthPrev = netWorth(snapshot.chart, snapshot.events, endOfMonth(prev)).total;
  const months12 = monthsEndingAt(month, 12);
  const netWorthLine = months12.map((m) => ({
    label: shortMonthLabel(m),
    value: netWorth(snapshot.chart, snapshot.events, endOfMonth(m)).total,
  }));
  const months6 = monthsEndingAt(month, 6);
  const incomeVsSpent = months6.flatMap((m) => [
    { label: `${shortMonthLabel(m)} ${t('dashboard.incomeShort')}`, value: budgetableIncomeReceived(snapshot, m) },
    { label: `${shortMonthLabel(m)} ${t('dashboard.spentShort')}`, value: monthSpent(snapshot.chart, totals, m) },
  ]);
  const spentThis = monthSpent(snapshot.chart, totals, month);
  const spentLast = monthSpent(snapshot.chart, totals, prev);
  const spendingTrend = [
    { label: t('dashboard.thisMonth'), value: spentThis },
    { label: t('dashboard.lastMonth'), value: spentLast },
  ];
  const cats = budgetCategories(snapshot);
  const progress = cats
    .map((c) => {
      const row = rowFor(snapshot, month, c.id);
      const state = barFor(snapshot, month, c.id);
      const plan = row.carried + row.assigned;
      return { category: c, row, state, plan };
    })
    .filter((p) => p.plan > 0n || p.row.activity > 0n)
    .sort((a, b) => {
      const pa = a.plan <= 0n ? 1 : Number((a.row.activity * 1000n) / a.plan);
      const pb = b.plan <= 0n ? 1 : Number((b.row.activity * 1000n) / b.plan);
      return pb - pa;
    })
    .slice(0, 5);
  const groupSpend = new Map<string, bigint>();
  for (const c of cats) {
    const activity = categoryActivity(totals, month, c.id);
    if (activity <= 0n) continue;
    groupSpend.set(c.group, (groupSpend.get(c.group) ?? 0n) + activity);
  }
  const where = [...groupSpend.entries()]
    .sort((a, b) => (a[1] > b[1] ? -1 : 1))
    .slice(0, 6)
    .map(([group, value]) => ({
      label: groupLabel(group),
      value,
    }));
  const recent = rowsFor(snapshot)
    .filter((r) => monthOf(r.event.date) === month)
    .slice(0, 8);
  const plannedTotal = cats.reduce((s, c) => s + assignedOf(snapshot, c.id, month) + rowFor(snapshot, month, c.id).carried, 0n);
  const todayStr = todayInWorkspace();
  const onDate = endOfMonth(month);
  const { assets, debts } = assetDebtTotals(snapshot, onDate);
  return {
    income,
    spent,
    netCash,
    budgetLeft,
    incomeChange: pctChange(income, budgetableIncomeReceived(snapshot, prev)),
    spentChange: pctChange(spent, monthSpent(snapshot.chart, totals, prev)),
    worthNow,
    worthChange: worthNow - worthPrev,
    netWorthLine,
    incomeVsSpent,
    spendingTrend,
    progress,
    where,
    recent,
    leftToSpend: leftToSpend(budget),
    plannedTotal,
    comingUp: comingUp(snapshot, todayStr),
    goals: goalsDashboard(snapshot, todayStr),
    debts: debtsDashboard(snapshot),
    assets,
    liabilityTotal: debts,
    daysLeft: daysLeftInMonth(month, todayStr),
  };
}

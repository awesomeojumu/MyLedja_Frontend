import type { TextKey } from '@/i18n';
import { t } from '@/i18n';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetAssignId } from '@/data/workspace/model';
import {
  barState,
  categoryActivity,
  envelopeBudget,
  monthIncome,
  monthOf,
  monthsEndingAt,
  nextMonth,
  periodTotals,
  prevMonth,
  trackingBudget,
  type BarState,
} from '@/ledger';
import type { BudgetMonth, BudgetRow } from '@/ledger/budget';

/** Expense categories that appear on the Budget page. */
export function budgetCategories(snapshot: Snapshot) {
  return snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden && c.countInBudget);
}

export type BudgetGroupBy = 'groups' | 'type';

export function groupedBudgetCategories(snapshot: Snapshot, groupBy: BudgetGroupBy) {
  const cats = budgetCategories(snapshot);
  const keyOf = (c: (typeof cats)[0]) => (groupBy === 'type' ? c.budgetType : c.group);
  const groups = new Map<string, typeof cats>();
  for (const cat of cats) {
    const list = groups.get(keyOf(cat)) ?? [];
    list.push(cat);
    groups.set(keyOf(cat), list);
  }
  return [...groups.entries()];
}

export function assignedOf(snapshot: Snapshot, categoryId: string, month: string): bigint {
  return snapshot.assigns.get(budgetAssignId(categoryId, month)) ?? 0n;
}

/** Runs the ledger budget formulas for one month (and the prior month when envelope needs carry). */
export function budgetForMonth(snapshot: Snapshot, month: string): BudgetMonth {
  const cats = budgetCategories(snapshot);
  const totals = periodTotals(snapshot.events);
  const months =
    snapshot.settings.budgetStyle === 'envelope' ? [prevMonth(month), month].filter((m, i, a) => i === 0 || a[i - 1] !== m) : [month];
  const run = snapshot.settings.budgetStyle === 'envelope' ? envelopeBudget : trackingBudget;
  const result = run({
    months,
    categories: cats.map((c) => ({ ledgerAccountId: c.id, carryOver: c.carryOver })),
    assigned: (id, m) => assignedOf(snapshot, id, m),
    activity: (id, m) => categoryActivity(totals, m, id),
    budgetableIncome: (m) => monthIncome(snapshot.chart, totals, m, true),
  });
  return result.find((b) => b.month === month) ?? result[0]!;
}

export function rowFor(snapshot: Snapshot, month: string, categoryId: string): BudgetRow {
  const monthBudget = budgetForMonth(snapshot, month);
  return monthBudget.rows.get(categoryId) ?? { carried: 0n, assigned: 0n, activity: 0n, available: 0n };
}

export function barFor(snapshot: Snapshot, month: string, categoryId: string): BarState {
  const row = rowFor(snapshot, month, categoryId);
  return barState(row.activity, row.carried + row.assigned);
}

/** Categories overspent this month (envelope cover sheet). */
export function overspentCategories(snapshot: Snapshot, month: string) {
  const monthBudget = budgetForMonth(snapshot, month);
  return budgetCategories(snapshot)
    .map((c) => {
      const row = monthBudget.rows.get(c.id);
      const over = row && row.available < 0n ? -row.available : 0n;
      return { category: c, over };
    })
    .filter((x) => x.over > 0n);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return t('date.monthYear', { month: t(`date.month.${m}` as TextKey), y });
}

export function shortMonth(month: string): string {
  const m = Number(month.slice(5, 7));
  return t(`date.month.${m}` as TextKey);
}

/** Six-month average of activity for a category. */
export function sixMonthAverage(snapshot: Snapshot, categoryId: string, endMonth: string): bigint {
  const months = monthsEndingAt(endMonth, 6);
  const totals = periodTotals(snapshot.events);
  let sum = 0n;
  for (const m of months) sum += categoryActivity(totals, m, categoryId);
  return sum / 6n;
}

export function threeMonthAverage(snapshot: Snapshot, categoryId: string, endMonth: string): bigint {
  const months = monthsEndingAt(endMonth, 3);
  const totals = periodTotals(snapshot.events);
  let sum = 0n;
  for (const m of months) sum += categoryActivity(totals, m, categoryId);
  return sum / 3n;
}

export { monthOf, nextMonth, prevMonth, monthsEndingAt, periodTotals, categoryActivity };

import type { BudgetTemplateLine } from '@/data/workspace/model';
import type { TextKey } from '@/i18n';
import { t } from '@/i18n';
import type { Snapshot } from '@/data/workspace/repository';
import { budgetAssignId } from '@/data/workspace/model';
import { formatNaira } from '@/money';
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
import { budgetableIncomeReceived } from '@/features/income/budgetableIncome';

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
  // E19: goal spend posts to the category but is not overspending (TECH-SPEC 6.6 / P06-08).
  const budgetEvents = snapshot.events.filter((e) => !e.goalId);
  const totals = periodTotals(budgetEvents);
  const months =
    snapshot.settings.budgetStyle === 'envelope' ? [prevMonth(month), month].filter((m, i, a) => i === 0 || a[i - 1] !== m) : [month];
  const run = snapshot.settings.budgetStyle === 'envelope' ? envelopeBudget : trackingBudget;
  const result = run({
    months,
    categories: cats.map((c) => ({ ledgerAccountId: c.id, carryOver: c.carryOver })),
    assigned: (id, m) => assignedOf(snapshot, id, m),
    activity: (id, m) => categoryActivity(totals, m, id),
    budgetableIncome: (m) => budgetableIncomeReceived(snapshot, m),
    goalAllocations: (m) =>
      snapshot.allocations
        .filter((a) => a.kind !== 'spend' && monthOf(a.date) === m)
        .reduce((s, a) => s + BigInt(a.amountMinor), 0n),
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

export function assignNoteOf(snapshot: Snapshot, categoryId: string, month: string): string {
  return snapshot.assignNotes.get(budgetAssignId(categoryId, month)) ?? '';
}

/** Plain-words label for a template line (DESIGN #9). */
export function templateLineLabel(snapshot: Snapshot, line: BudgetTemplateLine): string {
  const kind = line.ruleKind ?? 'monthly';
  const meta = line.ruleMeta ?? {};
  if (kind === 'saveBy') {
    const target = meta.targetMinor ? formatNaira(BigInt(meta.targetMinor)) : t('common.notSet');
    const when = meta.targetMonth ? shortMonth(meta.targetMonth) : t('common.notSet');
    return t('budget.templatesRuleSaveBy', { amount: target, month: when });
  }
  if (kind === 'coverBill') {
    const bill = snapshot.recurring.find((r) => r.id === meta.recurringId);
    return t('budget.templatesRuleCoverBill', { name: bill?.name ?? t('common.notSet') });
  }
  if (kind === 'average') {
    const n = meta.months ?? '3';
    return t('budget.templatesRuleAverage', { count: n });
  }
  if (kind === 'cap') {
    return t('budget.templatesRuleCap', { amount: meta.maxMinor ? formatNaira(BigInt(meta.maxMinor)) : t('common.notSet') });
  }
  const amount = line.amountMinor ? BigInt(line.amountMinor) : 0n;
  return t('budget.templatesRuleMonthly', { amount: formatNaira(amount) });
}

/** Amount this template line would assign for the given month. */
export function resolveTemplateLineAmount(snapshot: Snapshot, month: string, line: BudgetTemplateLine): bigint {
  const kind = line.ruleKind ?? 'monthly';
  const meta = line.ruleMeta ?? {};
  if (kind === 'monthly' && line.amountMinor) return BigInt(line.amountMinor);
  if (kind === 'average') {
    const n = Number(meta.months ?? '3');
    const months = monthsEndingAt(month, Math.max(1, n));
    const totals = periodTotals(snapshot.events);
    let sum = 0n;
    for (const m of months) sum += categoryActivity(totals, m, line.categoryId);
    return sum / BigInt(months.length);
  }
  if (kind === 'cap') {
    const max = meta.maxMinor ? BigInt(meta.maxMinor) : 0n;
    const avg = threeMonthAverage(snapshot, line.categoryId, month);
    return avg > max && max > 0n ? max : avg;
  }
  if (kind === 'coverBill') {
    const bill = snapshot.recurring.find((r) => r.id === meta.recurringId);
    return bill ? BigInt(bill.amountMinor) : 0n;
  }
  if (kind === 'saveBy') {
    const target = meta.targetMinor ? BigInt(meta.targetMinor) : 0n;
    const targetMonth = meta.targetMonth;
    if (!target || !targetMonth || targetMonth <= month) return target;
    // Spread over the months left, counting this one: ₦120,000.00 by December, from October, is ₦40,000.00 a month.
    const monthsLeft = monthsBetween(month, targetMonth) + 1;
    return target / BigInt(monthsLeft);
  }
  if (line.amountMinor) return BigInt(line.amountMinor);
  return 0n;
}

function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number) as [number, number];
  const [y2, m2] = to.split('-').map(Number) as [number, number];
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Suggested template amount for edit-amount quick pick (#7). */
export function templateAmountForCategory(snapshot: Snapshot, categoryId: string, month: string): bigint | null {
  for (const tpl of snapshot.budgetTemplates) {
    for (const line of tpl.lines) {
      if (line.categoryId !== categoryId) continue;
      const amount = resolveTemplateLineAmount(snapshot, month, line);
      if (amount > 0n) return amount;
    }
  }
  return null;
}

export function categoryTemplateLines(snapshot: Snapshot, categoryId: string) {
  const out: { templateName: string; line: BudgetTemplateLine }[] = [];
  for (const tpl of snapshot.budgetTemplates) {
    for (const line of tpl.lines) {
      if (line.categoryId === categoryId) out.push({ templateName: tpl.name, line });
    }
  }
  return out;
}

/** Budgetable income for the month (tracking banner / summary). */
export function budgetableIncomeOf(snapshot: Snapshot, month: string): bigint {
  return monthIncome(snapshot.chart, periodTotals(snapshot.events), month, true);
}

/** All income received in the month (summary Income received). */
export function incomeReceivedOf(snapshot: Snapshot, month: string): bigint {
  return monthIncome(snapshot.chart, periodTotals(snapshot.events), month, false);
}

/** Sum of carried + assigned across budget expense categories. */
export function plannedTotalOf(snapshot: Snapshot, month: string): bigint {
  const budget = budgetForMonth(snapshot, month);
  let planned = 0n;
  for (const cat of budgetCategories(snapshot)) {
    const row = budget.rows.get(cat.id);
    if (row) planned += row.carried + row.assigned;
  }
  return planned;
}

/** Totals for a group of categories in one month. */
export function groupTotals(snapshot: Snapshot, month: string, categoryIds: string[]) {
  let planned = 0n;
  let spent = 0n;
  let remaining = 0n;
  for (const id of categoryIds) {
    const row = rowFor(snapshot, month, id);
    planned += row.carried + row.assigned;
    spent += row.activity;
    remaining += row.available;
  }
  return { planned, spent, remaining };
}

/** Summary breakdown by budget type for the summary column (D18). */
export function summaryByType(snapshot: Snapshot, month: string) {
  const budget = budgetForMonth(snapshot, month);
  const byType = {
    fixed: { planned: 0n, spent: 0n },
    flexible: { planned: 0n, spent: 0n },
    nonMonthly: { planned: 0n, spent: 0n },
    savings: { planned: 0n, spent: 0n },
  };
  for (const cat of budgetCategories(snapshot)) {
    const row = budget.rows.get(cat.id);
    if (!row) continue;
    const bucket = byType[cat.budgetType] ?? byType.flexible;
    bucket.planned += row.carried + row.assigned;
    bucket.spent += row.activity;
  }
  return byType;
}

export { monthOf, nextMonth, prevMonth, monthsEndingAt, periodTotals, categoryActivity };

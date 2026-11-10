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
import { dueDatesInMonth } from '@/features/plan/recurrence';

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

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
}

export function dayOfMonth(dateString: string): number {
  return Number(dateString.slice(8, 10));
}

export function categoryPace(
  row: BudgetRow,
  month: string,
  asOfDate: string,
): 'onTrack' | 'fast' | 'over' | null {
  const plan = row.carried + row.assigned;
  if (plan <= 0n) return null;
  if (row.activity > plan) return 'over';
  const currentMonth = monthOf(asOfDate);
  if (month !== currentMonth) return null;
  const totalDays = daysInMonth(month);
  const currentDay = Math.min(totalDays, Math.max(1, dayOfMonth(asOfDate)));
  const timeElapsedFraction = currentDay / totalDays;
  const spentFraction = Number(row.activity) / Number(plan);
  if (spentFraction > timeElapsedFraction + 0.15) return 'fast';
  return 'onTrack';
}

export function categoryTemplateInfo(
  snapshot: Snapshot,
  categoryId: string,
  month: string,
  planned: bigint,
): { hasTemplate: boolean; unmet: boolean; targetAmount: bigint } {
  const lines = categoryTemplateLines(snapshot, categoryId);
  const bill = snapshot.recurring.find(
    (r) => r.categoryId === categoryId && (r.kind === 'bill' || r.kind === 'subscription') && !r.cancelled,
  );
  const hasTemplate = lines.length > 0 || bill !== undefined;
  if (!hasTemplate) return { hasTemplate: false, unmet: false, targetAmount: 0n };
  let target = 0n;
  for (const item of lines) {
    const amt = resolveTemplateLineAmount(snapshot, month, item.line);
    if (amt > target) target = amt;
  }
  if (bill && BigInt(bill.amountMinor) > target) {
    target = BigInt(bill.amountMinor);
  }
  const unmet = target > 0n && planned < target;
  return { hasTemplate: true, unmet, targetAmount: target };
}

export function smartCoverSuggestions(snapshot: Snapshot, month: string) {
  const overspent = overspentCategories(snapshot, month);
  if (overspent.length === 0) return [];
  const budget = budgetForMonth(snapshot, month);
  const candidates = budgetCategories(snapshot)
    .filter((c) => !overspent.some((o) => o.category.id === c.id))
    .map((c) => ({
      category: c,
      available: budget.rows.get(c.id)?.available ?? 0n,
    }))
    .filter((c) => c.available > 0n)
    .sort((a, b) => {
      const order = { flexible: 0, fixed: 1, nonMonthly: 2, savings: 3 };
      const diff = (order[a.category.budgetType] ?? 0) - (order[b.category.budgetType] ?? 0);
      if (diff !== 0) return diff;
      return Number(b.available - a.available);
    });

  const suggestions: {
    overspentId: string;
    overspentName: string;
    overAmount: bigint;
    fromId: string;
    fromName: string;
    coverAmount: bigint;
  }[] = [];
  const candidateBalances = new Map(candidates.map((c) => [c.category.id, c.available]));

  for (const o of overspent) {
    let needed = o.over;
    for (const c of candidates) {
      if (needed <= 0n) break;
      const currentAvail = candidateBalances.get(c.category.id) ?? 0n;
      if (currentAvail <= 0n) continue;
      const take = currentAvail >= needed ? needed : currentAvail;
      suggestions.push({
        overspentId: o.category.id,
        overspentName: o.category.name,
        overAmount: o.over,
        fromId: c.category.id,
        fromName: c.category.name,
        coverAmount: take,
      });
      needed -= take;
      candidateBalances.set(c.category.id, currentAvail - take);
    }
  }
  return suggestions;
}

export function sinkingFundInfo(
  snapshot: Snapshot,
  categoryId: string,
  month: string,
): { target: bigint; saved: bigint; neededPerMonth: bigint } | null {
  const goal = snapshot.goals.find((g) => g.categoryId === categoryId && g.status === 'active');
  const lines = categoryTemplateLines(snapshot, categoryId);
  const saveByLine = lines.find((l) => l.line.ruleKind === 'saveBy');

  if (!goal && !saveByLine) return null;

  const target = goal ? BigInt(goal.targetMinor) : BigInt(saveByLine?.line.ruleMeta?.targetMinor ?? '0');
  if (target <= 0n) return null;

  let saved = 0n;
  if (goal) {
    for (const a of snapshot.allocations) {
      if (a.goalId === goal.id) {
        saved += a.kind === 'spend' ? -BigInt(a.amountMinor) : BigInt(a.amountMinor);
      }
    }
  } else {
    const row = rowFor(snapshot, month, categoryId);
    saved = row.available > 0n ? row.available : 0n;
  }

  const targetMonth = goal?.targetDate ? monthOf(goal.targetDate) : saveByLine?.line.ruleMeta?.targetMonth;
  let neededPerMonth = 0n;
  if (targetMonth && targetMonth > month) {
    const monthsLeft = monthsBetween(month, targetMonth) + 1;
    const remaining = target > saved ? target - saved : 0n;
    neededPerMonth = remaining / BigInt(Math.max(1, monthsLeft));
  } else if (target > saved) {
    neededPerMonth = target - saved;
  }

  return { target, saved: saved > 0n ? saved : 0n, neededPerMonth };
}

export type CategoryBurnRate = {
  totalDays: number;
  currentDay: number;
  daysRemaining: number;
  dailyBurn: bigint;
  plannedDailyRate: bigint;
  projectedTotal: bigint;
  pace: 'onTrack' | 'fast' | 'over' | null;
  limitDay: number;
  isProjectedEarly: boolean;
};

export function categoryBurnRate(
  row: BudgetRow,
  month: string,
  asOfDate: string,
): CategoryBurnRate {
  const totalDays = daysInMonth(month);
  const currentDay = Math.min(totalDays, Math.max(1, dayOfMonth(asOfDate)));
  const daysRemaining = Math.max(0, totalDays - currentDay);
  const spent = row.activity;
  const plan = row.carried + row.assigned;
  const dailyBurn = currentDay > 0 ? spent / BigInt(currentDay) : 0n;
  const plannedDailyRate = plan > 0n ? plan / BigInt(totalDays) : 0n;
  const projectedTotal = dailyBurn * BigInt(totalDays);
  const pace = categoryPace(row, month, asOfDate);

  let limitDay = totalDays;
  let isProjectedEarly = false;
  if (spent > 0n && plan > 0n && spent < plan) {
    const projectedLimit = Math.round(Number((plan * BigInt(currentDay)) / spent));
    if (projectedLimit < totalDays) {
      limitDay = Math.max(currentDay, projectedLimit);
      isProjectedEarly = true;
    }
  }

  return {
    totalDays,
    currentDay,
    daysRemaining,
    dailyBurn,
    plannedDailyRate,
    projectedTotal,
    pace,
    limitDay,
    isProjectedEarly,
  };
}

export type CategoryMerchant = {
  name: string;
  amount: bigint;
  percentage: number;
};

export function categoryMerchantBreakdown(
  snapshot: Snapshot,
  categoryId: string,
  month: string,
): CategoryMerchant[] {
  const spendByPayee = new Map<string, bigint>();
  let totalSpent = 0n;

  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'expense' || monthOf(e.date) !== month) continue;
    const catLine = e.lines.find((l) => l.ledgerAccountId === categoryId);
    if (!catLine) continue;
    const payeeName = (e.payeeName ?? '').trim() || t('common.notSet');
    const amt = catLine.amountMinor;
    totalSpent += amt;
    spendByPayee.set(payeeName, (spendByPayee.get(payeeName) ?? 0n) + amt);
  }

  if (totalSpent <= 0n) return [];

  const list: CategoryMerchant[] = [];
  for (const [name, amount] of spendByPayee.entries()) {
    const percentage = Math.round(Number((amount * 100n) / totalSpent));
    list.push({ name, amount, percentage });
  }

  list.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  return list.slice(0, 5);
}

export function categoryUpcomingBills(
  snapshot: Snapshot,
  categoryId: string,
  month: string,
) {
  const candidateBills = snapshot.recurring.filter(
    (r) =>
      r.categoryId === categoryId &&
      (r.kind === 'bill' || r.kind === 'subscription') &&
      !r.cancelled,
  );
  const billsWithDue: { bill: (typeof candidateBills)[0]; dueDate: string }[] = [];
  for (const b of candidateBills) {
    const dates = dueDatesInMonth(b.rule, month, b.startDate, b.endDate);
    if (dates.length > 0) {
      billsWithDue.push({ bill: b, dueDate: dates[0]! });
    }
  }
  const upcomingTotal = billsWithDue.reduce((sum, item) => sum + BigInt(item.bill.amountMinor), 0n);
  const row = rowFor(snapshot, month, categoryId);
  const availableAfterBills = row.available - upcomingTotal;
  return { bills: billsWithDue, upcomingTotal, availableAfterBills };
}

export function categoryActiveRules(snapshot: Snapshot, categoryId: string) {
  return snapshot.rules.filter((r) =>
    r.actions.some((a) => a.kind === 'setCategory' && a.value === categoryId),
  );
}

export { monthOf, nextMonth, prevMonth, monthsEndingAt, periodTotals, categoryActivity };

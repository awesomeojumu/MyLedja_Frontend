/**
 * Welcome's money plan, as pure functions: the budget split, suggested category amounts, goal contributions
 * and the review totals. Amounts are kobo held as strings in the draft and as bigint here.
 */
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY } from '../../data/categoriesTaxonomy';
import { STANDARD_FRAMEWORK_PRESETS, type AllocationFramework, type AllocationPillar } from '../../data/rulesModel';
import type { AccountKind, AccountPurpose } from '../../data/workspace/model';
import { SAVE_OR_INVEST_TAXONOMY_ID } from '../categories/catalog';

export type Money = string;

export type DraftAccount = {
  /** Also the account id: made on the device, kept by the server. */
  id: string;
  name: string;
  institution?: string;
  purpose: AccountPurpose;
  type: AccountKind;
  balance: Money;
};

export type DraftBill = {
  id: string;
  name: string;
  amount: Money;
  /** Day of the month it's due, 1 to 31. */
  day: number;
  /** Catalogue key of its category or subcategory, e.g. `exp-housing:rent`. */
  categoryKey: string;
  accountId: string;
};

export type DebtKind = 'bankLoan' | 'iOwe' | 'owedToMe';

export type DraftDebt = {
  id: string;
  name: string;
  kind: DebtKind;
  /** What's owed today. */
  amount: Money;
  /** Optional monthly repayment; it becomes a bill. */
  monthly: Money;
  day: number;
};

export type GoalKind = 'emergency' | 'savings' | 'investment';

export type DraftGoal = {
  id: string;
  kind: GoalKind;
  name: string;
  target: Money;
  /** YYYY-MM-DD, optional. */
  date: string;
  saved: Money;
  accountId: string;
};

export type CustomCategory = { key: string; name: string; pillarId: string };

export type BudgetStyleChoice = 'envelope' | 'limits' | 'track';

export type SetupDraft = {
  version: 1;
  step: number;
  skipped: number[];
  workspaceName: string;
  currency: string;
  weekStart: 'monday' | 'sunday' | 'saturday';
  accounts: DraftAccount[];
  takeHome: Money;
  payday: number;
  incomeIds: string[];
  budgetStyle: BudgetStyleChoice;
  frameworkId: string;
  /** Pillar id → percentage, when the person changed the preset's split. */
  percents: Record<string, number>;
  expenseIds: string[];
  /** Taxonomy id → subcategories switched on. */
  subcategories: Record<string, string[]>;
  /** Taxonomy id or custom key → pillar id, when moved from the preset's mapping. */
  pillarOf: Record<string, string>;
  /** Taxonomy id or custom key → monthly amount the person typed. */
  amounts: Record<string, Money>;
  customCategories: CustomCategory[];
  bills: DraftBill[];
  debts: DraftDebt[];
  goals: DraftGoal[];
};

export const toMinor = (m: Money | undefined): bigint => {
  if (!m || !/^-?\d+$/.test(m)) return 0n;
  return BigInt(m);
};

export function defaultDraft(name: string, expenseIds: string[], incomeIds: string[], subcategories: Record<string, string[]>): SetupDraft {
  return {
    version: 1,
    step: 0,
    skipped: [],
    workspaceName: name,
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [],
    takeHome: '',
    payday: 25,
    incomeIds,
    budgetStyle: 'limits',
    frameworkId: 'classic_50_30_20',
    percents: {},
    expenseIds: expenseIds.filter((id) => id !== SAVE_OR_INVEST_TAXONOMY_ID),
    subcategories,
    pillarOf: {},
    amounts: {},
    customCategories: [],
    bills: [],
    debts: [],
    goals: [],
  };
}

/** Pillars that money is spent from; the rest (emergency, savings, investment, project) fund goals. */
export const isSpendingPillar = (p: AllocationPillar) => p.purposeAccountType === 'operating' || p.purposeAccountType === 'bills';

/** The chosen structure with the person's percentages applied. */
export function frameworkOf(draft: Pick<SetupDraft, 'frameworkId' | 'percents'>): AllocationFramework {
  const base = STANDARD_FRAMEWORK_PRESETS.find((f) => f.id === draft.frameworkId) ?? STANDARD_FRAMEWORK_PRESETS[0]!;
  return {
    ...base,
    pillars: base.pillars.map((p) => ({ ...p, percentage: draft.percents[p.id] ?? p.percentage })),
  };
}

export const totalPercent = (fw: AllocationFramework) => fw.pillars.reduce((s, p) => s + p.percentage, 0);

/** Each pillar's share of take-home; the last pillar takes the rounding so the parts add up exactly. */
export function pillarAmounts(fw: AllocationFramework, takeHome: bigint): Map<string, bigint> {
  const out = new Map<string, bigint>();
  let used = 0n;
  fw.pillars.forEach((p, i) => {
    const last = i === fw.pillars.length - 1 && totalPercent(fw) === 100;
    const amount = last ? takeHome - used : (takeHome * BigInt(Math.round(p.percentage))) / 100n;
    out.set(p.id, amount > 0n ? amount : 0n);
    used += amount;
  });
  return out;
}

/** A spending line on the plan: a taxonomy category or one of the person's own. */
export type PlanLine = { key: string; name: string; pillarId: string; custom: boolean };

/** Spending categories switched on, each under a spending pillar of the structure. */
export function planLines(draft: SetupDraft, fw: AllocationFramework = frameworkOf(draft)): PlanLine[] {
  const spending = fw.pillars.filter(isSpendingPillar);
  const fallback = spending[spending.length > 1 ? 1 : 0]?.id ?? fw.pillars[0]!.id;
  const valid = new Set(spending.map((p) => p.id));
  const lines: PlanLine[] = [];
  for (const def of EXPENSE_TAXONOMY) {
    if (!draft.expenseIds.includes(def.id) || def.id === SAVE_OR_INVEST_TAXONOMY_ID) continue;
    const mapped = spending.find((p) => p.mappedExpenseCategories.includes(def.name))?.id;
    const chosen = draft.pillarOf[def.id];
    lines.push({ key: def.id, name: def.name, pillarId: chosen && valid.has(chosen) ? chosen : (mapped ?? fallback), custom: false });
  }
  for (const c of draft.customCategories) {
    lines.push({ key: c.key, name: c.name, pillarId: valid.has(c.pillarId) ? c.pillarId : fallback, custom: true });
  }
  return lines;
}

/** Monthly debt repayments are bills too, filed under Financial Obligations. */
export const DEBT_REPAYMENT_CATEGORY = 'exp-financial';

/** Every fixed monthly payment: the bills, plus repayments on debts the person owes. */
export function allBills(draft: Pick<SetupDraft, 'bills' | 'debts'>): { categoryKey: string; amount: bigint }[] {
  return [
    ...draft.bills.map((b) => ({ categoryKey: b.categoryKey, amount: toMinor(b.amount) })),
    ...draft.debts
      .filter((d) => d.kind !== 'owedToMe' && toMinor(d.monthly) > 0n)
      .map((d) => ({ categoryKey: DEBT_REPAYMENT_CATEGORY, amount: toMinor(d.monthly) })),
  ];
}

/** Bills per catalogue category (subcategory bills count towards their category). */
export function billsByCategory(draft: Pick<SetupDraft, 'bills' | 'debts'>): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const b of allBills(draft)) {
    const key = b.categoryKey.split(':')[0]!;
    out.set(key, (out.get(key) ?? 0n) + b.amount);
  }
  return out;
}

/**
 * Monthly amount per spending line. A typed amount wins. Otherwise each pillar first covers the bills filed
 * under its categories, and what's left is shared equally between its categories.
 */
export function lineAmounts(draft: SetupDraft, fw: AllocationFramework = frameworkOf(draft)): Map<string, bigint> {
  const takeHome = toMinor(draft.takeHome);
  const byPillar = pillarAmounts(fw, takeHome);
  const bills = billsByCategory(draft);
  const lines = planLines(draft, fw);
  const out = new Map<string, bigint>();
  for (const pillar of fw.pillars.filter(isSpendingPillar)) {
    const mine = lines.filter((l) => l.pillarId === pillar.id);
    if (mine.length === 0) continue;
    const typed = mine.filter((l) => draft.amounts[l.key] !== undefined && draft.amounts[l.key] !== '');
    const open = mine.filter((l) => !typed.includes(l));
    let left = byPillar.get(pillar.id) ?? 0n;
    for (const l of typed) {
      const amount = toMinor(draft.amounts[l.key]);
      out.set(l.key, amount);
      left -= amount;
    }
    for (const l of open) {
      const bill = bills.get(l.key) ?? 0n;
      out.set(l.key, bill);
      left -= bill;
    }
    if (left > 0n && open.length > 0) {
      const share = left / BigInt(open.length);
      let remainder = left - share * BigInt(open.length);
      for (const l of open) {
        const extra = remainder > 0n ? 1n : 0n;
        remainder -= extra;
        out.set(l.key, (out.get(l.key) ?? 0n) + share + extra);
      }
    }
  }
  return out;
}

/** Whole months from `from` until a YYYY-MM-DD date, at least one; twelve when there's no date. */
export function monthsUntil(date: string, from = new Date()): number {
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return 12;
  return Math.max(1, (y - from.getFullYear()) * 12 + (m - 1 - from.getMonth()));
}

/** What a goal needs each month to reach its target on time. */
export function goalMonthly(goal: Pick<DraftGoal, 'target' | 'saved' | 'date'>, from = new Date()): bigint {
  const left = toMinor(goal.target) - toMinor(goal.saved);
  if (left <= 0n) return 0n;
  const months = BigInt(monthsUntil(goal.date, from));
  return (left + months - 1n) / months;
}

/** What a month of essentials costs: the first spending pillar's lines, or the bills if they're more. */
export function monthlyEssentials(draft: SetupDraft, fw: AllocationFramework = frameworkOf(draft)): bigint {
  const first = fw.pillars.find(isSpendingPillar);
  const amounts = lineAmounts(draft, fw);
  const lines = planLines(draft, fw).filter((l) => l.pillarId === first?.id);
  const planned = lines.reduce((s, l) => s + (amounts.get(l.key) ?? 0n), 0n);
  const bills = allBills(draft).reduce((s, b) => s + b.amount, 0n);
  return planned > bills ? planned : bills;
}

export type PlanSummary = {
  takeHome: bigint;
  spendingPlanned: bigint;
  billsTotal: bigint;
  goalsMonthly: bigint;
  savingCapacity: bigint;
  /** Take-home less spending and goal contributions; negative when the plan asks for more than comes in. */
  leftToPlan: bigint;
  pillars: { pillar: AllocationPillar; target: bigint; planned: bigint }[];
  accountsTotal: bigint;
  debtsOwed: bigint;
};

export function summarize(draft: SetupDraft, from = new Date()): PlanSummary {
  const fw = frameworkOf(draft);
  const takeHome = toMinor(draft.takeHome);
  const targets = pillarAmounts(fw, takeHome);
  const amounts = lineAmounts(draft, fw);
  const lines = planLines(draft, fw);
  const goalsMonthly = draft.goals.reduce((s, g) => s + goalMonthly(g, from), 0n);
  const savingPillars = fw.pillars.filter((p) => !isSpendingPillar(p));
  const savingCapacity = savingPillars.reduce((s, p) => s + (targets.get(p.id) ?? 0n), 0n);
  const pillars = fw.pillars.map((pillar) => {
    const planned = isSpendingPillar(pillar)
      ? lines.filter((l) => l.pillarId === pillar.id).reduce((s, l) => s + (amounts.get(l.key) ?? 0n), 0n)
      : // Goal contributions fill the saving pillars in order of size.
        0n;
    return { pillar, target: targets.get(pillar.id) ?? 0n, planned };
  });
  let goalsLeft = goalsMonthly;
  for (const row of pillars) {
    if (isSpendingPillar(row.pillar)) continue;
    const take = goalsLeft < row.target ? goalsLeft : row.target;
    row.planned = take;
    goalsLeft -= take;
  }
  const lastSaving = [...pillars].reverse().find((r) => !isSpendingPillar(r.pillar));
  if (lastSaving && goalsLeft > 0n) lastSaving.planned += goalsLeft;
  const spendingPlanned = lines.reduce((s, l) => s + (amounts.get(l.key) ?? 0n), 0n);
  return {
    takeHome,
    spendingPlanned,
    billsTotal: allBills(draft).reduce((s, b) => s + b.amount, 0n),
    goalsMonthly,
    savingCapacity,
    leftToPlan: takeHome - spendingPlanned - goalsMonthly,
    pillars,
    accountsTotal: draft.accounts.reduce((s, a) => s + toMinor(a.balance), 0n),
    debtsOwed: draft.debts.filter((d) => d.kind !== 'owedToMe').reduce((s, d) => s + toMinor(d.amount), 0n),
  };
}

/** Income sources picked, for the Income step's chips. */
export const incomeDefs = () => INCOME_TAXONOMY;

import type { SetupBody } from '../../api/auth';
import { EXPENSE_TAXONOMY, INCOME_TAXONOMY } from '../../data/categoriesTaxonomy';
import type { AllocationFramework } from '../../data/rulesModel';
import type { Category } from '../../data/workspace/model';
import type { WorkspaceRepository } from '../../data/workspace/repository';
import { ledgerBalance } from '../../ledger';
import { thisMonthCode } from '../../lib/months';
import { catalogEntries, categoryByKey, subKey } from '../categories/catalog';
import {
  frameworkOf,
  goalMonthly,
  isSpendingPillar,
  lineAmounts,
  pillarAmounts,
  planLines,
  toMinor,
  type SetupDraft,
} from './plan';

/** Dashboard "Get started" numbers for skipped steps (P04-02): 3 accounts, 4 categories, 5 budget. */
export const STEP_SKIP_NUMBER: Record<number, number> = { 1: 3, 2: 5, 3: 4 };

const today = () => new Date().toISOString().slice(0, 10);

export type SetupType = SetupBody['accounts'][number]['type'];

/** The one POST /setup body: workspace, accounts (bank loans included), and every category switched on. */
export function setupBody(draft: SetupDraft): SetupBody {
  const categories = catalogEntries(draft.expenseIds, draft.incomeIds, draft.subcategories).map((e) => ({
    key: e.key,
    group: e.group,
    name: e.name,
  }));
  for (const c of draft.customCategories) categories.push({ key: c.key, group: 'My categories', name: c.name });
  const loans = draft.debts
    .filter((d) => d.kind === 'bankLoan' && toMinor(d.amount) > 0n)
    .map((d) => ({ id: d.id, name: d.name, type: 'loan' as SetupType, openingBalance: toMinor(d.amount).toString(), openingDate: today(), currency: draft.currency }));
  return {
    workspaceName: draft.workspaceName.trim() || 'Personal',
    currency: draft.currency,
    weekStart: draft.weekStart,
    budgetStyle: draft.budgetStyle === 'envelope' ? 'envelope' : 'tracking',
    // Welcome plans every category itself, so the server's suggested first budget is not wanted.
    monthlyTakeHome: null,
    accounts: [
      ...draft.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as SetupType,
        purpose: a.purpose,
        openingBalance: toMinor(a.balance).toString(),
        openingDate: today(),
        currency: draft.currency,
      })),
      ...loans,
    ],
    categories,
    skippedSteps: [...new Set(draft.skipped.map((s) => STEP_SKIP_NUMBER[s]).filter((n): n is number => n !== undefined))],
  };
}

/** Each spending category's share of its pillar, as the Budget page reads it (category name → percent). */
export function categoryPercentages(draft: SetupDraft, fw: AllocationFramework = frameworkOf(draft)): Record<string, number> {
  const targets = pillarAmounts(fw, toMinor(draft.takeHome));
  const amounts = lineAmounts(draft, fw);
  const out: Record<string, number> = {};
  for (const line of planLines(draft, fw)) {
    const target = targets.get(line.pillarId) ?? 0n;
    if (target <= 0n) continue;
    out[line.name] = Math.round((Number(amounts.get(line.key) ?? 0n) / Number(target)) * 100);
  }
  return out;
}

/** The structure as it should be saved: the person's split, and each category under the pillar they chose. */
export function savedFramework(draft: SetupDraft): AllocationFramework {
  const fw = frameworkOf(draft);
  const lines = planLines(draft, fw);
  const planned = new Set(lines.map((l) => l.name));
  return {
    ...fw,
    // Each spending category sits in exactly one pillar: the one it was planned under.
    pillars: fw.pillars.map((p) =>
      isSpendingPillar(p)
        ? { ...p, mappedExpenseCategories: lines.filter((l) => l.pillarId === p.id).map((l) => l.name) }
        : { ...p, mappedExpenseCategories: p.mappedExpenseCategories.filter((name) => !planned.has(name)) },
    ),
  };
}

export type FinishDeps = {
  repo: WorkspaceRepository;
  /** POST /setup on the server; null on the built-in mock, which seeds this device instead. */
  sendSetup: ((body: SetupBody) => Promise<void>) | null;
  /** Pulls the server's changes; resolves when one sync round is done. */
  syncNow: () => Promise<void>;
};

export type FinishResult = { failed: string[] };

async function waitFor(repo: WorkspaceRepository, syncNow: () => Promise<void>, ready: (c: Category[], accountIds: Set<string>) => boolean) {
  for (let i = 0; i < 20; i++) {
    await syncNow().catch(() => undefined);
    repo.invalidateCache();
    const snap = await repo.load();
    if (ready(snap.categories, new Set(snap.accounts.map((a) => a.id)))) return;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Turns the draft into the workspace: setup (accounts, opening balances, categories), then this month's budget,
 * the income, bills, debts and goals. Steps after setup carry on past a failure and report it.
 */
export async function finishSetup(draft: SetupDraft, deps: FinishDeps): Promise<FinishResult> {
  const { repo } = deps;
  const failed: string[] = [];
  const body = setupBody(draft);
  const date = today();

  if (deps.sendSetup) {
    await deps.sendSetup(body);
    await waitFor(repo, deps.syncNow, (cats, ids) => body.accounts.every((a) => !a.id || ids.has(a.id)) && cats.length >= body.categories.length);
  } else {
    await repo.seedFromSetup(body);
  }

  let snap = await repo.load();
  const idOf = (key: string, name: string, kind: 'income' | 'expense') => categoryByKey(snap.categories, key, name, kind)?.id;
  const step = async (label: string, run: () => Promise<unknown>) => {
    try {
      const res = (await run()) as { ok?: boolean } | undefined;
      if (res && res.ok === false) failed.push(label);
    } catch (err) {
      console.warn(`Setup: ${label}`, err);
      failed.push(label);
    }
  };

  // This month's budget: every spending category's amount on its general line.
  const fw = frameworkOf(draft);
  const amounts = lineAmounts(draft, fw);
  const month = thisMonthCode();
  for (const line of planLines(draft, fw)) {
    const amount = amounts.get(line.key) ?? 0n;
    const id = idOf(line.key, line.name, 'expense');
    if (amount > 0n && id) await step(`budget ${line.name}`, () => repo.setAssigned(id, month, amount));
  }

  const accountIds = new Set(snap.accounts.map((a) => a.id));
  const everyday = draft.accounts.find((a) => a.purpose === 'operating' && accountIds.has(a.id)) ?? draft.accounts.find((a) => accountIds.has(a.id));
  const incomeAccount = draft.accounts.find((a) => a.purpose === 'income' && accountIds.has(a.id)) ?? everyday;

  // Income: one monthly stream for the take-home, filed under the first income source.
  const take = toMinor(draft.takeHome);
  const incomeDef = INCOME_TAXONOMY.find((d) => draft.incomeIds.includes(d.id));
  const incomeCategory = incomeDef ? idOf(incomeDef.id, incomeDef.name, 'income') : undefined;
  if (take > 0n && incomeAccount && incomeCategory && incomeDef) {
    await step('income', () =>
      repo.addIncomeStream({
        name: incomeDef.name,
        kind: 'regular',
        expectedMinor: take.toString(),
        accountId: incomeAccount.id,
        categoryId: incomeCategory,
        rule: { every: 'month', on: draft.payday },
        countInBudget: true,
      }),
    );
  }

  // Bills, each filed under its subcategory (or category) and paid from the account picked.
  const findKey = (key: string) => {
    const [defId] = key.split(':');
    const def = EXPENSE_TAXONOMY.find((d) => d.id === defId);
    const entry = catalogEntries(draft.expenseIds, draft.incomeIds, draft.subcategories).find((e) => e.key === key);
    return idOf(key, entry?.name ?? def?.name ?? key, 'expense') ?? (def ? idOf(def.id, def.name, 'expense') : undefined);
  };
  for (const bill of draft.bills) {
    const accountId = accountIds.has(bill.accountId) ? bill.accountId : everyday?.id;
    if (!accountId || toMinor(bill.amount) <= 0n) continue;
    await step(`bill ${bill.name}`, () =>
      repo.addRecurring({
        kind: 'bill',
        name: bill.name,
        amountMinor: toMinor(bill.amount).toString(),
        accountId,
        categoryId: findKey(bill.categoryKey),
        rule: { every: 'month', on: bill.day },
        startDate: date,
        reminderDays: 3,
      }),
    );
  }

  // Debts. Bank loans came in as loan accounts. A person's debt is recorded, then the account it touched is put
  // back to the balance the person gave: the money changed hands before today, so it's neither spending nor cash.
  const financial = EXPENSE_TAXONOMY.find((d) => d.id === 'exp-financial');
  const repaymentKey = financial?.subcategories.includes('Loan repayments') ? subKey(financial, 'Loan repayments') : 'exp-financial';
  for (const debt of draft.debts) {
    const amount = toMinor(debt.amount);
    if (amount <= 0n) continue;
    if (debt.kind !== 'bankLoan' && everyday) {
      snap = await repo.load();
      const before = ledgerBalance(everyday.id, snap.events);
      await step(`debt ${debt.name}`, async () => {
        const opened = await repo.openPersonDebt({
          name: debt.name,
          direction: debt.kind === 'owedToMe' ? 'owedToMe' : 'iOwe',
          accountId: everyday.id,
          amount,
          date,
          notes: 'Recorded at setup',
        });
        if (!opened.ok) return opened;
        return repo.correctOpeningBalance(everyday.id, before, date);
      });
    }
    const monthly = toMinor(debt.monthly);
    if (monthly > 0n && debt.kind !== 'owedToMe' && everyday) {
      await step(`repayment ${debt.name}`, () =>
        repo.addRecurring({
          kind: 'bill',
          name: debt.name,
          amountMinor: monthly.toString(),
          accountId: everyday.id,
          categoryId: findKey(repaymentKey),
          rule: { every: 'month', on: debt.day || draft.payday },
          startDate: date,
          reminderDays: 3,
        }),
      );
    }
  }

  // Goals, each kept in its account, with a monthly schedule on payday.
  snap = await repo.load();
  for (const goal of draft.goals) {
    const target = toMinor(goal.target);
    const accountId = snap.accounts.some((a) => a.id === goal.accountId) ? goal.accountId : undefined;
    if (target <= 0n || !accountId) continue;
    const saved = toMinor(goal.saved);
    await step(`goal ${goal.name}`, async () => {
      const added = await repo.addGoal({
        name: goal.name,
        targetMinor: target,
        targetDate: goal.date || undefined,
        accountId,
        alreadySavedMinor: saved > 0n ? (saved > target ? target : saved) : undefined,
      });
      if (!added.ok) return added;
      const monthly = goalMonthly(goal);
      if (monthly > 0n) {
        await repo.setGoalSchedule({
          ...added.value,
          scheduleAmountMinor: monthly.toString(),
          scheduleDayOfMonth: draft.payday,
          scheduleEvery: 'month',
          scheduleStarts: date,
        });
      }
      return added;
    });
  }

  return { failed };
}

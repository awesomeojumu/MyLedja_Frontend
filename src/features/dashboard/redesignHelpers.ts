import type { Snapshot } from '@/data/workspace/repository';
import { budgetableIncomeReceived } from '@/features/income/budgetableIncome';
import { monthsEndingAt, monthSpent, periodTotals } from '@/ledger';
import { t, type TextKey } from '@/i18n';
import { rowsFor } from '@/features/transactions/helpers';

import { comingUp, type ChecklistItem, type ComingUpRow } from './helpers';

/** Figma Get started — 5 steps (Phone 20:2424), not the legacy 6. */
export function redesignChecklist(snapshot: Snapshot, hidden: boolean): ChecklistItem[] {
  if (hidden) return [];
  const hasTx = snapshot.events.some((e) => e.type !== 'opening_balance' && e.type !== 'reversal');
  const hasPlan = [...snapshot.assigns.values()].some((a) => a > 0n);
  const hasBill = snapshot.recurring.some((r) => r.kind === 'bill');
  const hasRule = snapshot.rules.length > 0;
  const items: ChecklistItem[] = [
    {
      key: 'account',
      done: snapshot.accounts.some((a) => !a.archived),
      labelKey: 'dashboard.redesign.check.account',
      href: '/accounts',
    },
    {
      key: 'tx',
      done: hasTx,
      labelKey: 'dashboard.redesign.check.transactions',
      href: '/transactions',
    },
    {
      key: 'bills',
      done: hasBill,
      labelKey: 'dashboard.redesign.check.bills',
      href: '/plan',
    },
    {
      key: 'budget',
      done: hasPlan,
      labelKey: 'dashboard.redesign.check.budget',
      href: '/budget',
    },
    {
      key: 'rule',
      done: hasRule,
      labelKey: 'dashboard.redesign.check.rule',
      href: '/rules',
    },
  ];
  return items.sort((a, b) => Number(a.done) - Number(b.done));
}

export function redesignCheckHint(snapshot: Snapshot, key: string): string {
  if (key === 'account') {
    const a = snapshot.accounts.find((x) => !x.archived);
    return a ? t('dashboard.redesign.check.accountDone', { name: a.name }) : t('dashboard.redesign.check.accountHint');
  }
  if (key === 'tx') {
    const n = snapshot.events.filter((e) => e.type !== 'opening_balance' && e.type !== 'reversal').length;
    return n > 0 ? t('dashboard.redesign.check.txDone', { n }) : t('dashboard.redesign.check.txHint');
  }
  if (key === 'bills') return t('dashboard.redesign.check.billsHint');
  if (key === 'budget') return t('dashboard.redesign.check.budgetHint');
  if (key === 'rule') return t('dashboard.redesign.check.ruleHint');
  return '';
}

export function redesignCheckAction(key: string): TextKey {
  if (key === 'account') return 'dashboard.redesign.check.account';
  if (key === 'tx') return 'dashboard.redesign.check.transactions';
  if (key === 'bills') return 'dashboard.redesign.action.addBills';
  if (key === 'budget') return 'dashboard.redesign.action.planBudget';
  if (key === 'rule') return 'dashboard.redesign.action.setRule';
  return 'dashboard.redesign.action.addBills';
}

/** Last-6-month averages + savings rate (Figma Monthly averages). */
export function monthlyAverages(snapshot: Snapshot, month: string) {
  const months = monthsEndingAt(month, 6);
  const totals = periodTotals(snapshot.events);
  let incomeSum = 0n;
  let spentSum = 0n;
  for (const m of months) {
    incomeSum += budgetableIncomeReceived(snapshot, m);
    spentSum += monthSpent(snapshot.chart, totals, m);
  }
  const n = BigInt(months.length || 1);
  const avgIncome = incomeSum / n;
  const avgSpending = spentSum / n;
  const savingsRate = incomeSum <= 0n ? 0 : Math.round(Number(((incomeSum - spentSum) * 10000n) / incomeSum) / 100);
  return { avgIncome, avgSpending, savingsRate, months: months.length };
}

/** Figma Coming up: next 7 days (not legacy 14). */
export function comingUpWeek(snapshot: Snapshot, todayStr: string): ComingUpRow[] {
  return comingUp(snapshot, todayStr, 7);
}

export function comingUpDueTotal(rows: ComingUpRow[]): bigint {
  return rows.filter((r) => r.recurring.kind === 'bill').reduce((s, r) => s + r.amountMinor, 0n);
}

/** Transactions without a category (Figma Recent “N to sort”). */
export function unsortedCount(snapshot: Snapshot): number {
  return rowsFor(snapshot).filter((r) => {
    if (r.event.type === 'opening_balance' || r.event.type === 'reversal' || r.event.type === 'transfer') return false;
    return !r.category;
  }).length;
}

/** Default savings-rate goal shown in Figma (20%). */
export const REDESIGN_SAVINGS_GOAL_PCT = 20;

export function perDayLeft(left: bigint, daysLeft: number | null): bigint | null {
  if (daysLeft == null || daysLeft <= 0) return null;
  return left / BigInt(daysLeft);
}

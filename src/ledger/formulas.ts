import type { Chart } from './builders';
import type { LedgerAccount, MoneyEvent } from './types';

/** "2026-10-28" → "2026-10". */
export const monthOf = (date: string): string => date.slice(0, 7);

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Pending events don't count; a reversal cancels its original, so both stay in the sums. */
const counts = (e: MoneyEvent) => e.status !== 'pending';

/** TECH-SPEC 6.1: the sum of an account's lines dated on or before `onDate`. */
export function ledgerBalance(accountId: string, events: Iterable<MoneyEvent>, onDate?: string): bigint {
  let total = 0n;
  for (const e of events) {
    if (!counts(e) || (onDate && e.date > onDate)) continue;
    for (const l of e.lines) if (l.ledgerAccountId === accountId) total += l.amountMinor;
  }
  return total;
}

/** What people see: an asset's balance, or for a liability what they owe as a positive figure. */
export function shownBalance(account: LedgerAccount, ledger: bigint): bigint {
  return account.kind === 'liability' ? -ledger : ledger;
}

/** Net movement per account per month, the app's copy of `period_totals`. */
export type PeriodTotals = Map<string, Map<string, bigint>>;

export function periodTotals(events: Iterable<MoneyEvent>): PeriodTotals {
  const totals: PeriodTotals = new Map();
  for (const e of events) {
    if (!counts(e)) continue;
    const month = monthOf(e.date);
    let byAccount = totals.get(month);
    if (!byAccount) totals.set(month, (byAccount = new Map()));
    for (const l of e.lines) byAccount.set(l.ledgerAccountId, (byAccount.get(l.ledgerAccountId) ?? 0n) + l.amountMinor);
  }
  return totals;
}

function sumKind(chart: Chart, totals: PeriodTotals, month: string, pick: (a: LedgerAccount) => boolean): bigint {
  let sum = 0n;
  for (const [id, amount] of totals.get(month) ?? []) {
    const account = chart.get(id);
    if (account && pick(account)) sum += amount;
  }
  return sum;
}

/** TECH-SPEC 6.7: credits to income accounts. The Dashboard counts only budgetable income. */
export function monthIncome(chart: Chart, totals: PeriodTotals, month: string, budgetableOnly = false): bigint {
  return -sumKind(chart, totals, month, (a) => a.kind === 'income' && (!budgetableOnly || a.countInBudget !== false));
}

/** TECH-SPEC 6.7: debits to expense accounts minus refunds in the month. */
export function monthSpent(chart: Chart, totals: PeriodTotals, month: string): bigint {
  return sumKind(chart, totals, month, (a) => a.kind === 'expense');
}

/** Net spending in one expense account (the budget's "activity"). */
export function categoryActivity(totals: PeriodTotals, month: string, ledgerAccountId: string): bigint {
  return totals.get(month)?.get(ledgerAccountId) ?? 0n;
}

export type NetWorth = { total: bigint; partial: string[] };

/**
 * Assets minus what's owed, in naira. Balances in another currency need that day's
 * rate (TECH-SPEC 6.5); without one they're left out and named in `partial`.
 */
export function netWorth(
  chart: Chart,
  events: MoneyEvent[],
  onDate: string,
  rates: Record<string, { numerator: bigint; denominator: bigint }> = {},
): NetWorth {
  let total = 0n;
  const partial = new Set<string>();
  for (const account of chart.all()) {
    if (account.kind !== 'asset' && account.kind !== 'liability') continue;
    const balance = ledgerBalance(account.id, events, onDate);
    if (balance === 0n) continue;
    if (account.currency === 'NGN') {
      total += balance;
      continue;
    }
    const rate = rates[account.currency];
    if (!rate) {
      partial.add(account.currency);
      continue;
    }
    total += roundHalfEven(balance * rate.numerator, rate.denominator);
  }
  return { total, partial: [...partial] };
}

function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  const q = numerator / denominator;
  const r = numerator % denominator;
  const twice = 2n * (r < 0n ? -r : r);
  const d = denominator < 0n ? -denominator : denominator;
  if (twice < d || (twice === d && q % 2n === 0n)) return q;
  return numerator < 0n !== denominator < 0n ? q - 1n : q + 1n;
}

export type BarState = 'within' | 'near' | 'over';

/** TECH-SPEC 6.6: used = activity ÷ (assigned + carried). Near from 80%, over from 100%. */
export function barState(activity: bigint, plan: bigint): BarState {
  if (plan <= 0n) return activity > 0n ? 'over' : 'within';
  if (activity * 100n >= plan * 100n) return 'over';
  if (activity * 100n >= plan * 80n) return 'near';
  return 'within';
}

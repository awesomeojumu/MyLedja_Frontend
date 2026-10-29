import type { Snapshot } from '@/data/workspace/repository';
import { monthIncome, monthOf, periodTotals } from '@/ledger';

/**
 * DESIGN §9.4 / 9.5: budgetable income for a month.
 * Starts from category budgetable credits, then removes income linked to streams
 * with "Count in budget" off (regardless of category flag).
 */
export function budgetableIncomeReceived(snapshot: Snapshot, month: string): bigint {
  const totals = periodTotals(snapshot.events);
  let income = monthIncome(snapshot.chart, totals, month, true);
  for (const stream of snapshot.incomeStreams) {
    if (stream.countInBudget) continue;
    for (const e of snapshot.events) {
      if (e.status !== 'posted' || e.incomeStreamId !== stream.id || e.oneOff) continue;
      if ((e.type !== 'income' && e.type !== 'salary_gross') || monthOf(e.date) !== month) continue;
      for (const l of e.lines) {
        const acc = snapshot.chart.get(l.ledgerAccountId);
        if (acc?.kind === 'income' && l.amountMinor < 0n) income -= -l.amountMinor;
      }
    }
  }
  return income;
}

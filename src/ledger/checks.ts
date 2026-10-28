import type { Chart } from './builders';
import { fail, ok, type LedgerResult, type MoneyEvent } from './types';

/** Refunds already made against an event, counting only those not undone. */
export function refundedSoFar(original: MoneyEvent, events: Iterable<MoneyEvent>): bigint {
  let total = 0n;
  for (const e of events) {
    if (e.type !== 'refund' || e.refundOf !== original.id || e.status !== 'posted') continue;
    for (const l of e.lines) if (l.amountMinor > 0n) total += l.amountMinor;
  }
  return total;
}

/** What a purchase cost: its expense lines. */
export function purchaseCost(chart: Chart, original: MoneyEvent): bigint {
  return original.lines
    .filter((l) => chart.get(l.ledgerAccountId)?.kind === 'expense')
    .reduce((sum, l) => sum + l.amountMinor, 0n);
}

/**
 * TECH-SPEC 6.11 checks the app can run on its own copy. The server repeats them all;
 * check 6 (repeated operationId) lives in the Journal.
 */
export function checkEvent(
  chart: Chart,
  event: MoneyEvent,
  existing: ReadonlyMap<string, MoneyEvent>,
): LedgerResult<MoneyEvent> {
  if (event.lines.length < 2) return fail('missing_lines');

  const sums = new Map<string, bigint>();
  for (const l of event.lines) {
    const account = chart.get(l.ledgerAccountId);
    if (!account) return fail('unknown_account');
    if (account.currency !== l.currency) return fail('currency_mismatch');
    sums.set(l.currency, (sums.get(l.currency) ?? 0n) + l.amountMinor);
  }
  for (const sum of sums.values()) if (sum !== 0n) return fail('unbalanced');

  if (event.type === 'transfer') {
    const accounts = new Set(event.lines.map((l) => l.ledgerAccountId));
    if (event.lines.length !== 2 || accounts.size !== 2) return fail('transfer_accounts');
  }

  if (event.splitTotal !== undefined) {
    const parts = event.lines.filter((l) => chart.get(l.ledgerAccountId)?.kind === 'expense');
    const total = parts.reduce((s, l) => s + l.amountMinor, 0n);
    if (total !== event.splitTotal) return fail('split_mismatch');
  }

  if (event.type === 'refund') {
    const original = event.refundOf ? existing.get(event.refundOf) : undefined;
    if (!original || original.status !== 'posted') return fail('missing_lines');
    const amount = event.lines.reduce((s, l) => (l.amountMinor > 0n ? s + l.amountMinor : s), 0n);
    if (refundedSoFar(original, existing.values()) + amount > purchaseCost(chart, original)) {
      return fail('refund_too_large');
    }
  }

  if (event.type === 'reversal') {
    const original = event.reversalOf ? existing.get(event.reversalOf) : undefined;
    if (!original) return fail('missing_lines');
    if (original.status === 'reversed' || original.type === 'reversal') return fail('already_reversed');
  }

  return ok(event);
}

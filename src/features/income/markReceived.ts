import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import { isInvestmentIncomeEvent } from './helpers';

export type IncomeMatchCandidate = {
  eventId: string;
  date: string;
  amount: bigint;
  title: string;
  confidence: 'strong' | 'likely';
  /** Shown when amount differs from the remainder still expected. */
  amountNote?: string;
};

export type RoutingConfirmRow = {
  key: string;
  label: string;
  amount: bigint;
  goalId?: string;
  categoryId?: string;
  restToBudget?: boolean;
};

export type MarkReceivedPayload =
  | { kind: 'match'; eventId: string; amount: bigint; date: string; routing: { goalId: string; amount: bigint; apply: boolean }[] }
  | { kind: 'create'; amount: bigint; date: string; routing: { goalId: string; amount: bigint; apply: boolean }[] };

function eventTitle(snapshot: Snapshot, eventId: string): string {
  const e = snapshot.events.find((x) => x.id === eventId);
  if (!e) return '';
  const payee = e.payeeId ? snapshot.payees.find((p) => p.id === e.payeeId)?.name : undefined;
  if (payee) return payee;
  const catLine = e.lines.find((l) => snapshot.chart.get(l.ledgerAccountId)?.kind === 'income');
  const cat = catLine ? snapshot.chart.get(catLine.ledgerAccountId)?.name : undefined;
  return cat ?? t('income.title');
}

function amountOnAccount(event: { lines: { ledgerAccountId: string; amountMinor: bigint }[] }, accountId: string): bigint {
  let sum = 0n;
  for (const l of event.lines) {
    if (l.ledgerAccountId === accountId && l.amountMinor > 0n) sum += l.amountMinor;
  }
  return sum;
}

function confidenceFor(amount: bigint, target: bigint): 'strong' | 'likely' {
  if (target <= 0n) return 'likely';
  const diff = amount > target ? amount - target : target - amount;
  return diff * 100n <= target ? 'strong' : 'likely';
}

/** DESIGN #26: suggested income transactions to link (amount, date, account). */
export function incomeMatchCandidates(
  stream: IncomeStream,
  snapshot: Snapshot,
  month: string,
  remaining: bigint,
): IncomeMatchCandidate[] {
  const out: IncomeMatchCandidate[] = [];
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId || e.oneOff) continue;
    if (monthOf(e.date) !== month) continue;
    if (isInvestmentIncomeEvent(snapshot, e)) continue;
    const amount = amountOnAccount(e, stream.accountId);
    if (amount <= 0n) continue;
    const confidence = confidenceFor(amount, remaining > 0n ? remaining : BigInt(stream.expectedMinor));
    const amountNote =
      remaining > 0n && amount !== remaining ? t('income.matchAmountDiff', { got: formatNaira(amount), want: formatNaira(remaining) }) : undefined;
    out.push({
      eventId: e.id,
      date: e.date,
      amount,
      title: eventTitle(snapshot, e.id),
      confidence,
      amountNote,
    });
  }
  out.sort((a, b) => {
    const sa = a.confidence === 'strong' ? 0 : 1;
    const sb = b.confidence === 'strong' ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const da = a.amount > remaining ? a.amount - remaining : remaining - a.amount;
    const db = b.amount > remaining ? b.amount - remaining : remaining - b.amount;
    return Number(da - db);
  });
  return out.slice(0, 8);
}

/** Tick-ready routing rows for M12 confirm step. */
export function routingConfirmRows(stream: IncomeStream, snapshot: Snapshot, takeHomeAmount: bigint): RoutingConfirmRow[] {
  if (!stream.routing?.length) return [];
  const rows: RoutingConfirmRow[] = [];
  let fixed = 0n;
  for (const r of stream.routing) {
    if (r.restToBudget) continue;
    let amount = 0n;
    if (r.amountMinor) amount = BigInt(r.amountMinor);
    else if (r.percent) amount = (takeHomeAmount * BigInt(Math.round(r.percent * 100))) / 10_000n;
    fixed += amount;
    const goal = r.goalId ? snapshot.goals.find((g) => g.id === r.goalId)?.name : undefined;
    const cat = r.categoryId ? snapshot.categories.find((c) => c.id === r.categoryId)?.name : undefined;
    rows.push({
      key: `${r.goalId ?? ''}:${r.categoryId ?? ''}:${amount.toString()}`,
      label: goal ?? cat ?? stream.name,
      amount,
      goalId: r.goalId,
      categoryId: r.categoryId,
    });
  }
  const rest = stream.routing.some((r) => r.restToBudget);
  if (rest) {
    const left = takeHomeAmount > fixed ? takeHomeAmount - fixed : 0n;
    rows.push({ key: 'rest', label: t('income.routingRest'), amount: left, restToBudget: true });
  }
  return rows;
}

export function routingPayload(
  rows: RoutingConfirmRow[],
  toggles: Record<string, boolean>,
): { goalId: string; amount: bigint; apply: boolean }[] {
  return rows
    .filter((r) => r.goalId && r.amount > 0n)
    .map((r) => ({ goalId: r.goalId!, amount: r.amount, apply: toggles[r.key] ?? true }));
}

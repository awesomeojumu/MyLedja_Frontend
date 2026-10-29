import type { Recurring } from '@/data/workspace/model';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { rowsFor } from '@/features/transactions/helpers';
import { formatNaira } from '@/money';
import { t } from '@/i18n';

import { addDays, type BillRow } from './recurrence';

export type BillMatchCandidate = {
  eventId: string;
  date: string;
  amount: bigint;
  title: string;
  /** Shown when the transaction amount differs from the bill (DESIGN #26). */
  amountNote?: string;
};

function expenseTotal(event: TxEvent, snapshot: Snapshot): bigint {
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  return event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + (l.amountMinor < 0n ? -l.amountMinor : l.amountMinor), 0n);
}

function linkedEventIds(snapshot: Snapshot): Set<string> {
  return new Set(snapshot.occurrences.filter((o) => o.eventId).map((o) => o.eventId!));
}

/** DESIGN popup #26 — suggested transactions for a bill occurrence. */
export function billMatchCandidates(snapshot: Snapshot, row: BillRow, windowDays = 7): BillMatchCandidate[] {
  if (row.recurring.kind === 'income' || row.recurring.id.startsWith('stream:')) return [];
  const expected = BigInt(row.recurring.amountMinor);
  const from = addDays(row.dueDate, -windowDays);
  const to = addDays(row.dueDate, windowDays);
  const linked = linkedEventIds(snapshot);
  const payeeName = row.recurring.payeeId ? snapshot.payees.find((p) => p.id === row.recurring.payeeId)?.name : undefined;
  const out: BillMatchCandidate[] = [];

  for (const r of rowsFor(snapshot)) {
    // PU26-1: a transaction already linked to any occurrence can't pay another.
    if (r.event.type !== 'expense' || linked.has(r.event.id) || r.event.recurringId) continue;
    if (r.event.date < from || r.event.date > to) continue;
    const amount = expenseTotal(r.event, snapshot);
    if (amount <= 0n) continue;
    const title = r.title;
    const nameMatch = payeeName && title.toLowerCase().includes(payeeName.toLowerCase());
    const amountClose = amount >= expected * 8n / 10n && amount <= expected * 12n / 10n;
    if (!nameMatch && !amountClose) continue;
    const amountNote =
      amount !== expected
        ? t('plan.matchAmountDiff', { expected: formatNaira(expected), actual: formatNaira(amount) })
        : undefined;
    out.push({ eventId: r.event.id, date: r.event.date, amount, title, amountNote });
  }
  return out.sort((a, b) => {
    const da = a.amount - expected < 0n ? -(a.amount - expected) : a.amount - expected;
    const db = b.amount - expected < 0n ? -(b.amount - expected) : b.amount - expected;
    return Number(da - db);
  });
}

/** Count bill rows that have at least one match candidate (match banner). */
export function billMatchReviewCount(snapshot: Snapshot, rows: BillRow[]): number {
  let n = 0;
  for (const row of rows) {
    if (row.occurrence?.status === 'paid' || row.group === 'paid') continue;
    if (billMatchCandidates(snapshot, row).length > 0) n++;
  }
  return n;
}

export function recurringPayeeName(snapshot: Snapshot, recurring: Recurring): string | undefined {
  return recurring.payeeId ? snapshot.payees.find((p) => p.id === recurring.payeeId)?.name : undefined;
}

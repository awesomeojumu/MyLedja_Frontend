import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf } from '@/ledger';

export type StreamRow = {
  stream: IncomeStream;
  expected: bigint;
  received: bigint;
};

export function incomeForMonth(snapshot: Snapshot, month: string): { rows: StreamRow[]; expected: bigint; received: bigint } {
  const rows: StreamRow[] = snapshot.incomeStreams.map((stream) => {
    const expected = BigInt(stream.expectedMinor);
    let received = 0n;
    for (const e of snapshot.events) {
      if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id) continue;
      if (monthOf(e.date) !== month) continue;
      for (const l of e.lines) {
        const account = snapshot.chart.get(l.ledgerAccountId);
        if (account?.kind === 'asset' && l.amountMinor > 0n) received += l.amountMinor;
      }
    }
    return { stream, expected, received };
  });
  const expected = rows.reduce((s, r) => s + r.expected, 0n);
  const received = rows.reduce((s, r) => s + r.received, 0n);
  return { rows, expected, received };
}

export function unmatchedIncome(snapshot: Snapshot, month: string): bigint {
  let sum = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId) continue;
    if (monthOf(e.date) !== month) continue;
    for (const l of e.lines) {
      const account = snapshot.chart.get(l.ledgerAccountId);
      if (account?.kind === 'asset' && l.amountMinor > 0n) sum += l.amountMinor;
    }
  }
  return sum;
}

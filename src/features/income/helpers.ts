import type { IncomeStream } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf, prevMonth } from '@/ledger';

export type StreamRow = {
  stream: IncomeStream;
  expected: bigint;
  received: bigint;
};

export type PaymentDotStatus = 'onTime' | 'partial' | 'late' | 'missed' | 'none';

export function incomeForMonth(snapshot: Snapshot, month: string): { rows: StreamRow[]; expected: bigint; received: bigint; steadiness: number | null } {
  const rows: StreamRow[] = snapshot.incomeStreams.map((stream) => {
    const expected = BigInt(stream.expectedMinor);
    let received = 0n;
    for (const e of snapshot.events) {
      if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id || e.oneOff) continue;
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
  const steadiness = incomeSteadiness(rows);
  return { rows, expected, received, steadiness };
}

/** Share of regular streams that reached expected this month (P13-01). */
export function incomeSteadiness(rows: StreamRow[]): number | null {
  const regular = rows.filter((r) => r.stream.kind === 'regular' || r.stream.kind === 'variable');
  if (regular.length === 0) return null;
  const onTrack = regular.filter((r) => r.received >= r.expected).length;
  return Math.round((onTrack / regular.length) * 100);
}

export function streamPaymentDots(stream: IncomeStream, snapshot: Snapshot, endMonth: string): PaymentDotStatus[] {
  const dots: PaymentDotStatus[] = [];
  let month = endMonth;
  for (let i = 0; i < 6; i += 1) {
    dots.unshift(dotForMonth(stream, snapshot, month));
    month = prevMonth(month);
  }
  return dots;
}

function dotForMonth(stream: IncomeStream, snapshot: Snapshot, month: string): PaymentDotStatus {
  const expected = BigInt(stream.expectedMinor);
  let received = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id || e.oneOff) continue;
    if (monthOf(e.date) !== month) continue;
    for (const l of e.lines) {
      const account = snapshot.chart.get(l.ledgerAccountId);
      if (account?.kind === 'asset' && l.amountMinor > 0n) received += l.amountMinor;
    }
  }
  if (received === 0n) return month < monthOf(new Date().toISOString().slice(0, 10)) ? 'missed' : 'none';
  if (received >= expected) return 'onTime';
  if (received > 0n) return 'partial';
  return 'missed';
}

export function unmatchedIncome(snapshot: Snapshot, month: string): bigint {
  let sum = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId || e.oneOff) continue;
    if (monthOf(e.date) !== month) continue;
    for (const l of e.lines) {
      const account = snapshot.chart.get(l.ledgerAccountId);
      if (account?.kind === 'asset' && l.amountMinor > 0n) sum += l.amountMinor;
    }
  }
  return sum;
}

export function unmatchedEvents(snapshot: Snapshot, month: string) {
  return snapshot.events.filter(
    (e) => e.status === 'posted' && e.type === 'income' && !e.incomeStreamId && !e.oneOff && monthOf(e.date) === month,
  );
}

export function taxTotalsForYear(snapshot: Snapshot, year: string): { label: string; gross: bigint }[] {
  const map = new Map<string, bigint>();
  for (const stream of snapshot.incomeStreams) {
    const label = stream.taxClass ?? stream.name;
    let sum = 0n;
    for (const e of snapshot.events) {
      if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id || e.oneOff) continue;
      if (!e.date.startsWith(`${year}-`)) continue;
      for (const l of e.lines) {
        const cat = snapshot.chart.get(l.ledgerAccountId);
        if (cat?.kind === 'income' && l.amountMinor < 0n) sum += -l.amountMinor;
      }
    }
    if (sum > 0n) map.set(label, (map.get(label) ?? 0n) + sum);
  }
  return [...map.entries()].map(([label, gross]) => ({ label, gross }));
}

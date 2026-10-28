import type { IncomeStream, IncomeStreamKind, RecurrenceRule } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf, prevMonth } from '@/ledger';

export type StreamRow = {
  stream: IncomeStream;
  expected: bigint;
  received: bigint;
};

export type PaymentDotStatus = 'onTime' | 'partial' | 'late' | 'missed' | 'none';

export const INCOME_KIND_ORDER: IncomeStreamKind[] = ['regular', 'variable', 'irregular', 'passive'];

export const TAX_CLASS_PRESETS = ['PAYE', 'Self-employed', 'Rental', 'Investment', 'Other'] as const;

export type InvestmentIncomeRow = {
  id: string;
  label: string;
  date: string;
  amount: bigint;
  detail?: string;
};

export type TwelveMonthPoint = {
  month: string;
  label: string;
  expected: bigint;
  received: bigint;
  byStream: { streamId: string; name: string; amount: bigint }[];
};

function receivedForStreamInMonth(stream: IncomeStream, snapshot: Snapshot, month: string): bigint {
  let received = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id || e.oneOff) continue;
    if (monthOf(e.date) !== month) continue;
    for (const l of e.lines) {
      const account = snapshot.chart.get(l.ledgerAccountId);
      if (account?.kind === 'asset' && l.amountMinor > 0n) received += l.amountMinor;
    }
  }
  return received;
}

export function incomeForMonth(snapshot: Snapshot, month: string): { rows: StreamRow[]; expected: bigint; received: bigint; steadiness: number | null } {
  const rows: StreamRow[] = snapshot.incomeStreams.map((stream) => {
    const expected = BigInt(stream.expectedMinor);
    const received = receivedForStreamInMonth(stream, snapshot, month);
    return { stream, expected, received };
  });
  const expected = rows.reduce((s, r) => s + r.expected, 0n);
  const received = rows.reduce((s, r) => s + r.received, 0n);
  const steadiness = incomeSteadiness(rows);
  return { rows, expected, received, steadiness };
}

export function groupStreamRows(rows: StreamRow[]): { kind: IncomeStreamKind; rows: StreamRow[] }[] {
  return INCOME_KIND_ORDER.map((kind) => ({ kind, rows: rows.filter((r) => r.stream.kind === kind) })).filter((g) => g.rows.length > 0);
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
  const received = receivedForStreamInMonth(stream, snapshot, month);
  if (received === 0n) return month < monthOf(new Date().toISOString().slice(0, 10)) ? 'missed' : 'none';
  if (received >= expected) return 'onTime';
  if (received > 0n) return 'partial';
  return 'missed';
}

export function formatStreamSchedule(rule: RecurrenceRule): string {
  if (rule.every === 'week') return t('income.scheduleWeekly', { day: rule.on });
  if (rule.on === 31) return t('income.scheduleLastDay');
  return t('income.scheduleMonthly', { day: rule.on });
}

export function takeHomeMinor(stream: IncomeStream): bigint {
  if (stream.recordMode !== 'gross' || !stream.grossMinor) return BigInt(stream.expectedMinor);
  let gross = BigInt(stream.grossMinor);
  for (const d of stream.deductions ?? []) {
    if (d.amountMinor) gross -= BigInt(d.amountMinor);
    else if (d.percent) gross -= (BigInt(stream.grossMinor) * BigInt(Math.round(d.percent * 100))) / 10_000n;
  }
  return gross > 0n ? gross : 0n;
}

export function routingSummary(stream: IncomeStream, snapshot: Snapshot): string | null {
  const parts: string[] = [];
  for (const row of stream.routing ?? []) {
    if (row.restToBudget) {
      parts.push(t('income.routingRest'));
      continue;
    }
    const goal = row.goalId ? snapshot.goals.find((g) => g.id === row.goalId)?.name : undefined;
    const cat = row.categoryId ? snapshot.categories.find((c) => c.id === row.categoryId)?.name : undefined;
    const target = goal ?? cat;
    if (!target) continue;
    if (row.amountMinor) parts.push(`${target} ${formatNaira(BigInt(row.amountMinor))}`);
    else if (row.percent) parts.push(`${target} ${row.percent}%`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function unmatchedIncome(snapshot: Snapshot, month: string): bigint {
  let sum = 0n;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId || e.oneOff) continue;
    if (monthOf(e.date) !== month) continue;
    if (isInvestmentIncomeEvent(snapshot, e)) continue;
    for (const l of e.lines) {
      const account = snapshot.chart.get(l.ledgerAccountId);
      if (account?.kind === 'asset' && l.amountMinor > 0n) sum += l.amountMinor;
    }
  }
  return sum;
}

export function unmatchedEvents(snapshot: Snapshot, month: string) {
  return snapshot.events.filter(
    (e) =>
      e.status === 'posted' &&
      e.type === 'income' &&
      !e.incomeStreamId &&
      !e.oneOff &&
      monthOf(e.date) === month &&
      !isInvestmentIncomeEvent(snapshot, e),
  );
}

function isInvestmentIncomeEvent(snapshot: Snapshot, e: { lines: { ledgerAccountId: string; amountMinor: bigint }[] }): boolean {
  const interest = snapshot.chart.system('interest_earned')?.id;
  const gain = snapshot.chart.system('investment_gain_loss')?.id;
  for (const l of e.lines) {
    if (l.ledgerAccountId === interest || l.ledgerAccountId === gain) return true;
  }
  return false;
}

export function investmentIncomeForMonth(snapshot: Snapshot, month: string): InvestmentIncomeRow[] {
  const rows: InvestmentIncomeRow[] = [];
  const interest = snapshot.chart.system('interest_earned')?.id;
  const gain = snapshot.chart.system('investment_gain_loss')?.id;
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'income' || monthOf(e.date) !== month) continue;
    let amount = 0n;
    let kind: 'interest' | 'gain' | null = null;
    for (const l of e.lines) {
      if (l.ledgerAccountId === interest && l.amountMinor < 0n) {
        amount += -l.amountMinor;
        kind = 'interest';
      }
      if (l.ledgerAccountId === gain && l.amountMinor < 0n) {
        amount += -l.amountMinor;
        kind = 'gain';
      }
    }
    if (amount <= 0n || !kind) continue;
    const payee = e.payeeId ? snapshot.payees.find((p) => p.id === e.payeeId)?.name : undefined;
    rows.push({
      id: e.id,
      label: payee ?? (kind === 'interest' ? t('income.investmentInterest') : t('income.investmentGain')),
      date: e.date,
      amount,
      detail: e.notes,
    });
  }
  for (const stream of snapshot.incomeStreams.filter((s) => s.kind === 'passive')) {
    const received = receivedForStreamInMonth(stream, snapshot, month);
    if (received <= 0n) continue;
    rows.push({
      id: `stream:${stream.id}`,
      label: stream.name,
      date: month,
      amount: received,
      detail: stream.countInBudget ? undefined : t('income.offBudget'),
    });
  }
  return rows;
}

export function taxTotalsForYear(snapshot: Snapshot, year: string): { label: string; gross: bigint }[] {
  const map = new Map<string, bigint>();
  for (const preset of TAX_CLASS_PRESETS) map.set(preset, 0n);
  for (const stream of snapshot.incomeStreams) {
    const label = stream.taxClass && TAX_CLASS_PRESETS.includes(stream.taxClass as (typeof TAX_CLASS_PRESETS)[number]) ? stream.taxClass : stream.taxClass ?? 'Other';
    if (!map.has(label)) map.set(label, 0n);
    let sum = 0n;
    for (const e of snapshot.events) {
      if (e.status !== 'posted' || e.type !== 'income' || e.incomeStreamId !== stream.id || e.oneOff) continue;
      if (!e.date.startsWith(`${year}-`)) continue;
      if (stream.recordMode === 'gross' && stream.grossMinor) {
        sum += BigInt(stream.grossMinor);
        continue;
      }
      for (const l of e.lines) {
        const cat = snapshot.chart.get(l.ledgerAccountId);
        if (cat?.kind === 'income' && l.amountMinor < 0n) sum += -l.amountMinor;
      }
    }
    if (sum > 0n) map.set(label, (map.get(label) ?? 0n) + sum);
  }
  return [...map.entries()].filter(([, gross]) => gross > 0n).map(([label, gross]) => ({ label, gross }));
}

export function twelveMonthIncomeSeries(snapshot: Snapshot, endMonth: string): TwelveMonthPoint[] {
  const points: TwelveMonthPoint[] = [];
  let month = endMonth;
  for (let i = 0; i < 12; i += 1) {
    const summary = incomeForMonth(snapshot, month);
    const byStream = summary.rows.map(({ stream, received }) => ({
      streamId: stream.id,
      name: stream.name,
      amount: received,
    }));
    const [y, m] = month.split('-').map(Number) as [number, number];
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en', { month: 'short' });
    points.unshift({
      month,
      label,
      expected: summary.expected,
      received: summary.received,
      byStream,
    });
    month = prevMonth(month);
  }
  return points;
}

export function eventIncomeAmount(snapshot: Snapshot, eventId: string): bigint {
  const e = snapshot.events.find((x) => x.id === eventId);
  if (!e) return 0n;
  let sum = 0n;
  for (const l of e.lines) {
    const account = snapshot.chart.get(l.ledgerAccountId);
    if (account?.kind === 'asset' && l.amountMinor > 0n) sum += l.amountMinor;
  }
  return sum;
}

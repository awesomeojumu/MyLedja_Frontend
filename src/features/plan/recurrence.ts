import type { RecurrenceRule, Recurring, RecurringOccurrence } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { monthOf, nextMonth } from '@/ledger';

/** Last calendar day of a month (handles 31st → last day). */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dueDateInMonth(rule: RecurrenceRule, month: string): string | null {
  const [y, m] = month.split('-').map(Number) as [number, number];
  if (rule.every === 'week') {
    return null;
  }
  const day = rule.on === 31 ? lastDayOfMonth(y, m - 1) : Math.min(rule.on, lastDayOfMonth(y, m - 1));
  return `${month}-${String(day).padStart(2, '0')}`;
}

export type BillRow = {
  recurring: Recurring;
  dueDate: string;
  occurrence?: RecurringOccurrence;
  group: 'overdue' | 'dueSoon' | 'later' | 'paid';
};

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function billsForMonth(snapshot: Snapshot, month: string, today: string, dueSoonDays = 7): BillRow[] {
  const dueSoonEnd = addDays(today, dueSoonDays);
  const rows: BillRow[] = [];
  for (const recurring of snapshot.recurring) {
    if (recurring.kind === 'income') continue;
    const dueDate = dueDateInMonth(recurring.rule, month);
    if (!dueDate || dueDate < recurring.startDate) continue;
    if (recurring.endDate && dueDate > recurring.endDate) continue;
    const occId = `${recurring.id}:${dueDate}`;
    const occurrence = snapshot.occurrences.find((o) => o.id === occId);
    let group: BillRow['group'] = 'later';
    if (occurrence?.status === 'paid') group = 'paid';
    else if (dueDate < today) group = 'overdue';
    else if (dueDate <= dueSoonEnd) group = 'dueSoon';
    rows.push({ recurring, dueDate, occurrence, group });
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Expected income due this month (DESIGN page 12 list). */
export function incomeDueRows(snapshot: Snapshot, month: string, today: string, dueSoonDays = 7): BillRow[] {
  const dueSoonEnd = addDays(today, dueSoonDays);
  const rows: BillRow[] = [];
  for (const stream of snapshot.incomeStreams) {
    const dueDate = dueDateInMonth(stream.rule, month);
    if (!dueDate) continue;
    const pseudo: Recurring = {
      id: `stream:${stream.id}`,
      kind: 'income',
      name: stream.name,
      amountMinor: stream.expectedMinor,
      accountId: stream.accountId,
      categoryId: stream.categoryId,
      rule: stream.rule,
      startDate: dueDate,
    };
    let group: BillRow['group'] = 'later';
    const occId = `${pseudo.id}:${dueDate}`;
    const occurrence = snapshot.occurrences.find((o) => o.id === occId);
    if (occurrence?.status === 'paid') group = 'paid';
    else if (dueDate < today) group = 'overdue';
    else if (dueDate <= dueSoonEnd) group = 'dueSoon';
    rows.push({ recurring: pseudo, dueDate, occurrence, group });
  }
  return rows;
}

export function planRowsForMonth(snapshot: Snapshot, month: string, today: string, dueSoonDays = 7): BillRow[] {
  return [...billsForMonth(snapshot, month, today, dueSoonDays), ...incomeDueRows(snapshot, month, today, dueSoonDays)].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}

/** DESIGN.md page 12 summary strip. */
export function planSummaryStrip(snapshot: Snapshot, month: string, billRows: BillRow[]) {
  let comingIn = 0n;
  for (const stream of snapshot.incomeStreams) {
    const due = dueDateInMonth(stream.rule, month);
    if (due) comingIn += BigInt(stream.expectedMinor);
  }
  const unpaid = billRows.filter((r) => r.group !== 'paid' && r.recurring.kind !== 'income');
  const goingOut = unpaid.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n);
  const missed = billRows.filter((r) => r.group === 'overdue' && r.recurring.kind !== 'income').length;
  const leftAfter = comingIn >= goingOut ? comingIn - goingOut : 0n;
  return { comingIn, goingOut, leftAfter, missed };
}

export function planSummary(rows: BillRow[]) {
  const out = rows.filter((r) => r.group !== 'paid');
  const overdue = rows.filter((r) => r.group === 'overdue').length;
  const outTotal = out.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n);
  return { outTotal, overdue, billCount: out.length };
}

/** All ISO dates in a month for the calendar grid (DESIGN page 12). */
export function calendarDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const count = lastDayOfMonth(y, m - 1);
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function rowsByDate(rows: BillRow[]): Map<string, BillRow[]> {
  const map = new Map<string, BillRow[]>();
  for (const row of rows) {
    const list = map.get(row.dueDate) ?? [];
    list.push(row);
    map.set(row.dueDate, list);
  }
  return map;
}

export type FindRecurringSuggestion = {
  id: string;
  name: string;
  averageMinor: bigint;
  count: number;
  confidence: 'strong' | 'likely';
};

/** DESIGN popup #27 — heuristic from expense history. */
export function findRecurringSuggestions(snapshot: Snapshot, month: string): FindRecurringSuggestion[] {
  const keyCounts = new Map<string, { name: string; amounts: bigint[]; payeeId?: string }>();
  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'expense' || !e.date.startsWith(month)) continue;
    const payee = e.payeeId ? snapshot.payees.find((p) => p.id === e.payeeId)?.name : e.notes;
    const name = payee ?? 'Repeating expense';
    const amount = e.lines.reduce((s, l) => (l.amountMinor < 0n ? s - l.amountMinor : s), 0n);
    if (amount <= 0n) continue;
    const key = `${name}:${amount}`;
    const cur = keyCounts.get(key) ?? { name, amounts: [] };
    cur.amounts.push(amount);
    keyCounts.set(key, cur);
  }
  const out: FindRecurringSuggestion[] = [];
  for (const [key, data] of keyCounts) {
    if (data.amounts.length < 2) continue;
    const avg = data.amounts.reduce((a, b) => a + b, 0n) / BigInt(data.amounts.length);
    out.push({
      id: key,
      name: data.name,
      averageMinor: avg,
      count: data.amounts.length,
      confidence: data.amounts.length >= 3 ? 'strong' : 'likely',
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

export type ScheduleRow = {
  recurring: Recurring;
  nextDate: string | null;
  status: 'missed' | 'due' | 'upcoming' | 'scheduled';
};

function ruleLabel(rule: RecurrenceRule): string {
  if (rule.every === 'week') return t('plan.freqWeekly', { day: String(rule.on) });
  if (rule.on === 31) return t('plan.freqMonthlyLast');
  return t('plan.freqMonthly', { day: String(rule.on) });
}

function nextDueOnOrAfter(recurring: Recurring, from: string, horizonMonths = 14): string | null {
  let month = monthOf(from);
  for (let i = 0; i < horizonMonths; i++) {
    const due = dueDateInMonth(recurring.rule, month);
    if (due && due >= recurring.startDate && due >= from && (!recurring.endDate || due <= recurring.endDate)) {
      return due;
    }
    month = nextMonth(month);
  }
  return null;
}

/** DESIGN page 12 tab "All schedules". */
export function allScheduleRows(snapshot: Snapshot, today: string, search = ''): ScheduleRow[] {
  const q = search.trim().toLowerCase();
  const rows: ScheduleRow[] = [];
  for (const recurring of snapshot.recurring) {
    if (q && !recurring.name.toLowerCase().includes(q)) continue;
    const nextDate = nextDueOnOrAfter(recurring, today);
    let status: ScheduleRow['status'] = 'scheduled';
    if (nextDate) {
      const occ = snapshot.occurrences.find((o) => o.id === `${recurring.id}:${nextDate}`);
      if (occ?.status === 'missed' || (nextDate < today && occ?.status !== 'paid')) status = 'missed';
      else if (nextDate === today) status = 'due';
      else if (nextDate <= addDays(today, 7)) status = 'upcoming';
    }
    rows.push({ recurring, nextDate, status });
  }
  const order: Record<ScheduleRow['status'], number> = { missed: 0, due: 1, upcoming: 2, scheduled: 3 };
  return rows.sort((a, b) => {
    const sa = order[a.status] - order[b.status];
    if (sa !== 0) return sa;
    return (a.nextDate ?? '').localeCompare(b.nextDate ?? '');
  });
}

export function scheduleFrequency(recurring: Recurring): string {
  return ruleLabel(recurring.rule);
}

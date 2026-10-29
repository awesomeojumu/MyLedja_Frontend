import type { RecurrenceRule, Recurring, RecurringOccurrence } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { monthOf, nextMonth, prevMonth } from '@/ledger';

/** Last calendar day of a month (handles 31st → last day). */
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dueDateInMonth(rule: RecurrenceRule, month: string): string | null {
  const dates = dueDatesInMonth(rule, month, '1970-01-01');
  return dates[0] ?? null;
}

function weekdayUtc(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** All due ISO dates for a rule within a calendar month (DESIGN #25 cadences). */
export function dueDatesInMonth(rule: RecurrenceRule, month: string, startDate: string, endDate?: string): string[] {
  const interval = rule.interval ?? 1;
  const inRange = (d: string) => d >= startDate && (!endDate || d <= endDate);

  if (rule.every === 'month') {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const day = rule.on === 31 ? lastDayOfMonth(y, m - 1) : Math.min(rule.on, lastDayOfMonth(y, m - 1));
    const d = `${month}-${String(day).padStart(2, '0')}`;
    return inRange(d) ? [d] : [];
  }

  if (rule.every === 'year') {
    const [, viewM] = month.split('-').map(Number) as [number, number];
    const targetMonth = rule.monthOfYear ?? viewM;
    if (viewM !== targetMonth) return [];
    const d = dueDatesInMonth({ every: 'month', on: rule.on }, month, startDate, endDate)[0];
    return d ? [d] : [];
  }

  const days = calendarDays(month);
  const monthStart = days[0]!;

  if (rule.every === 'day') {
    const out: string[] = [];
    const monthEnd = days[days.length - 1]!;
    let cursor = startDate;
    while (cursor < monthStart) cursor = addDays(cursor, interval);
    while (cursor <= monthEnd) {
      if (cursor.startsWith(month) && inRange(cursor)) out.push(cursor);
      cursor = addDays(cursor, interval);
    }
    return out;
  }

  if (rule.every === 'week') {
    const out: string[] = [];
    for (const d of days) {
      if (weekdayUtc(d) !== rule.on) continue;
      if (!inRange(d)) continue;
      const weeks = Math.floor(daysBetween(startDate, d) / 7);
      if (weeks >= 0 && weeks % interval === 0) out.push(d);
    }
    return out;
  }

  return [];
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

/** First N occurrence dates for a schedule (PU25-2 "After N times"). */
export function occurrenceDates(rule: RecurrenceRule, startDate: string, count: number, endDate?: string): string[] {
  const out: string[] = [];
  let month = monthOf(startDate);
  for (let i = 0; i < 360 && out.length < count; i++) {
    for (const d of dueDatesInMonth(rule, month, startDate, endDate)) {
      out.push(d);
      if (out.length >= count) return out;
    }
    month = nextMonth(month);
  }
  return out;
}

/** Whether a due date is still within endAfterCount (PU25-2). */
export function withinEndAfterCount(recurring: Recurring, dueDate: string): boolean {
  if (!recurring.endAfterCount) return true;
  const dates = occurrenceDates(recurring.rule, recurring.startDate, recurring.endAfterCount, recurring.endDate);
  return dates.includes(dueDate);
}

export function billsForMonth(snapshot: Snapshot, month: string, today: string, dueSoonDays = 7): BillRow[] {
  const dueSoonEnd = addDays(today, dueSoonDays);
  const rows: BillRow[] = [];
  for (const recurring of snapshot.recurring) {
    if (recurring.cancelled || recurring.kind === 'income') continue;
    for (const dueDate of dueDatesInMonth(recurring.rule, month, recurring.startDate, recurring.endDate)) {
      if (!withinEndAfterCount(recurring, dueDate)) continue;
      const occId = `${recurring.id}:${dueDate}`;
      const occurrence = snapshot.occurrences.find((o) => o.id === occId);
      let group: BillRow['group'] = 'later';
      if (occurrence?.status === 'paid') group = 'paid';
      else if (dueDate < today) group = 'overdue';
      else if (dueDate <= dueSoonEnd) group = 'dueSoon';
      rows.push({ recurring, dueDate, occurrence, group });
    }
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
  payeeId?: string;
  averageMinor: bigint;
  count: number;
  confidence: 'strong' | 'likely';
  /** e.g. "Monthly, around the 27th" */
  howOften: string;
  lastDate: string;
  dayOfMonth: number;
};

function alreadyScheduled(snapshot: Snapshot, name: string, payeeId?: string): boolean {
  return snapshot.recurring.some(
    (r) =>
      !r.cancelled &&
      (r.kind === 'bill' || r.kind === 'subscription') &&
      ((payeeId && r.payeeId === payeeId) || r.name.trim().toLowerCase() === name.trim().toLowerCase()),
  );
}

function medianDay(dates: string[]): number {
  const days = dates.map((d) => Number(d.slice(8, 10))).sort((a, b) => a - b);
  return days[Math.floor(days.length / 2)] ?? 1;
}

function monthsCovered(dates: string[]): number {
  return new Set(dates.map((d) => d.slice(0, 7))).size;
}

/** DESIGN popup #27 — repeats in the last 12 months; already-scheduled excluded. */
export function findRecurringSuggestions(snapshot: Snapshot, asOfMonth: string): FindRecurringSuggestion[] {
  let startMonth = asOfMonth;
  for (let i = 0; i < 11; i++) startMonth = prevMonth(startMonth);
  const windowStart = `${startMonth}-01`;
  const windowEnd = `${asOfMonth}-31`;

  type Bucket = { name: string; payeeId?: string; dates: string[]; amounts: bigint[] };
  const buckets = new Map<string, Bucket>();
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));

  for (const e of snapshot.events) {
    if (e.status !== 'posted' || e.type !== 'expense') continue;
    if (e.date < windowStart || e.date > windowEnd) continue;
    if (e.recurringId) continue;
    const payee = e.payeeId ? snapshot.payees.find((p) => p.id === e.payeeId) : undefined;
    const name = (payee?.name ?? e.notes ?? '').trim();
    if (!name) continue;
    const amount = e.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => (l.amountMinor < 0n ? s - l.amountMinor : s), 0n);
    if (amount <= 0n) continue;
    const key = payee?.id ? `payee:${payee.id}` : `name:${name.toLowerCase()}`;
    const cur = buckets.get(key) ?? { name, payeeId: payee?.id, dates: [], amounts: [] };
    cur.dates.push(e.date);
    cur.amounts.push(amount);
    buckets.set(key, cur);
  }

  const out: FindRecurringSuggestion[] = [];
  for (const [key, data] of buckets) {
    if (alreadyScheduled(snapshot, data.name, data.payeeId)) continue;
    const months = monthsCovered(data.dates);
    if (months < 2 || data.amounts.length < 2) continue;
    const avg = data.amounts.reduce((a, b) => a + b, 0n) / BigInt(data.amounts.length);
    const day = medianDay(data.dates);
    const lastDate = [...data.dates].sort().at(-1)!;
    const confidence: 'strong' | 'likely' = months >= 3 ? 'strong' : 'likely';
    out.push({
      id: key,
      name: data.name,
      payeeId: data.payeeId,
      averageMinor: avg,
      count: data.amounts.length,
      confidence,
      howOften: t('plan.findHowOftenMonthly', { day: String(day) }),
      lastDate,
      dayOfMonth: day,
    });
  }
  return out.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'strong' ? -1 : 1;
    return b.count - a.count;
  });
}

export type ScheduleRow = {
  recurring: Recurring;
  nextDate: string | null;
  status: 'missed' | 'due' | 'upcoming' | 'scheduled' | 'paused' | 'cancelled';
};

function ruleLabel(rule: RecurrenceRule): string {
  const n = rule.interval ?? 1;
  if (rule.every === 'day') return t('plan.freqEveryDays', { days: String(n) });
  if (rule.every === 'week') return t('plan.freqEveryWeeks', { weeks: String(n), day: String(rule.on) });
  if (rule.every === 'year') {
    return t('plan.freqYearly', { month: String(rule.monthOfYear ?? 1), day: String(rule.on) });
  }
  if (rule.on === 31) return n === 1 ? t('plan.freqMonthlyLast') : t('plan.freqEveryMonthsLast', { months: String(n) });
  return n === 1 ? t('plan.freqMonthly', { day: String(rule.on) }) : t('plan.freqEveryMonths', { months: String(n), day: String(rule.on) });
}

function nextDueOnOrAfter(recurring: Recurring, from: string, horizonMonths = 14): string | null {
  let month = monthOf(from);
  for (let i = 0; i < horizonMonths; i++) {
    const dates = dueDatesInMonth(recurring.rule, month, recurring.startDate, recurring.endDate).filter((d) => d >= from);
    if (dates[0]) return dates[0];
    month = nextMonth(month);
  }
  return null;
}

/** DESIGN page 12 tab "All schedules" (TB-04). */
export function allScheduleRows(snapshot: Snapshot, today: string, search = '', includeCancelled = false): ScheduleRow[] {
  const q = search.trim().toLowerCase();
  const rows: ScheduleRow[] = [];
  for (const recurring of snapshot.recurring) {
    if (recurring.cancelled && !includeCancelled) continue;
    const payee = recurring.payeeId ? snapshot.payees.find((p) => p.id === recurring.payeeId)?.name : '';
    const account = snapshot.accounts.find((a) => a.id === recurring.accountId)?.name ?? '';
    if (q) {
      const hay = `${recurring.name} ${payee} ${account}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    if (recurring.cancelled) {
      rows.push({ recurring, nextDate: null, status: 'cancelled' });
      continue;
    }
    if (recurring.paused) {
      rows.push({ recurring, nextDate: nextDueOnOrAfter(recurring, today), status: 'paused' });
      continue;
    }
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
  const order: Record<ScheduleRow['status'], number> = { missed: 0, due: 1, upcoming: 2, scheduled: 3, paused: 4, cancelled: 5 };
  return rows.sort((a, b) => {
    const sa = order[a.status] - order[b.status];
    if (sa !== 0) return sa;
    return (a.nextDate ?? '').localeCompare(b.nextDate ?? '');
  });
}

/** True when a schedule should fire reminders (not paused / cancelled). */
export function scheduleCreatesReminders(recurring: Recurring): boolean {
  return !recurring.cancelled && !recurring.paused && recurring.reminderDays !== undefined;
}

/** Full weekday title for PU-59 day list ("Monday, 2 November 2026"). */
export function dayListTitle(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function scheduleFrequency(recurring: Recurring): string {
  return ruleLabel(recurring.rule);
}

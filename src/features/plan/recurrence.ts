import type { RecurrenceRule, Recurring, RecurringOccurrence } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

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

/** DESIGN.md page 12 summary strip. */
export function planSummaryStrip(snapshot: Snapshot, month: string, billRows: BillRow[]) {
  let comingIn = 0n;
  for (const stream of snapshot.incomeStreams) {
    const due = dueDateInMonth(stream.rule, month);
    if (due) comingIn += BigInt(stream.expectedMinor);
  }
  const unpaid = billRows.filter((r) => r.group !== 'paid');
  const goingOut = unpaid.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n);
  const missed = billRows.filter((r) => r.group === 'overdue').length;
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

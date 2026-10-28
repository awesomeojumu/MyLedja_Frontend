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

export function billsForMonth(snapshot: Snapshot, month: string, today: string): BillRow[] {
  const dueSoonEnd = addDays(today, 7);
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

export function planSummary(rows: BillRow[]) {
  const out = rows.filter((r) => r.group !== 'paid');
  const overdue = rows.filter((r) => r.group === 'overdue').length;
  const outTotal = out.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n);
  return { outTotal, overdue, billCount: out.length };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

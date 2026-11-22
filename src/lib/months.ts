/** Month labels used by the Dashboard and Budget headers ("November 2026") and their codes ("2026-11"). */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-11" → "November 2026". */
export function monthLabel(code: string): string {
  const [y, m] = code.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return code;
  return `${MONTHS[m - 1]} ${y}`;
}

/** "November 2026" → "2026-11"; anything unreadable is this month. */
export function monthCodeOf(label: string): string {
  const [name = '', year = ''] = label.trim().split(/\s+/);
  const index = MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase());
  if (index < 0 || !/^\d{4}$/.test(year)) return thisMonthCode();
  return `${year}-${String(index + 1).padStart(2, '0')}`;
}

export function thisMonthCode(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function thisMonthLabel(now = new Date()): string {
  return monthLabel(thisMonthCode(now));
}

/** The label `by` months away from `label`. */
export function shiftMonth(label: string, by: number): string {
  const [y, m] = monthCodeOf(label).split('-').map(Number);
  const d = new Date(y!, m! - 1 + by, 1);
  return thisMonthLabel(d);
}

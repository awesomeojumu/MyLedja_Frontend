import type { MoneyEvent } from '../../ledger/types';

export type HistoryRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

export type HistoryPoint = { date: string; amountMinor: bigint };

export type History = {
  points: HistoryPoint[];
  deltaMinor: bigint;
  percent: string;
  isPositive: boolean;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0));
const dayLabel = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')} ${MONTH_SHORT[d.getUTCMonth()]}`;

/** The dates a range is drawn at, oldest first, ending today. */
export function rangeDates(range: HistoryRange, today: Date, firstDate?: string): { date: string; label: string }[] {
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const out: { date: string; label: string }[] = [];
  if (range === '1W' || range === '1M') {
    const days = range === '1W' ? 6 : 28;
    const step = range === '1W' ? 1 : 4;
    for (let back = days; back >= 0; back -= step) {
      const d = addDays(t, -back);
      out.push({ date: iso(d), label: dayLabel(d) });
    }
    return out;
  }
  if (range === '3M' || range === 'YTD') {
    const startMonth = range === '3M' ? t.getUTCMonth() - 3 : -1;
    for (let m = startMonth; m < t.getUTCMonth(); m++) {
      const d = monthEnd(t.getUTCFullYear(), m);
      out.push({ date: iso(d), label: MONTH_SHORT[d.getUTCMonth()]! });
    }
    out.push({ date: iso(t), label: MONTH_SHORT[t.getUTCMonth()]! });
    return out;
  }
  // ALL: year ends from the first record, then today.
  const firstYear = firstDate ? Number(firstDate.slice(0, 4)) : t.getUTCFullYear();
  for (let y = firstYear - 1; y < t.getUTCFullYear(); y++) {
    out.push({ date: `${y}-12-31`, label: String(y) });
  }
  out.push({ date: iso(t), label: String(t.getUTCFullYear()) });
  return out;
}

/**
 * Balance history for a set of accounts, from the posted events. Liabilities are negative in the ledger, so a
 * mix of accounts gives net worth.
 */
export function balanceHistory(
  accountIds: readonly string[],
  events: readonly MoneyEvent[],
  range: HistoryRange,
  today = new Date(),
): History {
  const ids = new Set(accountIds);
  const relevant = events
    .filter((e) => e.status !== 'pending' && e.lines.some((l) => ids.has(l.ledgerAccountId)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const dates = rangeDates(range, today, relevant[0]?.date);
  let i = 0;
  let running = 0n;
  const points: HistoryPoint[] = dates.map(({ date, label }) => {
    while (i < relevant.length && relevant[i]!.date <= date) {
      for (const l of relevant[i]!.lines) if (ids.has(l.ledgerAccountId)) running += l.amountMinor;
      i++;
    }
    return { date: label, amountMinor: running };
  });
  const first = points[0]?.amountMinor ?? 0n;
  const last = points[points.length - 1]?.amountMinor ?? 0n;
  const delta = last - first;
  const base = first < 0n ? -first : first;
  const percent =
    base === 0n ? (delta === 0n ? '0.0%' : '') : `${delta >= 0n ? '+' : ''}${((Number(delta) / Number(base)) * 100).toFixed(1)}%`;
  return { points, deltaMinor: delta, percent, isPositive: delta >= 0n };
}

import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import type { LedgerItem } from "@/lib/ui/ledger-list";

export type FeedFilter = "all" | "expense" | "income" | "transfer" | "uncategorised";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A month as a number you can step: year * 12 + month (0-based). */
export function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

export function monthLabel(index: number): string {
  return `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;
}

function at(row: ApiTransaction): Date | null {
  if (!row.occurredAt) return null;
  const d = new Date(row.occurredAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

function counts(row: ApiTransaction): boolean {
  return !row.status || row.status === "posted";
}

/** Expenses and income need a category; transfers move money between your own accounts and don't. */
export function needsCategory(row: ApiTransaction): boolean {
  const kind = rowKind(row.type);
  return kind !== "transfer" && !row.categoryId;
}

export function inMonth(rows: ApiTransaction[], month: number): ApiTransaction[] {
  return rows.filter((row) => {
    const d = at(row);
    return d != null && monthIndex(d) === month;
  });
}

export interface MonthSummary {
  spent: number;
  income: number;
  net: number;
  /** Spent divided by the days so far (this month) or the days in the month (past months). */
  dailyAverage: number;
  /** Biggest categories by spend, largest first, at most three, with their share of spending (0–100). */
  split: { name: string; value: number; share: number }[];
}

export function monthSummary(rows: ApiTransaction[], month: number, categoryNames: Record<string, string>, now: Date = new Date()): MonthSummary {
  let spent = 0;
  let income = 0;
  const byCategory = new Map<string, number>();
  for (const row of inMonth(rows, month)) {
    if (!counts(row)) continue;
    const kind = rowKind(row.type);
    const amount = nairaAmount(row.amount);
    if (kind === "income") income += amount;
    if (kind !== "expense") continue;
    spent += amount;
    const name = (row.categoryId && categoryNames[row.categoryId]) || "Uncategorised";
    byCategory.set(name, (byCategory.get(name) ?? 0) + amount);
  }
  const year = Math.floor(month / 12);
  const daysInMonth = new Date(year, (month % 12) + 1, 0).getDate();
  const days = month === monthIndex(now) ? now.getDate() : month > monthIndex(now) ? 1 : daysInMonth;
  const split = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, value, share: spent > 0 ? Math.round((value / spent) * 100) : 0 }));
  return { spent, income, net: income - spent, dailyAverage: days > 0 ? spent / days : 0, split };
}

export function matchesFilter(row: ApiTransaction, filter: FeedFilter): boolean {
  if (filter === "all") return true;
  if (filter === "uncategorised") return needsCategory(row);
  return rowKind(row.type) === filter;
}

/** Search the description, category, account and the amount as typed ("5000", "5,000", "₦5,000"). */
export function matchesSearch(row: ApiTransaction, query: string, categoryNames: Record<string, string>, accountNames: Record<string, string>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[₦,\s]/g, "");
  if (/^\d+(\.\d+)?$/.test(digits)) {
    const amount = nairaAmount(row.amount);
    if (String(amount).startsWith(digits) || amount.toFixed(2).startsWith(digits)) return true;
  }
  const haystack = [row.description, row.categoryId ? categoryNames[row.categoryId] : "", accountNames[String(row.accountId)]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export interface FeedCounts {
  all: number;
  expense: number;
  income: number;
  transfer: number;
  uncategorised: number;
}

export function feedCounts(rows: ApiTransaction[]): FeedCounts {
  const out: FeedCounts = { all: rows.length, expense: 0, income: 0, transfer: 0, uncategorised: 0 };
  for (const row of rows) {
    out[rowKind(row.type)] += 1;
    if (needsCategory(row)) out.uncategorised += 1;
  }
  return out;
}

export interface FeedDay {
  key: string;
  label: string;
  net: number;
  items: LedgerItem[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return `Yesterday · ${date}`;
  return date;
}

function clockTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Newest first, one group per day, each with its net (income minus spending; transfers don't count). */
export function groupByDay(
  rows: ApiTransaction[],
  categoryNames: Record<string, string>,
  accountNames: Record<string, string>,
  now: Date = new Date(),
): FeedDay[] {
  const sorted = [...rows].sort((a, b) => (at(b)?.getTime() ?? 0) - (at(a)?.getTime() ?? 0));
  const days: FeedDay[] = [];
  const byKey = new Map<string, FeedDay>();
  for (const row of sorted) {
    const d = at(row);
    const key = d ? dayKey(d) : "undated";
    let day = byKey.get(key);
    if (!day) {
      day = { key, label: d ? dayLabel(d, now) : "Undated", net: 0, items: [] };
      byKey.set(key, day);
      days.push(day);
    }
    const kind = rowKind(row.type);
    const amount = nairaAmount(row.amount);
    if (counts(row) && kind === "income") day.net += amount;
    if (counts(row) && kind === "expense") day.net -= amount;
    day.items.push({
      id: String(row.id),
      title: row.description || (row.categoryId && categoryNames[row.categoryId]) || "Transaction",
      category: row.categoryId ? categoryNames[row.categoryId] : kind === "transfer" ? "Transfer" : undefined,
      account: accountNames[String(row.accountId)] ?? "",
      amount,
      kind,
      time: d ? clockTime(d) : "",
      pending: row.status === "pending",
      needsCategory: needsCategory(row),
    });
  }
  return days;
}

/** "2026-10-18" in local time, the same day the rows are grouped under. */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface CalendarDay {
  key: string;
  day: number;
  spent: number;
  income: number;
  count: number;
  today: boolean;
  future: boolean;
  /** 0 = nothing spent, 1–4 = share of the month's biggest day, for the heat shading. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface CalendarMonth {
  /** Blank cells before day 1 so the first day lands under its weekday. */
  lead: number;
  days: CalendarDay[];
  spent: number;
  activeDays: number;
  /** Days that have started: all of a past month, today's date in this month. */
  daysSoFar: number;
  biggest: CalendarDay | null;
}

export function calendarMonth(rows: ApiTransaction[], month: number, weekStartsOn: "monday" | "sunday" = "monday", now: Date = new Date()): CalendarMonth {
  const year = Math.floor(month / 12);
  const m = month % 12;
  const count = new Date(year, m + 1, 0).getDate();
  const todayKey = localDayKey(now);
  const days: CalendarDay[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(year, m, i + 1);
    const key = localDayKey(d);
    return { key, day: i + 1, spent: 0, income: 0, count: 0, today: key === todayKey, future: d.getTime() > now.getTime() && key !== todayKey, level: 0 };
  });
  for (const row of inMonth(rows, month)) {
    if (!counts(row)) continue;
    const d = at(row);
    if (!d) continue;
    const cell = days[d.getDate() - 1];
    const kind = rowKind(row.type);
    const amount = nairaAmount(row.amount);
    cell.count += 1;
    if (kind === "expense") cell.spent += amount;
    if (kind === "income") cell.income += amount;
  }
  const max = Math.max(0, ...days.map((d) => d.spent));
  for (const d of days) {
    if (d.spent > 0) d.level = Math.min(4, Math.max(1, Math.ceil((d.spent / max) * 4))) as CalendarDay["level"];
  }
  const firstWeekday = new Date(year, m, 1).getDay();
  const lead = weekStartsOn === "monday" ? (firstWeekday + 6) % 7 : firstWeekday;
  const daysSoFar = month < monthIndex(now) ? count : month === monthIndex(now) ? now.getDate() : 0;
  const biggest = days.reduce<CalendarDay | null>((best, d) => (d.spent > 0 && (!best || d.spent > best.spent) ? d : best), null);
  return {
    lead,
    days,
    spent: days.reduce((sum, d) => sum + d.spent, 0),
    activeDays: days.filter((d) => d.count > 0).length,
    daysSoFar,
    biggest,
  };
}

/** Open on today if anything happened today, else the latest day with activity, else today (or the 1st of a past month). */
export function defaultCalendarDay(cal: CalendarMonth): string {
  const today = cal.days.find((d) => d.today);
  if (today && today.count > 0) return today.key;
  const latest = [...cal.days].reverse().find((d) => d.count > 0 && !d.future);
  return latest?.key ?? today?.key ?? cal.days[0].key;
}

export type TableSort = { key: "date" | "amount" | "title"; dir: "asc" | "desc" };

export interface TableRow extends LedgerItem {
  /** The day label ("Today", "Sun 18 Oct"): a separator when sorted by date, a column otherwise. */
  day: string;
  dayKey: string;
  /** Only on the first row of each day, when sorted by date: the day's net. */
  dayNet?: number;
}

/** Rows for the desktop table. Sorted by date they keep their day groups; by amount or name they're one flat list. */
export function tableRows(days: FeedDay[], sort: TableSort): TableRow[] {
  if (sort.key === "date") {
    const ordered = sort.dir === "desc" ? days : [...days].reverse().map((d) => ({ ...d, items: [...d.items].reverse() }));
    return ordered.flatMap((d) => d.items.map((item, i) => ({ ...item, day: d.label, dayKey: d.key, dayNet: i === 0 ? d.net : undefined })));
  }
  const flat = days.flatMap((d) => d.items.map((item) => ({ ...item, day: d.label, dayKey: d.key })));
  const dir = sort.dir === "asc" ? 1 : -1;
  return flat.sort((a, b) => (sort.key === "amount" ? (a.amount - b.amount) * dir : a.title.localeCompare(b.title) * dir));
}

/** Rows posted on one local day (YYYY-MM-DD). */
export function onDay(rows: ApiTransaction[], key: string): ApiTransaction[] {
  return rows.filter((row) => {
    const d = at(row);
    return d != null && localDayKey(d) === key;
  });
}

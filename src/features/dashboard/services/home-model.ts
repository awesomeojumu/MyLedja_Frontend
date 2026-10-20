import { nairaAmount, rowKind, type ApiAccount, type ApiTransaction, type RowKind } from "@/lib/money-map";

/** Accounts whose balance is money you can spend now. Loans, cards and investments are left out. */
const LIVE_KINDS = new Set(["cash", "bank", "wallet"]);

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "ayo.bami@x.com" → "AY". Two letters from the email's local part; the API has no display name. */
export function initialsFromEmail(email?: string | null): string {
  const local = (email ?? "").split("@")[0].replace(/[^a-z0-9]/gi, "");
  return (local.slice(0, 2) || "?").toUpperCase();
}

export interface AvailableBalance {
  total: number;
  count: number;
  names: string[];
}

export function availableBalance(accounts: ApiAccount[]): AvailableBalance {
  const live = accounts.filter((row) => !row.archived && LIVE_KINDS.has(String(row.kind)));
  return {
    total: live.reduce((sum, row) => sum + nairaAmount(row.balance), 0),
    count: live.length,
    names: live.map((row) => row.name ?? "Account"),
  };
}

export interface BudgetRow {
  planned?: string;
  spent?: string;
  remaining?: string;
  periodTo?: string;
  lines?: { name?: string; spent?: string }[];
}

export interface BudgetSplit {
  name: string;
  spent: number;
}

export interface BudgetSummary {
  planned: number;
  spent: number;
  remaining: number;
  /** Whole days until the soonest budget period ends, or null when the server sent no period. */
  daysLeft: number | null;
  /** The biggest spending lines, largest first, at most three. */
  split: BudgetSplit[];
}

export function budgetSummary(rows: BudgetRow[], now: Date = new Date()): BudgetSummary | null {
  if (rows.length === 0) return null;
  const byName = new Map<string, number>();
  let soonest: number | null = null;
  let planned = 0;
  let spent = 0;
  for (const row of rows) {
    planned += nairaAmount(row.planned);
    spent += nairaAmount(row.spent);
    for (const line of row.lines ?? []) {
      const name = line.name ?? "Other";
      byName.set(name, (byName.get(name) ?? 0) + nairaAmount(line.spent));
    }
    const end = row.periodTo ? Date.parse(row.periodTo) : Number.NaN;
    if (Number.isFinite(end) && (soonest == null || end < soonest)) soonest = end;
  }
  const split = [...byName.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, spent: value }));
  return {
    planned,
    spent,
    remaining: planned - spent,
    daysLeft: soonest == null ? null : Math.max(0, Math.ceil((soonest - now.getTime()) / 86400000)),
    split,
  };
}

/** Posted spending and income only; pending, draft and voided rows don't count toward charts. */
function posted(rows: ApiTransaction[]): { at: Date; kind: RowKind; amount: number; row: ApiTransaction }[] {
  const out = [];
  for (const row of rows) {
    if (row.status && row.status !== "posted") continue;
    const at = row.occurredAt ? new Date(row.occurredAt) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    out.push({ at, kind: rowKind(row.type), amount: nairaAmount(row.amount), row });
  }
  return out;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface WeekSpend {
  /** Seven days ending today; `compare` is the same weekday a week earlier. */
  days: { label: string; value: number; compare: number }[];
  total: number;
  previous: number;
}

export function weekSpend(rows: ApiTransaction[], now: Date = new Date()): WeekSpend {
  const today = startOfDay(now).getTime();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today - (6 - i) * 86400000);
    return { label: i === 6 ? "Today" : WEEKDAY[d.getDay()], value: 0, compare: 0 };
  });
  for (const r of posted(rows)) {
    if (r.kind !== "expense") continue;
    const ago = Math.round((today - startOfDay(r.at).getTime()) / 86400000);
    if (ago >= 0 && ago < 7) days[6 - ago].value += r.amount;
    else if (ago >= 7 && ago < 14) days[13 - ago].compare += r.amount;
  }
  return {
    days,
    total: days.reduce((sum, d) => sum + d.value, 0),
    previous: days.reduce((sum, d) => sum + d.compare, 0),
  };
}

/** This month's spending by category, largest first, at most `limit` rows. */
export function categorySpend(
  rows: ApiTransaction[],
  categoryNames: Record<string, string>,
  now: Date = new Date(),
  limit = 5,
): { label: string; value: number; count: number }[] {
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const totals = new Map<string, { value: number; count: number }>();
  for (const r of posted(rows)) {
    if (r.kind !== "expense" || r.at.getTime() < from || r.at.getTime() > now.getTime()) continue;
    const label = (r.row.categoryId && categoryNames[r.row.categoryId]) || r.row.description || "Other";
    const cur = totals.get(label) ?? { value: 0, count: 0 };
    totals.set(label, { value: cur.value + r.amount, count: cur.count + 1 });
  }
  return [...totals.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Money in and out for each of the last `months` months, oldest first. Transfers don't count. */
export function monthlyFlow(rows: ApiTransaction[], now: Date = new Date(), months = 6): { labels: string[]; income: number[]; expense: number[] } {
  const labels: string[] = [];
  const income = new Array<number>(months).fill(0);
  const expense = new Array<number>(months).fill(0);
  for (let i = 0; i < months; i++) labels.push(MONTH[new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1).getMonth()]);
  for (const r of posted(rows)) {
    const index = months - 1 - ((now.getFullYear() - r.at.getFullYear()) * 12 + now.getMonth() - r.at.getMonth());
    if (index < 0 || index >= months) continue;
    if (r.kind === "income") income[index] += r.amount;
    if (r.kind === "expense") expense[index] += r.amount;
  }
  return { labels, income, expense };
}

export interface RecentItem {
  id: string;
  title: string;
  account: string;
  amount: number;
  kind: RowKind;
  time: string;
  pending?: boolean;
}

export interface RecentGroup {
  label: string;
  /** Income minus expenses for the day; transfers move money between your own accounts, so they don't count. */
  net: number;
  items: RecentItem[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function clockTime(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
}

/** Rows newest first, grouped under Today / Yesterday / a short date. Rows without a date go under "Earlier". */
export function groupRecent(rows: { row: ApiTransaction; account: string }[], now: Date = new Date()): RecentGroup[] {
  const groups: RecentGroup[] = [];
  const byKey = new Map<string, RecentGroup>();
  const time = (row: ApiTransaction) => (row.occurredAt ? Date.parse(row.occurredAt) || 0 : 0);
  const sorted = [...rows].sort((a, b) => time(b.row) - time(a.row));
  for (const { row, account } of sorted) {
    const at = row.occurredAt ? new Date(row.occurredAt) : null;
    const valid = at != null && !Number.isNaN(at.getTime());
    const key = valid ? dayKey(at) : "earlier";
    let group = byKey.get(key);
    if (!group) {
      group = { label: valid ? dayLabel(at, now) : "Earlier", net: 0, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    const kind = rowKind(row.type);
    const amount = nairaAmount(row.amount);
    if (kind === "income") group.net += amount;
    if (kind === "expense") group.net -= amount;
    group.items.push({
      id: String(row.id),
      title: row.description || "Transaction",
      account,
      amount,
      kind,
      time: valid ? clockTime(at) : "",
    });
  }
  return groups;
}

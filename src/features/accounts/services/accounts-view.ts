import { nairaAmount, parseNaira, type ApiAccount, type ApiTransaction } from "@/lib/money-map";

export type AccountGroupKey = "cash" | "savings" | "receivable" | "liability";
export type GroupMode = "type" | "bank";
export type AccountSort = "balance" | "name";

export interface AccountView {
  id: string;
  name: string;
  kind: string;
  group: AccountGroupKey;
  institution: string;
  mask: string | null;
  connection: "manual" | "linked" | "imported";
  /** As stored: what's in it, or for a liability what you owe (positive). */
  balance: number;
  /** Counted toward net worth: liabilities are negative. */
  signed: number;
  /** This month's movement for money you hold; null for liabilities. */
  change: number | null;
  /** ₦0 and no activity in the last 60 days: sorted last and dimmed. */
  empty: boolean;
  /** Your bank's balance minus ours, when the bank reported one and it differs. */
  mismatch: number | null;
  reconciledAsOf: string | null;
  pinned: boolean;
}

const GROUP_OF: Record<string, AccountGroupKey> = {
  bank: "cash",
  wallet: "cash",
  cash: "cash",
  savings: "savings",
  receivable: "receivable",
  liability: "liability",
};

export const GROUP_LABEL: Record<AccountGroupKey, string> = {
  cash: "Cash & bank",
  savings: "Savings",
  receivable: "Owed to you",
  liability: "You owe",
};

const GROUP_ORDER: AccountGroupKey[] = ["cash", "savings", "receivable", "liability"];
const EMPTY_AFTER_DAYS = 60;

function counts(row: ApiTransaction): boolean {
  return !row.status || row.status === "posted";
}

/** Each account's net movement this month, and when it last moved. */
export function accountActivity(txns: ApiTransaction[], now: Date = new Date()): { change: Map<string, number>; last: Map<string, number> } {
  const change = new Map<string, number>();
  const last = new Map<string, number>();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const add = (id: string | null | undefined, amount: number, at: number) => {
    if (!id) return;
    if (at >= monthStart && at <= now.getTime()) change.set(id, (change.get(id) ?? 0) + amount);
    last.set(id, Math.max(last.get(id) ?? 0, at));
  };
  for (const row of txns) {
    if (!counts(row) || !row.occurredAt) continue;
    const at = Date.parse(row.occurredAt);
    if (!Number.isFinite(at)) continue;
    const amount = nairaAmount(row.amount);
    const from = row.accountId ? String(row.accountId) : null;
    if (row.type === "income" || row.type === "refund" || row.type === "loan_in" || row.type === "principal_collect") add(from, amount, at);
    else if (row.type === "transfer") {
      add(from, -amount, at);
      add(row.toAccountId ? String(row.toAccountId) : null, amount, at);
    } else add(from, -amount, at);
  }
  return { change, last };
}

export function toViews(rows: ApiAccount[], txns: ApiTransaction[], pinned: ReadonlySet<string>, now: Date = new Date()): AccountView[] {
  const { change, last } = accountActivity(txns, now);
  const quietSince = now.getTime() - EMPTY_AFTER_DAYS * 86400000;
  return rows
    .filter((row) => row.id && !row.archived)
    .map((row) => {
      const id = String(row.id);
      const kind = String(row.kind ?? "cash");
      const group = GROUP_OF[kind] ?? "cash";
      const balance = nairaAmount(row.balance);
      const external = parseNaira(row.externalBalance);
      const diff = external == null ? 0 : Math.round((external - balance) * 100) / 100;
      return {
        id,
        name: String(row.name ?? "Account"),
        kind,
        group,
        institution: row.institution ?? "",
        mask: row.mask ?? null,
        connection: row.connectionType ?? "manual",
        balance,
        signed: group === "liability" ? -balance : balance,
        change: group === "liability" ? null : (change.get(id) ?? 0),
        empty: balance === 0 && (last.get(id) ?? 0) < quietSince,
        mismatch: diff === 0 ? null : diff,
        reconciledAsOf: row.reconciledAsOf ?? null,
        pinned: pinned.has(id),
      };
    });
}

export interface Totals {
  netWorth: number;
  have: number;
  owe: number;
  /** For the composition bar: what's held in each kind of account. */
  parts: { key: "cash" | "savings" | "receivable" | "liability"; label: string; value: number }[];
}

export function totals(views: AccountView[]): Totals {
  const sum = (g: AccountGroupKey) => views.filter((v) => v.group === g).reduce((s, v) => s + v.balance, 0);
  const cash = sum("cash");
  const savings = sum("savings");
  const receivable = sum("receivable");
  const owe = sum("liability");
  return {
    netWorth: cash + savings + receivable - owe,
    have: cash + savings + receivable,
    owe,
    parts: [
      { key: "cash" as const, label: "Cash & bank", value: cash },
      { key: "savings" as const, label: "Savings", value: savings },
      { key: "receivable" as const, label: "Owed to you", value: receivable },
      { key: "liability" as const, label: "You owe", value: owe },
    ].filter((p) => p.value > 0),
  };
}

export interface AccountGroup {
  key: string;
  label: string;
  /** Net of the group: liabilities count negative. */
  total: number;
  accounts: AccountView[];
}

function matches(v: AccountView, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [v.name, v.institution, v.mask ?? ""].join(" ").toLowerCase().includes(q);
}

/** Pinned first, then accounts with money or activity, then the empty ones; within each, by the chosen sort. */
function order(a: AccountView, b: AccountView, sort: AccountSort): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.empty !== b.empty) return a.empty ? 1 : -1;
  if (sort === "name") return a.name.localeCompare(b.name);
  return b.balance - a.balance || a.name.localeCompare(b.name);
}

export function groupAccounts(views: AccountView[], mode: GroupMode, sort: AccountSort, query = ""): AccountGroup[] {
  const shown = views.filter((v) => matches(v, query));
  const groups = new Map<string, AccountGroup>();
  for (const v of shown) {
    const key = mode === "type" ? v.group : v.institution.trim() || (v.group === "cash" ? "Cash & wallets" : "Other");
    const label = mode === "type" ? GROUP_LABEL[v.group] : key;
    const g = groups.get(key) ?? { key, label, total: 0, accounts: [] };
    g.total += v.signed;
    g.accounts.push(v);
    groups.set(key, g);
  }
  for (const g of groups.values()) g.accounts.sort((a, b) => order(a, b, sort));
  const list = [...groups.values()];
  if (mode === "type") return list.sort((a, b) => GROUP_ORDER.indexOf(a.key as AccountGroupKey) - GROUP_ORDER.indexOf(b.key as AccountGroupKey));
  return list.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

/** The first `limit` accounts (pinned always included), and what's behind "Show more". */
export function visibleSplit(accounts: AccountView[], limit = 4): { shown: AccountView[]; hidden: number; hiddenEmpty: number } {
  const pinned = accounts.filter((a) => a.pinned).length;
  const cut = Math.max(limit, pinned);
  // Don't hide a single account behind "Show 1 more".
  if (accounts.length <= cut + 1) return { shown: accounts, hidden: 0, hiddenEmpty: 0 };
  const rest = accounts.slice(cut);
  return { shown: accounts.slice(0, cut), hidden: rest.length, hiddenEmpty: rest.filter((a) => a.empty).length };
}

export function issues(views: AccountView[]): AccountView[] {
  return views.filter((v) => v.mismatch != null);
}

/** Where Reconcile and Import go: the account needing attention, else the biggest bank account, else the biggest you hold. */
export function primaryAccount(views: AccountView[]): AccountView | null {
  const issue = issues(views)[0];
  if (issue) return issue;
  const held = views.filter((v) => v.group !== "liability").sort((a, b) => b.balance - a.balance);
  return held.find((v) => v.kind === "bank") ?? held[0] ?? null;
}

/** "GTBank" → "GT", "First Bank" → "FB", "Opay wallet" → "OW". */
export function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const CONNECTION: Record<AccountView["connection"], string> = { manual: "Manual", linked: "Linked", imported: "Imported" };

/** "•••• 4821 · Linked", or "Reconciled 3 Oct" when there's no card number to show. */
export function subLine(v: AccountView): string {
  const parts: string[] = [];
  if (v.mask) parts.push(`•••• ${v.mask}`);
  else if (v.institution && v.institution !== v.name) parts.push(v.institution);
  if (v.reconciledAsOf && !v.mask) {
    const d = new Date(v.reconciledAsOf);
    if (!Number.isNaN(d.getTime())) parts.push(`Reconciled ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
  } else parts.push(CONNECTION[v.connection]);
  return parts.join(" · ");
}

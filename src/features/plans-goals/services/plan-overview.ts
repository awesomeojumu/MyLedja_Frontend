import { nairaAmount, rowKind, type ApiAccount, type ApiTransaction } from "@/lib/money-map";

/** Shapes as the API sends them (money as naira strings, dates as ISO or YYYY-MM-DD). */
export interface PlanBill {
  id: string;
  name?: string;
  amount?: string | null;
  cadence?: string;
  lastPaidAt?: string | null;
  dueFor?: string;
  nextDue?: string;
}
export interface PlanStream {
  id: string;
  name?: string;
  expected?: string | null;
  cadence?: string;
  payDay?: number | null;
  nextPayday?: string | null;
}
export interface PlanGoal {
  id: string;
  name?: string;
  target?: string;
  saved?: string;
  completed?: boolean;
  schedules?: { amount?: string; nextAt?: string }[];
}
export interface PlanDebt {
  id: string;
  direction?: string;
  counterparty?: string;
  principal?: string | null;
}
export interface PlanBudget {
  planned?: string;
  spent?: string;
  periodTo?: string;
}

export interface PlanInput {
  accounts: ApiAccount[];
  bills: PlanBill[];
  streams: PlanStream[];
  goals: PlanGoal[];
  debts: PlanDebt[];
  budgets: PlanBudget[];
  txns: ApiTransaction[];
}

const LIVE = new Set(["cash", "bank", "wallet"]);
const DAY = 86400000;

/** "2026-10-25" → local midnight of that day. ISO timestamps keep their local day. */
export function dayOf(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const at = new Date(value);
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

export interface Payday {
  name: string;
  amount: number;
  date: Date;
  daysAway: number;
}

/** The soonest expected pay date across income with a pay day set. */
export function nextPayday(streams: PlanStream[], now: Date): Payday | null {
  let best: Payday | null = null;
  for (const s of streams) {
    if (!s.nextPayday) continue;
    const date = dayOf(s.nextPayday);
    const daysAway = daysBetween(now, date);
    if (daysAway < 0) continue;
    if (!best || date < best.date) best = { name: s.name || "Salary", amount: nairaAmount(s.expected), date, daysAway };
  }
  return best;
}

export interface MonthBill {
  id: string;
  name: string;
  amount: number;
  due: Date;
  paid: boolean;
  overdue: boolean;
  daysAway: number;
}

/** This month's occurrence of each bill, and whether it's been paid since it fell due. */
export function billsThisMonth(bills: PlanBill[], now: Date): MonthBill[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const out: MonthBill[] = [];
  for (const b of bills) {
    const dueText = b.dueFor ?? b.nextDue;
    if (!dueText) continue;
    const due = dayOf(dueText);
    if (due.getMonth() !== now.getMonth() || due.getFullYear() !== now.getFullYear()) continue;
    const paidAt = b.lastPaidAt ? new Date(b.lastPaidAt) : null;
    // Paid counts from the start of the month for monthly bills, from a week before due for weekly ones.
    const windowStart = b.cadence === "weekly" ? new Date(due.getTime() - 6 * DAY) : monthStart;
    const paid = paidAt != null && paidAt >= windowStart;
    const daysAway = daysBetween(now, due);
    out.push({ id: String(b.id), name: b.name || "Bill", amount: nairaAmount(b.amount), due, paid, overdue: !paid && daysAway < 0, daysAway });
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export type Outlook = "short" | "tight" | "comfortable";

export interface Projection {
  /** One point per day from today to the end of the month: the balance at the end of that day. */
  points: { date: Date; balance: number }[];
  start: number;
  /** The lowest balance before payday (or before month end when there's no payday). */
  low: number;
  /** The balance on the day before payday, i.e. "you'll have" just before money comes in. */
  beforePayday: number;
  outlook: Outlook;
}

/**
 * Today's spendable balance stepped forward through the month: unpaid bills come out on their due day (overdue ones
 * today), expected pay goes in on payday, and scheduled goal savings come out on their date. Day-to-day spending
 * isn't guessed.
 */
export function projectBalance(input: PlanInput, payday: Payday | null, bills: MonthBill[], now: Date): Projection {
  const today = startOfDay(now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const start = input.accounts.filter((a) => !a.archived && LIVE.has(String(a.kind))).reduce((sum, a) => sum + nairaAmount(a.balance), 0);
  const deltas = new Map<number, number>();
  const add = (date: Date, amount: number) => {
    const day = Math.max(0, daysBetween(today, date));
    deltas.set(day, (deltas.get(day) ?? 0) + amount);
  };
  for (const b of bills) if (!b.paid) add(b.due, -b.amount);
  for (const s of input.streams) {
    if (!s.nextPayday) continue;
    const date = dayOf(s.nextPayday);
    if (date <= end && date >= today) add(date, nairaAmount(s.expected));
  }
  for (const g of input.goals) {
    if (g.completed) continue;
    for (const sc of g.schedules ?? []) {
      if (!sc.nextAt) continue;
      const date = dayOf(sc.nextAt);
      if (date <= end && date >= today) add(date, -nairaAmount(sc.amount));
    }
  }
  const points: { date: Date; balance: number }[] = [];
  let balance = start;
  const span = daysBetween(today, end);
  for (let i = 0; i <= span; i++) {
    balance += deltas.get(i) ?? 0;
    points.push({ date: new Date(today.getTime() + i * DAY), balance });
  }
  // Payday's own money lands that day, so "before payday" is the day before it.
  const cutoff = payday && payday.daysAway <= span ? payday.daysAway - 1 : span;
  const window = points.slice(0, Math.max(1, cutoff + 1));
  const low = Math.min(...window.map((p) => p.balance));
  const beforePayday = window[window.length - 1].balance;
  const expected = input.streams.reduce((sum, s) => sum + (s.cadence === "monthly" || !s.cadence ? nairaAmount(s.expected) : 0), 0);
  const cushion = Math.max(5000, expected * 0.05);
  const outlook: Outlook = low < 0 ? "short" : low < cushion ? "tight" : "comfortable";
  return { points, start, low, beforePayday, outlook };
}

export interface PlanOverview {
  payday: Payday | null;
  /** True when there's monthly income but none of it has a pay day yet. */
  needsPayday: boolean;
  hasIncome: boolean;
  projection: Projection;
  bills: MonthBill[];
  /** Unpaid bills due on or before payday (or the end of the month), overdue first. */
  beforePayday: MonthBill[];
  billsLeft: number;
  billsLeftAmount: number;
  billsPaid: number;
  budget: { planned: number; spent: number; remaining: number; daysLeft: number | null } | null;
  goals: { id: string; name: string; target: number; saved: number; share: number }[];
  debts: { owe: number; owed: number; count: number };
  income: { expected: number; received: number };
}

export function planOverview(input: PlanInput, now: Date = new Date()): PlanOverview {
  const payday = nextPayday(input.streams, now);
  const bills = billsThisMonth(input.bills, now);
  const projection = projectBalance(input, payday, bills, now);
  const horizon = payday ? payday.daysAway : daysBetween(now, new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const beforePayday = bills.filter((b) => !b.paid && b.daysAway <= horizon);
  const unpaid = bills.filter((b) => !b.paid);

  let budget: PlanOverview["budget"] = null;
  if (input.budgets.length) {
    let planned = 0;
    let spent = 0;
    let soonest: number | null = null;
    for (const b of input.budgets) {
      planned += nairaAmount(b.planned);
      spent += nairaAmount(b.spent);
      const end = b.periodTo ? Date.parse(b.periodTo) : Number.NaN;
      if (Number.isFinite(end) && (soonest == null || end < soonest)) soonest = end;
    }
    budget = { planned, spent, remaining: planned - spent, daysLeft: soonest == null ? null : Math.max(0, Math.ceil((soonest - now.getTime()) / DAY)) };
  }

  const goals = input.goals
    .filter((g) => !g.completed)
    .map((g) => {
      const target = nairaAmount(g.target);
      const saved = nairaAmount(g.saved);
      return { id: String(g.id), name: g.name || "Goal", target, saved, share: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0 };
    })
    .sort((a, b) => b.share - a.share);

  const debts = { owe: 0, owed: 0, count: 0 };
  for (const d of input.debts) {
    const amount = nairaAmount(d.principal);
    if (amount <= 0) continue;
    debts.count += 1;
    if (d.direction === "owed_to_me") debts.owed += amount;
    else debts.owe += amount;
  }

  const monthly = input.streams.filter((s) => s.cadence === "monthly" || !s.cadence);
  const expected = monthly.reduce((sum, s) => sum + nairaAmount(s.expected), 0);
  let received = 0;
  for (const tx of input.txns) {
    if (tx.status && tx.status !== "posted") continue;
    if (!tx.occurredAt || rowKind(tx.type) !== "income" || tx.type === "refund") continue;
    const at = new Date(tx.occurredAt);
    if (at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth()) received += nairaAmount(tx.amount);
  }

  return {
    payday,
    needsPayday: !payday && monthly.length > 0,
    hasIncome: input.streams.length > 0,
    projection,
    bills,
    beforePayday,
    billsLeft: unpaid.length,
    billsLeftAmount: unpaid.reduce((sum, b) => sum + b.amount, 0),
    billsPaid: bills.length - unpaid.length,
    budget,
    goals,
    debts,
    income: { expected, received },
  };
}

/** The income stream a "set your payday" prompt should edit: the biggest monthly one. */
export function mainStream(streams: PlanStream[]): PlanStream | null {
  const monthly = streams.filter((s) => s.cadence === "monthly" || !s.cadence);
  return monthly.sort((a, b) => nairaAmount(b.expected) - nairaAmount(a.expected))[0] ?? null;
}

import { nairaAmount } from "@/lib/money-map";

/** A bill as the API lists it. */
export interface ApiBill {
  id: string;
  name?: string;
  amount?: string | null;
  cadence?: string;
  anchorDay?: number;
  /** 1–12, yearly bills only. */
  anchorMonth?: number | null;
  weekday?: number;
  lastPaidAt?: string | null;
  nextDue?: string;
  accountId?: string | null;
}

export type BillStatus = "paid" | "due" | "overdue";

export interface BillOccurrence {
  /** id + date, unique per occurrence. */
  key: string;
  billId: string;
  name: string;
  amount: number;
  cadence: string;
  due: Date;
  status: BillStatus;
  /** Whole days from today (negative when past). */
  daysAway: number;
}

const DAY = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

function clamp(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(day, 1), last));
}

/** Every date a bill falls due in a month (local time). Yearly bills only fall in their own month. */
export function dueDatesIn(bill: ApiBill, year: number, month: number): Date[] {
  const cadence = bill.cadence ?? "monthly";
  if (cadence === "weekly") {
    const out: Date[] = [];
    const last = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const date = new Date(year, month, d);
      if (date.getDay() === (bill.weekday ?? 1)) out.push(date);
    }
    return out;
  }
  if (cadence === "yearly") {
    // Without a saved month, fall back to the month of the next due date the server worked out.
    const anchorMonth = bill.anchorMonth ? bill.anchorMonth - 1 : bill.nextDue ? Number(bill.nextDue.slice(5, 7)) - 1 : month;
    return anchorMonth === month ? [clamp(year, month, bill.anchorDay ?? 1)] : [];
  }
  return [clamp(year, month, bill.anchorDay ?? 1)];
}

/**
 * Whether the payment on record covers this occurrence. A payment counts for the due date it lands near: within
 * the cycle before it (a week for weekly, the month for monthly, two months for yearly) or any time after it.
 */
function paidFor(bill: ApiBill, due: Date): boolean {
  if (!bill.lastPaidAt) return false;
  const paid = new Date(bill.lastPaidAt);
  if (Number.isNaN(paid.getTime())) return false;
  const cadence = bill.cadence ?? "monthly";
  const before = cadence === "weekly" ? 6 : cadence === "yearly" ? 62 : 27;
  const after = cadence === "weekly" ? 6 : cadence === "yearly" ? 300 : 27;
  const gap = daysBetween(due, paid);
  return gap >= -before && gap <= after;
}

export function occurrence(bill: ApiBill, due: Date, now: Date): BillOccurrence {
  const daysAway = daysBetween(now, due);
  const paid = paidFor(bill, due);
  // Past months only know the last payment, so an unpaid date there isn't called overdue; this month's is.
  const thisMonth = due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  const status: BillStatus = paid ? "paid" : daysAway < 0 && thisMonth ? "overdue" : "due";
  return {
    key: `${bill.id}:${due.getFullYear()}-${due.getMonth() + 1}-${due.getDate()}`,
    billId: String(bill.id),
    name: bill.name || "Bill",
    amount: nairaAmount(bill.amount),
    cadence: bill.cadence ?? "monthly",
    due,
    status,
    daysAway,
  };
}

/** Every occurrence in a month, in date order. */
export function monthOccurrences(bills: ApiBill[], year: number, month: number, now: Date = new Date()): BillOccurrence[] {
  return bills
    .flatMap((b) => dueDatesIn(b, year, month).map((d) => occurrence(b, d, now)))
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.name.localeCompare(b.name));
}

export interface BillsOverview {
  /** This month: unpaid (including overdue) total, paid total and the whole month's total. */
  leftToPay: number;
  paid: number;
  total: number;
  overdue: BillOccurrence[];
  /** Unpaid, from today through the next 30 days (crosses into next month). */
  upcoming: BillOccurrence[];
  paidThisMonth: BillOccurrence[];
  /** The next 7 days starting today, with the bills due on each. */
  week: { date: Date; bills: BillOccurrence[] }[];
}

export function billsOverview(bills: ApiBill[], now: Date = new Date()): BillsOverview {
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisMonth = monthOccurrences(bills, y, m, now);
  const next = m === 11 ? monthOccurrences(bills, y + 1, 0, now) : monthOccurrences(bills, y, m + 1, now);
  const ahead = [...thisMonth, ...next].filter((o) => o.daysAway >= 0 && o.daysAway <= 30);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m, now.getDate() + i);
    return { date, bills: ahead.filter((o) => daysBetween(date, o.due) === 0) };
  });
  const sum = (list: BillOccurrence[]) => list.reduce((s, o) => s + o.amount, 0);
  const unpaid = thisMonth.filter((o) => o.status !== "paid");
  const paidThisMonth = thisMonth.filter((o) => o.status === "paid");
  return {
    leftToPay: sum(unpaid),
    paid: sum(paidThisMonth),
    total: sum(thisMonth),
    overdue: thisMonth.filter((o) => o.status === "overdue"),
    upcoming: ahead.filter((o) => o.status === "due"),
    paidThisMonth,
    week,
  };
}

/** "Due today" / "Tomorrow" / "in 2 days" / "Overdue since 15 Oct". */
export function whenText(o: BillOccurrence): string {
  const date = o.due.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (o.status === "overdue") return `Overdue since ${date}`;
  if (o.status === "paid") return `Paid · due ${date}`;
  if (o.daysAway === 0) return "Due today";
  if (o.daysAway === 1) return "Tomorrow";
  return `in ${o.daysAway} days`;
}

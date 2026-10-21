import { billsOverview, dueDatesIn, monthOccurrences, whenText } from "@/features/bills/services/bill-month";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 9, 21, 10);
const iso = (y: number, m: number, d: number) => new Date(y, m, d, 12).toISOString();
const bills = [
  { id: "dstv", name: "DSTV", amount: "12500.00", cadence: "monthly", anchorDay: 23, lastPaidAt: iso(2026, 8, 23) },
  { id: "gym", name: "Gym", amount: "8000.00", cadence: "monthly", anchorDay: 15, lastPaidAt: iso(2026, 8, 15) },
  { id: "net", name: "Internet", amount: "15000.00", cadence: "monthly", anchorDay: 5, lastPaidAt: iso(2026, 9, 4) },
  { id: "rent", name: "Rent", amount: "75000.00", cadence: "yearly", anchorDay: 30, anchorMonth: 10, lastPaidAt: null },
  { id: "power", name: "Electricity", amount: "10000.00", cadence: "monthly", anchorDay: 2, lastPaidAt: iso(2026, 9, 2) },
  { id: "maid", name: "Cleaner", amount: "3000.00", cadence: "weekly", weekday: 5, lastPaidAt: iso(2026, 9, 16) },
];

assert(dueDatesIn(bills[0], 2026, 9).length === 1 && dueDatesIn(bills[0], 2026, 9)[0].getDate() === 23, "monthly on its day");
assert(dueDatesIn(bills[3], 2026, 9).length === 1 && dueDatesIn(bills[3], 2026, 10).length === 0, "yearly only in its month");
assert(dueDatesIn({ id: "x", cadence: "monthly", anchorDay: 31 }, 2026, 10)[0].getDate() === 30, "day 31 clamps to a short month");
assert(dueDatesIn(bills[5], 2026, 9).length === 5, "five Fridays in October 2026");

const oct = monthOccurrences(bills, 2026, 9, now);
const status = (id: string, day: number) => oct.find((o) => o.billId === id && o.due.getDate() === day)?.status;
assert(status("net", 5) === "paid", "paid the day before it was due");
assert(status("gym", 15) === "overdue", "last paid in September, October's date has passed");
assert(status("dstv", 23) === "due", "coming up");
assert(status("maid", 16) === "paid" && status("maid", 9) === "overdue" && status("maid", 23) === "due", "weekly payments count per week");

const sept = monthOccurrences(bills, 2026, 8, now);
assert(sept.find((o) => o.billId === "gym")?.status === "paid", "September's gym was paid");
assert(!sept.some((o) => o.status === "overdue"), "past months never show overdue");

const o = billsOverview(bills, now);
assert(o.overdue.length === 3 && o.overdue.filter((x) => x.billId === "maid").length === 2, "overdue this month: gym and two cleaner Fridays");
assert(o.upcoming[0].daysAway === 2 && o.upcoming.slice(0, 2).map((x) => x.billId).sort().join(",") === "dstv,maid", "next up first");
assert(o.upcoming.some((x) => x.billId === "power" && x.due.getMonth() === 10), "early next month is in the 30-day window");
assert(o.paid === 15000 + 10000 + 3000, "paid this month");
assert(o.total === 12500 + 8000 + 15000 + 75000 + 10000 + 3000 * 5, "whole month");
assert(o.leftToPay === o.total - o.paid, "left to pay");
assert(o.week.length === 7 && o.week[2].bills.some((x) => x.billId === "dstv"), "week strip starts today");
assert(whenText(o.upcoming.find((x) => x.billId === "dstv")!) === "in 2 days", "when text");
assert(whenText(o.overdue.find((x) => x.billId === "gym")!) === "Overdue since 15 Oct", "overdue text");

console.log("bill-month: occurrences, status, overview, week strip");

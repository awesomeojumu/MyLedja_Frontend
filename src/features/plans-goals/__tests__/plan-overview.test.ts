import { billsThisMonth, mainStream, nextPayday, planOverview, type PlanInput } from "@/features/plans-goals/services/plan-overview";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date(2026, 9, 20, 15);
const input: PlanInput = {
  accounts: [
    { id: "gt", name: "GTBank", kind: "bank", balance: "14000.00" },
    { id: "loan", name: "Car loan", kind: "liability", balance: "420000.00" },
  ],
  bills: [
    { id: "dstv", name: "DSTV", amount: "12500.00", cadence: "monthly", dueFor: "2026-10-23", lastPaidAt: null },
    { id: "rent", name: "Rent", amount: "75000.00", cadence: "monthly", dueFor: "2026-10-30", lastPaidAt: null },
    { id: "net", name: "Internet", amount: "15000.00", cadence: "monthly", dueFor: "2026-10-05", lastPaidAt: new Date(2026, 9, 4).toISOString() },
    { id: "gym", name: "Gym", amount: "8000.00", cadence: "monthly", dueFor: "2026-10-15", lastPaidAt: new Date(2026, 8, 15).toISOString() },
  ],
  streams: [
    { id: "sal", name: "Salary", expected: "350000.00", cadence: "monthly", payDay: 25, nextPayday: "2026-10-25" },
    { id: "side", name: "Side gig", expected: "50000.00", cadence: "monthly", payDay: null, nextPayday: null },
  ],
  goals: [
    { id: "lap", name: "New laptop", target: "600000.00", saved: "240000.00", completed: false, schedules: [{ amount: "20000.00", nextAt: "2026-10-26T09:00:00.000Z" }] },
    { id: "japa", name: "Japa fund", target: "2000000.00", saved: "300000.00", completed: false },
    { id: "done", name: "Phone", target: "100000.00", saved: "100000.00", completed: true },
  ],
  debts: [
    { id: "d1", direction: "i_owe", principal: "15000.00" },
    { id: "d2", direction: "owed_to_me", principal: "8000.00" },
    { id: "d3", direction: "i_owe", principal: "0.00" },
  ],
  budgets: [{ planned: "100000.00", spent: "6000.00", periodTo: "2026-10-31T23:59:59.999Z" }],
  txns: [
    { id: "t1", type: "income", amount: "20000.00", occurredAt: new Date(2026, 9, 10).toISOString() },
    { id: "t2", type: "income", amount: "5000.00", occurredAt: new Date(2026, 8, 30).toISOString() },
    { id: "t3", type: "income", amount: "9999.00", occurredAt: new Date(2026, 9, 11).toISOString(), status: "voided" },
  ],
};

const pay = nextPayday(input.streams, now);
assert(pay?.name === "Salary" && pay.daysAway === 5 && pay.amount === 350000, "payday in 5 days");

const bills = billsThisMonth(input.bills, now);
assert(bills.map((b) => b.id).join(",") === "net,gym,dstv,rent", "bills in due order");
assert(bills[0].paid && !bills[1].paid && bills[1].overdue, "paid this month vs overdue (paid last month only)");

const o = planOverview(input, now);
assert(o.projection.start === 14000, "starts from cash, bank and wallet; loans don't count");
assert(o.beforePayday.map((b) => b.id).join(",") === "gym,dstv", "before payday: overdue first, then due by payday");
assert(o.projection.beforePayday === 14000 - 8000 - 12500, "balance the day before payday");
assert(o.projection.low === -6500 && o.projection.outlook === "short", "goes negative before payday");
const end = o.projection.points[o.projection.points.length - 1];
assert(o.projection.points.length === 12 && end.date.getDate() === 31, "one point per day to month end");
assert(end.balance === -6500 + 350000 - 20000 - 75000, "payday in, goal saving and rent out by month end");
assert(o.billsLeft === 3 && o.billsPaid === 1 && o.billsLeftAmount === 95500, "bills left this month");
assert(o.budget?.remaining === 94000 && o.budget.daysLeft === 12, "budget summary");
assert(o.goals.length === 2 && o.goals[0].name === "New laptop" && o.goals[0].share === 40, "active goals, closest first");
assert(o.debts.owe === 15000 && o.debts.owed === 8000 && o.debts.count === 2, "debts, zero balances skipped");
assert(o.income.expected === 400000 && o.income.received === 20000, "monthly income expected vs posted income this month");
assert(!o.needsPayday && o.hasIncome, "payday known");

const tight = planOverview({ ...input, accounts: [{ id: "gt", kind: "bank", balance: "30000.00" }] }, now);
assert(tight.projection.low === 9500 && tight.projection.outlook === "tight", "under the cushion is tight");
const fine = planOverview({ ...input, accounts: [{ id: "gt", kind: "bank", balance: "500000.00" }] }, now);
assert(fine.projection.outlook === "comfortable", "plenty is comfortable");

const noPay = planOverview({ ...input, streams: input.streams.map((s) => ({ ...s, nextPayday: null, payDay: null })) }, now);
assert(noPay.payday === null && noPay.needsPayday, "monthly income without a pay day asks for one");
assert(noPay.beforePayday.length === 3, "without payday, everything unpaid this month is upcoming");
assert(mainStream(input.streams)?.id === "sal", "biggest monthly income is the one to set a payday on");
assert(planOverview({ ...input, streams: [] }, now).hasIncome === false, "no income at all");

console.log("plan-overview: payday, bills, projection, outlook, tiles");

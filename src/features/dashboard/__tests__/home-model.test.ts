import { availableBalance, budgetSummary, categorySpend, greeting, groupRecent, initialsFromEmail, monthlyFlow, weekSpend } from "@/features/dashboard/services/home-model";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(greeting(new Date(2026, 9, 20, 8)) === "Good morning", "morning greeting");
assert(greeting(new Date(2026, 9, 20, 14)) === "Good afternoon", "afternoon greeting");
assert(greeting(new Date(2026, 9, 20, 20)) === "Good evening", "evening greeting");
assert(initialsFromEmail("ayo.bami@example.com") === "AY", "initials from the email");
assert(initialsFromEmail(undefined) === "?", "no email gives a placeholder");

const balance = availableBalance([
  { id: "a", name: "GTBank", kind: "bank", balance: "14000.00" },
  { id: "b", name: "Cash", kind: "cash", balance: "2500.50" },
  { id: "c", name: "Car loan", kind: "loan", balance: "-900000.00" },
  { id: "d", name: "Old", kind: "bank", balance: "100.00", archived: true },
]);
assert(balance.total === 16500.5, "available balance counts live cash, bank and wallet only");
assert(balance.count === 2, "two live accounts");

const now = new Date("2026-10-20T09:00:00Z");
assert(budgetSummary([], now) === null, "no budgets gives no summary");
const summary = budgetSummary(
  [
    {
      planned: "100000.00",
      spent: "6000.00",
      periodTo: "2026-10-31T23:59:59.999Z",
      lines: [
        { name: "Food", spent: "1000.00" },
        { name: "Transport", spent: "5000.00" },
        { name: "Rent", spent: "0.00" },
      ],
    },
  ],
  now,
);
assert(summary?.remaining === 94000, "remaining is planned minus spent");
assert(summary?.daysLeft === 12, "days left to period end, rounded up");
assert(summary?.split.length === 2 && summary.split[0].name === "Transport", "split drops zero lines, largest first");

const groups = groupRecent(
  [
    { row: { id: "1", type: "expense", description: "Food", amount: "1000.00", occurredAt: new Date(2026, 9, 20, 14, 14).toISOString() }, account: "GTBank" },
    { row: { id: "2", type: "income", description: "Salary", amount: "20000.00", occurredAt: new Date(2026, 9, 19, 18, 2).toISOString() }, account: "GTBank" },
    { row: { id: "3", type: "expense", description: "Transport", amount: "5000.00", occurredAt: new Date(2026, 9, 20, 8, 40).toISOString() }, account: "GTBank" },
    { row: { id: "4", type: "transfer", description: "To cash", amount: "500.00", occurredAt: new Date(2026, 9, 20, 7, 0).toISOString() }, account: "GTBank" },
  ],
  new Date(2026, 9, 20, 15),
);
assert(groups.length === 2, "two days");
assert(groups[0].label === "Today" && groups[1].label === "Yesterday", "today first, then yesterday");
assert(groups[0].net === -6000, "transfers don't count toward the day's net");
assert(groups[0].items[0].id === "1" && groups[0].items[0].time === "2:14 pm", "newest first with a clock time");
assert(groups[1].net === 20000, "income day nets positive");

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const ledger = [
  { id: "a", type: "expense", amount: "1000.00", occurredAt: at(20), categoryId: "c-food", description: "Lunch" },
  { id: "b", type: "expense", amount: "5000.00", occurredAt: at(18), description: "Transport" },
  { id: "c", type: "expense", amount: "300.00", occurredAt: at(13), categoryId: "c-food" },
  { id: "d", type: "income", amount: "20000.00", occurredAt: at(19) },
  { id: "e", type: "expense", amount: "9999.00", occurredAt: at(20), status: "pending" },
  { id: "f", type: "transfer", amount: "500.00", occurredAt: at(20) },
  { id: "g", type: "expense", amount: "700.00", occurredAt: new Date(2026, 8, 3).toISOString() },
];
const today = new Date(2026, 9, 20, 15);
const week = weekSpend(ledger, today);
assert(week.days.length === 7 && week.days[6].label === "Today", "seven days ending today");
assert(week.days[6].value === 1000, "pending and transfers don't count");
assert(week.total === 6000 && week.previous === 300, "this week vs last week");
assert(week.days[6].compare === 300, "compare lines up the same weekday");

const cats = categorySpend(ledger, { "c-food": "Food & groceries" }, today);
assert(cats[0].label === "Transport" && cats[0].value === 5000, "largest category first, description as fallback");
assert(cats[1].label === "Food & groceries" && cats[1].count === 2, "category names come from the id map");
assert(!cats.some((c) => c.value === 700), "last month's spending is left out");

const flow = monthlyFlow(ledger, today, 3);
assert(flow.labels.join(",") === "Aug,Sep,Oct", "three months, oldest first");
assert(flow.expense[2] === 6300 && flow.income[2] === 20000, "this month's flow");
assert(flow.expense[1] === 700, "last month's flow");

console.log("home-model: greeting, balance, budget summary, recent groups, charts");

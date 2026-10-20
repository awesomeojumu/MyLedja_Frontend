import {
  calendarMonth,
  defaultCalendarDay,
  feedCounts,
  groupByDay,
  inMonth,
  matchesFilter,
  matchesSearch,
  monthIndex,
  monthLabel,
  monthSummary,
  needsCategory,
  onDay,
  tableRows,
} from "@/features/transactions/services/tx-feed";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute).toISOString();
const rows = [
  { id: "1", type: "expense", amount: "5000.00", accountId: "gt", categoryId: "c-tr", description: "Transport", occurredAt: at(9, 18, 22, 51) },
  { id: "2", type: "expense", amount: "1000.00", accountId: "gt", description: "Food", occurredAt: at(9, 19, 9, 44) },
  { id: "3", type: "income", amount: "20000.00", accountId: "gt", categoryId: "c-side", description: "Freelance payment", occurredAt: at(9, 20, 16, 10), status: "pending" },
  { id: "4", type: "transfer", amount: "500.00", accountId: "gt", description: "To cash", occurredAt: at(9, 20, 8) },
  { id: "5", type: "expense", amount: "700.00", accountId: "gt", categoryId: "c-tr", occurredAt: at(8, 3) },
];
const cats = { "c-tr": "Transport", "c-side": "Side hustle" };
const accounts = { gt: "GTBank" };
const now = new Date(2026, 9, 20, 18);
const october = monthIndex(now);

assert(monthLabel(october) === "October 2026", "month label");
assert(monthLabel(october - 10) === "December 2025", "month label across a year");
assert(inMonth(rows, october).length === 4, "September row left out of October");

const summary = monthSummary(rows, october, cats, now);
assert(summary.spent === 6000, "spent counts expenses only");
assert(summary.income === 0, "pending income is not counted yet");
assert(summary.net === -6000, "net is income minus spent");
assert(summary.dailyAverage === 300, "daily average over the 20 days so far");
assert(summary.split[0].name === "Transport" && summary.split[0].share === 83, "biggest category first with its share");
assert(summary.split[1].name === "Uncategorised", "uncategorised spend is named");
assert(monthSummary(rows, october - 1, cats, now).dailyAverage === 700 / 30, "past month averages over all its days");

assert(needsCategory(rows[1]) && !needsCategory(rows[3]) && !needsCategory(rows[0]), "only expenses and income need categories");
const oct = inMonth(rows, october);
const c = feedCounts(oct);
assert(c.all === 4 && c.expense === 2 && c.income === 1 && c.transfer === 1 && c.uncategorised === 1, "filter counts");
assert(oct.filter((r) => matchesFilter(r, "uncategorised")).length === 1, "uncategorised filter");

assert(matchesSearch(rows[0], "trans", cats, accounts), "matches description");
assert(matchesSearch(rows[1], "gtbank", cats, accounts), "matches account");
assert(matchesSearch(rows[0], "₦5,000", cats, accounts), "matches a typed amount");
assert(!matchesSearch(rows[1], "5000", cats, accounts), "amount search is exact on digits");
assert(matchesSearch(rows[2], "side", cats, accounts), "matches category name");

const days = groupByDay(oct, cats, accounts, now);
assert(days.map((d) => d.label).join("|") === "Today|Yesterday · Mon 19 Oct|Sun 18 Oct", "newest day first with friendly labels");
assert(days[0].items[0].id === "3", "newest row first within a day");
assert(days[0].net === 0, "pending income and transfers don't move the day's net");
assert(days[1].net === -1000 && days[1].items[0].needsCategory === true, "uncategorised row flagged");
assert(days[2].items[0].category === "Transport" && days[2].items[0].time === "10:51 pm", "category and time on the row");
assert(days[0].items[0].pending === true, "pending row flagged");

console.log("tx-feed: month, summary, filters, search, day groups");

const cal = calendarMonth(rows, october, "monday", now);
assert(cal.days.length === 31, "October has 31 days");
assert(cal.lead === 3, "1 Oct 2026 is a Thursday, so three blanks before it with Monday first");
assert(calendarMonth(rows, october, "sunday", now).lead === 4, "four blanks with Sunday first");
assert(cal.spent === 6000 && cal.activeDays === 3 && cal.daysSoFar === 20, "month stats");
assert(cal.biggest?.day === 18, "biggest spending day");
assert(cal.days[17].level === 4 && cal.days[18].level === 1, "heat levels relative to the biggest day");
assert(cal.days[19].today && !cal.days[19].future && cal.days[20].future, "today and future flags");
assert(cal.days[19].count === 1, "pending rows don't count toward the calendar");
assert(defaultCalendarDay(cal) === "2026-10-20", "opens on today when today has activity");
const quiet = calendarMonth(rows.filter((r) => r.id !== "4"), october, "monday", now);
assert(defaultCalendarDay(quiet) === "2026-10-19", "otherwise the latest active day");
assert(onDay(rows, "2026-10-18").length === 1, "rows for one day");
console.log("tx-feed: calendar");

const byDate = tableRows(days, { key: "date", dir: "desc" });
assert(byDate.map((r) => r.id).join(",") === "3,4,2,1", "date sort keeps newest first");
assert(byDate[0].dayNet === 0 && byDate[1].dayNet === undefined && byDate[2].dayNet === -1000, "day net only on each day's first row");
assert(tableRows(days, { key: "date", dir: "asc" }).map((r) => r.id).join(",") === "1,2,4,3", "oldest first reverses days and rows");
assert(tableRows(days, { key: "amount", dir: "desc" }).map((r) => r.id).join(",") === "3,1,2,4", "largest amount first");
assert(tableRows(days, { key: "title", dir: "asc" })[0].title === "Food", "name sort A to Z");
assert(tableRows(days, { key: "amount", dir: "desc" })[0].day === "Today", "flat rows keep their day label");
console.log("tx-feed: table sort");

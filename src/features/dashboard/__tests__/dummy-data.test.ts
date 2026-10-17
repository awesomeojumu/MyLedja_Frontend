import { formatMoney } from "@/design/format";
import {
  CASH_FLOW,
  DASHBOARD_GOALS,
  DASHBOARD_INSIGHTS,
  HOME_DUMMY,
  NET_WORTH,
  QUICK_ADD_TILES,
  UPCOMING,
  cashFlowForPeriod,
  searchDashboard,
} from "@/features/dashboard/dummy-data";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(HOME_DUMMY.currency === "NGN", "Home dummy data is naira");
assert(HOME_DUMMY.balance > 0, "Hero balance is a positive naira amount");
assert(HOME_DUMMY.spent > 0, "Spent this month is present");
assert(HOME_DUMMY.income > 0, "Income this month is present");
assert(HOME_DUMMY.budgets.length >= 2, "At least two budget tiles");
assert(HOME_DUMMY.recent.length >= 3, "At least three recent rows");
assert(
  formatMoney(HOME_DUMMY.balance, HOME_DUMMY.currency).startsWith("₦"),
  "Formatted hero balance uses the naira sign",
);
assert(
  HOME_DUMMY.recent.every((row) => row.amount > 0),
  "Recent rows carry dummy naira amounts",
);

assert(CASH_FLOW.currency === "NGN", "Cash flow is naira");
assert(CASH_FLOW.months.length >= 3, "Cash flow has at least three months");
assert(
  CASH_FLOW.months.every((row) => row.inflow > 0 && row.outflow > 0),
  "Each cash-flow month has in and out",
);
const three = cashFlowForPeriod("3-months");
assert(three.labels.length >= 3, "3-month cash flow has labels");
assert(three.inflow.length === three.labels.length, "In series matches labels");
assert(three.outflow.length === three.labels.length, "Out series matches labels");

assert(NET_WORTH.total > 0, "Net worth is a positive naira amount");
assert(NET_WORTH.assets.length >= 2, "At least two assets");
assert(NET_WORTH.liabilities.length >= 1, "At least one liability");
assert(NET_WORTH.history.length >= 3, "Net worth history has points");
assert(
  Math.abs(NET_WORTH.assets.reduce((s, a) => s + a.amount, 0) - NET_WORTH.liabilities.reduce((s, a) => s + a.amount, 0) - NET_WORTH.total) < 1,
  "Assets minus liabilities equal net worth",
);

assert(UPCOMING.length >= 3, "At least three upcoming items");
assert(
  UPCOMING.every((item) => item.amount > 0 && item.title.length > 0 && item.when.length > 0),
  "Upcoming rows have title, when, and naira amount",
);

assert(DASHBOARD_GOALS.length >= 3, "At least three goals");
assert(
  DASHBOARD_GOALS.every((goal) => goal.saved >= 0 && goal.target > 0 && goal.saved / goal.target <= 1.05),
  "Goal progress is a 0–1 ratio (allow tiny over)",
);

assert(DASHBOARD_INSIGHTS.length >= 3, "At least three insights");
assert(
  DASHBOARD_INSIGHTS.every((item) => item.title.length > 0 && item.body.length > 0),
  "Insights have title and body",
);

assert(QUICK_ADD_TILES.length === 4, "Quick add is a 2x2");

const empty = searchDashboard("");
assert(empty.length >= 3, "Empty search shows recent items");
const shoprite = searchDashboard("shoprite");
assert(
  shoprite.some((hit) => hit.title.toLowerCase().includes("shoprite")),
  "Search matches a known Shoprite row",
);
assert(searchDashboard("zzzz-no-match").length === 0, "Unknown query returns nothing");

console.log("dashboard dummy data: naira home, cash flow, net worth, upcoming, goals, insights, search");

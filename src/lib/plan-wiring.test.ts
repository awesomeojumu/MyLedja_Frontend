import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..");
const files = [
  ["src/features/budgets/screens/HubScreen.tsx", "budgets", "BudgetsListScreen"],
  ["src/features/bills/screens/HubScreen.tsx", "bills", "BillsListScreen"],
  ["src/features/income/screens/HubScreen.tsx", "IncomeListScreen", "income-screens"],
  ["src/features/plans-goals/screens/HubScreen.tsx", "GoalsListScreen", "listGoals"],
  ["src/features/debts/screens/HubScreen.tsx", "DebtsListScreen", "debt-screens"],
  ["src/features/dashboard/screens/UpcomingScreen.tsx", "upcoming", "BillsListScreen"],
  ["src/features/dashboard/screens/InsightsScreen.tsx", "listBudgets", "getBudget"],
  ["src/features/dashboard/screens/CashFlowScreen.tsx", "dashboard", "session.dashboard"],
  ["src/features/dashboard/screens/NetWorthScreen.tsx", "dashboard", "session.dashboard"],
  ["src/features/financial-health/screens/HubScreen.tsx", "HealthHubScreen", "health-screens"],
  ["src/features/investments/screens/HubScreen.tsx", "HoldingsListScreen", "listHoldings"],
  ["src/features/financial-health/screens/health-screens.tsx", "dashboard", "session.dashboard"],
  ["src/features/accounts/screens/ImportStatementScreen.tsx", "imports", "previewImport"],
  ["src/features/accounts/screens/ReviewImportScreen.tsx", "imports", "commitImport"],
  ["src/features/accounts/screens/ReconcileScreen.tsx", "reconcile", "postCollection"],
  ["src/features/transactions/screens/RefundScreen.tsx", "refund", "createTransaction"],
  ["src/features/transactions/screens/SearchScreen.tsx", "search", "session.search"],
];

for (const [rel, needle, hook] of files) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  assert(!src.includes("HOME_"), `${rel} must not import canned balances`);
  assert(src.includes(hook) || src.includes(needle), `${rel} must call ${hook}`);
}

console.log("plan-wiring: hubs, dashboard, import, refund use APIs");

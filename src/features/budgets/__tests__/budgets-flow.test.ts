import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/budgets/screens/budget-screens.tsx"), "utf8");
assert(!src.includes("PlanModuleScreen"), "budgets must not clone PlanModuleScreen");
for (const needle of [
  "Select",
  "toDecimal",
  "listBudgets",
  "Add budget",
  "Add line",
  "Remove line",
  "Overspent",
  "periodFrom",
  "Browse categories",
  "createBudget",
  "lines",
  "getBudget",
  "patchBudget",
  "Wait for salary or add income",
  "Budget remaining",
  "No posted spend on these categories yet",
  "TransactionRow",
  "Needs money",
  "Funding accounts",
  "accounts/${account.id}",
  "income-streams",
  "Budget insights",
]) {
  assert(src.includes(needle), `budgets must include ${needle}`);
}
assert(existsSync(join(root, "src/features/budgets/screens/HubScreen.tsx")), "hub");
console.log("budgets-flow: 048-057 wired");

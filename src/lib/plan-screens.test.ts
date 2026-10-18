import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_SCREENS, SCREEN_TITLES, featureForScreen } from "@/lib/screen-catalog";
import { budgetViewKeys, planScreenSpec } from "@/lib/plan-screen-role";
import { planName } from "@/lib/money-map";
import { liveKind } from "@/lib/live-states";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const live = [
  ...FEATURE_SCREENS.budgets,
  ...FEATURE_SCREENS.bills,
  ...FEATURE_SCREENS["plans-goals"],
  ...FEATURE_SCREENS.income,
  ...FEATURE_SCREENS.debts,
];
const gated = [...FEATURE_SCREENS.savings, ...FEATURE_SCREENS.investments, ...FEATURE_SCREENS.taxes];
const root = join(__dirname, "..", "..");

for (const id of [...live, ...gated]) {
  assert(Boolean(SCREEN_TITLES[id]?.trim()), `P0 missing title ${id}`);
  const feature = featureForScreen(id);
  assert(Boolean(feature), `unmapped ${id}`);
  const file = join(root, "src", "features", feature as string, "screens", `screen-${id}.tsx`);
  assert(existsSync(file), `missing ${file}`);
  const source = readFileSync(pathSafe(file), "utf8");
  assert(!source.includes("ScreenPlaceholder"), `${id} is still a placeholder`);
  if (gated.includes(id)) {
    assert(source.includes("GatedScreen") || source.includes("Not available yet"), `${id} must be gated`);
  } else {
    const spec = planScreenSpec(id, SCREEN_TITLES[id]);
    assert(spec != null, `${id} has a plan role`);
  }
}

assert(budgetViewKeys().join(",") === "day,week,month,year", "budget detail has four views");
const row = { id: "01a14d5e-77ce-750e-a2ad-d3fe6a9cbbf2", accountId: "acc-1", primaryPeriod: "month", amount: "5000.00" };
assert(planName(row, { "acc-1": "GTBank Salary" }) === "GTBank Salary · monthly budget", "budget label is the account");
assert(liveKind({ known: false, offline: false, error: null, rows: 0 }) !== "empty", "loading is not the empty title");
assert(planScreenSpec("049", "Budget")?.role === "detail", "049 is the budget detail");
assert(planScreenSpec("048", "Budgets")?.role === "list", "048 is the list");

console.log("plan-screens: 048-109 and 150-151 titled with roles and views");

function pathSafe(file: string): string {
  return file;
}

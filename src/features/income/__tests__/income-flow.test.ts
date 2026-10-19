import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/income/screens/income-screens.tsx"), "utf8");
assert(!src.includes("PlanModuleScreen"), "income must not clone PlanModuleScreen");
assert(!src.includes("FeatureScreen"), "income must not clone FeatureScreen");
assert(!src.includes("CategoryList"), "077 is not CategoryList");
assert(!src.includes("AddExpense"), "077 is not txn 031");

const perId: [string, string[]][] = [
  ["075", ["listIncomeStreams", "Add income stream", "income-detail?id="]],
  ["076", ["getIncomeStream", "income-edit", "income-tax", "income-match", "income-expected"]],
  ["077", ["createIncomeStream", "Save stream", "taxClass", "income-detail?id="]],
  ["078", ["patchIncomeStream", "Save changes"]],
  ["079", ["incomeStreamPeriod", "Expected vs received", "Not in yet", "Match income"]],
  ["080", ["matchIncome", "Already matched", "Amount does not match", "unmatched"]],
  ["081", ["Tax class", "Not now", "Used later for tax"]],
];

for (const [id, needles] of perId) {
  for (const needle of needles) {
    assert(src.includes(needle), `${id} must include ${needle}`);
  }
}

const screens = ["075", "076", "077", "078", "079", "080", "081"];
for (const id of screens) {
  const file = join(root, "src/features/income/screens", `screen-${id}.tsx`);
  assert(existsSync(file), `missing screen-${id}`);
  const body = readFileSync(file, "utf8");
  assert(body.includes("income-screens"), `${id} wires the live module`);
}

assert(existsSync(join(root, "app/(tabs)/plan/income.tsx")), "075 route");
assert(existsSync(join(root, "app/(tabs)/plan/income-add.tsx")), "077 route");
assert(existsSync(join(root, "app/(tabs)/plan/income-detail.tsx")), "076 route");

console.log("income-flow: 075-081 wired");

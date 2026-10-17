import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_SCREENS, SCREEN_TITLES, featureForScreen } from "@/lib/screen-catalog";

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
  const source = readFileSync(file, "utf8");
  assert(!source.includes("ScreenPlaceholder"), `${id} is still a placeholder`);
  if (gated.includes(id)) {
    assert(source.includes("GatedScreen") || source.includes("Not available yet"), `${id} must be gated`);
  }
}

console.log("plan-screens: 048-109 and 150-151 titled");

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_SCREENS, SCREEN_TITLES, featureForScreen } from "./screen-catalog";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ids = [...FEATURE_SCREENS.accounts, ...FEATURE_SCREENS.transactions, ...FEATURE_SCREENS["categories-merchants"]];
assert(ids.length === 35, `MYL-008 covers 35 screens, got ${ids.length}`);

const root = join(__dirname, "..", "..");

for (const id of ids) {
  assert(Boolean(SCREEN_TITLES[id]), `Missing title for ${id}`);
  const feature = featureForScreen(id);
  assert(Boolean(feature), `Unmapped ${id}`);
  const file = join(root, "src", "features", feature as string, "screens", `screen-${id}.tsx`);
  assert(existsSync(file), `Missing ${file}`);
  const source = readFileSync(file, "utf8");
  assert(!source.includes("ScreenPlaceholder"), `${id} is still a placeholder`);
}

console.log("myl-008: 35 screens titled and not placeholders");

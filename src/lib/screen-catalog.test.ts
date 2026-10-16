import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  allScreenIds,
  FEATURE_FOLDERS,
  FEATURE_SCREENS,
  featureForScreen,
  NESTED_ROUTES,
  SCREEN_TITLES,
} from "./screen-catalog";

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const ids = allScreenIds();
assertEqual(FEATURE_FOLDERS.length, 17);
assertEqual(ids.length, 154);
assertEqual(new Set(ids).size, 154);
assertEqual(ids[0], "001");
if (!ids.includes("154")) throw new Error("missing screen 154");
assertEqual(featureForScreen("154"), "financial-health");
assertEqual(featureForScreen("001"), "auth-onboarding");
assertEqual(SCREEN_TITLES["001"], "Welcome");
assertEqual(SCREEN_TITLES["002"], "Create account");
assertEqual(SCREEN_TITLES["003"], "Verify identity");
assertEqual(SCREEN_TITLES["004"], "Sign in");
assertEqual(SCREEN_TITLES["005"], "Start recovery");
assertEqual(SCREEN_TITLES["006"], "Recovery and reset");
assertEqual(SCREEN_TITLES["007"], "Terms and privacy");
assertEqual(SCREEN_TITLES["008"], "Initial preferences");
assertEqual(SCREEN_TITLES["009"], "Create workspace");
assertEqual(SCREEN_TITLES["010"], "Setup checklist");
assertEqual(SCREEN_TITLES["141"], "Splash");
assertEqual(SCREEN_TITLES["142"], "Multi-factor challenge");
assertEqual(SCREEN_TITLES["143"], "Passkey");
assertEqual(SCREEN_TITLES["012"], "Cash flow");
assertEqual(SCREEN_TITLES["013"], "Net worth");
assertEqual(SCREEN_TITLES["014"], "Upcoming");
assertEqual(SCREEN_TITLES["015"], "Goals");
assertEqual(SCREEN_TITLES["016"], "Insights");
assertEqual(SCREEN_TITLES["017"], "Quick add");
assertEqual(SCREEN_TITLES["145"], "Global search");
assertEqual(SCREEN_TITLES["018"], "Account list");
assertEqual(SCREEN_TITLES["020"], "Add account");
assertEqual(SCREEN_TITLES["024"], "Create transfer");
assertEqual(SCREEN_TITLES["146"], "Select financial institution");
assertEqual(SCREEN_TITLES["149"], "Review imported statement");
assertEqual(SCREEN_TITLES["028"], "Transaction feed");
assertEqual(SCREEN_TITLES["030"], "Add expense");
assertEqual(SCREEN_TITLES["041"], "Pending and failed sync queue");
assertEqual(SCREEN_TITLES["042"], "Categories");
assertEqual(SCREEN_TITLES["046"], "Merchants");
assertEqual(SCREEN_TITLES["047"], "Merchant");
assertEqual(featureForScreen("012"), "dashboard");
assertEqual(featureForScreen("145"), "dashboard");
assertEqual(featureForScreen("141"), "auth-onboarding");
assertEqual(featureForScreen("143"), "auth-onboarding");
assertEqual(featureForScreen("152"), "transactions");
assertEqual(SCREEN_TITLES["152"], "Receipt");
assertEqual(SCREEN_TITLES["039"], "Refund or reversal");
assertEqual(FEATURE_SCREENS.bills.length, 10);
assertEqual(FEATURE_SCREENS["settings-privacy"].length, 17);

const root = join(__dirname, "..", "..");
for (const id of ids) {
  const feature = featureForScreen(id);
  if (!feature) throw new Error(`unmapped screen ${id}`);
  const file = join(root, "src", "features", feature, "screens", `screen-${id}.tsx`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
}

for (const route of NESTED_ROUTES) {
  if (!existsSync(join(root, route))) throw new Error(`missing ${route}`);
}

console.log("screens: 154 IDs map onto 17 folders and nested tab routes exist");

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_FOLDERS, FEATURE_SCREENS } from "@/lib/screen-catalog";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..");
const gated = new Set([...FEATURE_SCREENS.savings, ...FEATURE_SCREENS.investments, ...FEATURE_SCREENS.taxes]);

for (const folder of FEATURE_FOLDERS) {
  for (const id of FEATURE_SCREENS[folder]) {
    const file = join(root, "src", "features", folder, "screens", `screen-${id}.tsx`);
    assert(existsSync(file), `missing screen ${id}`);
    const src = readFileSync(file, "utf8");
    assert(!/HOME_/.test(src), `${id} must not use canned home balances`);
    if (gated.has(id)) {
      assert(src.includes("GatedScreen"), `${id} must stay gated`);
    } else {
      assert(!src.includes("ScreenPlaceholder"), `${id} must not be a placeholder`);
    }
  }
}

console.log("page-ready: catalog screens exist; gated stay gated; no canned home balances");

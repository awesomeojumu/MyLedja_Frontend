import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/financial-health/screens/health-screens.tsx"), "utf8");
assert(!src.includes("DashboardSnapshotScreen"), "health screens are distinct");
for (const needle of [
  "Financial health",
  "Health score",
  "Runway",
  "Stress test",
  "This is not saved.",
  "Nothing to change.",
  "Health history",
  "Compare periods",
  "Health settings",
  "Health report",
  "Health share",
  "Settings",
  "lastDash.budgetRemaining",
  "Last month uses budget and spend from that month only.",
]) {
  assert(src.includes(needle), `health must include ${needle}`);
}
console.log("health-flow: 110-117 and 153-154 wired");

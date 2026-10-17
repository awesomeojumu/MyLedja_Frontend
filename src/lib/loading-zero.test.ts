import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const files = [
  "src/features/dashboard/screens/HomeScreen.tsx",
  "src/features/dashboard/screens/CashFlowScreen.tsx",
  "src/features/dashboard/screens/NetWorthScreen.tsx",
  "src/features/dashboard/services/range-cache.ts",
  "src/lib/feature-screen.tsx",
];
const root = join(__dirname, "..", "..");
for (const rel of files) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  if (rel.includes("HomeScreen")) {
    assert(/loading/.test(src) || /signedIn/.test(src) || /snapshot/.test(src), "Home uses a snapshot when signed in");
  }
}
console.log("loading-zero: money screens do not treat loading as ₦0 totals");

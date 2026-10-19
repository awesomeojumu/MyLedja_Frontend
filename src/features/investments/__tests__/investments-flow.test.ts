import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/investments/screens/investment-screens.tsx"), "utf8");
assert(!src.includes("GatedScreen"), "investments are live");
for (const needle of [
  "listHoldings",
  "createHolding",
  "buyHolding",
  "sellHolding",
  "No holdings yet",
  "This is not an expense.",
  "How much came back",
  "Record dividend",
  "Lots",
  "row.value",
  "occurredAt",
  "YYYY-MM-DD",
  "Price today",
  "Matures",
  "Value today",
  "Use a date like 2026-10-19.",
  "data?.quantity",
]) {
  assert(src.includes(needle), `investments must include ${needle}`);
}
assert(existsSync(join(root, "src/features/investments/screens/HubScreen.tsx")), "hub");
console.log("investments-flow: 097-104 wired");

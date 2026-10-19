import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/bills/screens/bill-screens.tsx"), "utf8");
assert(!src.includes("PlanModuleScreen"), "bills must not clone PlanModuleScreen");
for (const needle of [
  "listBills",
  "Add bill",
  "createBill",
  "cadence",
  "getBill",
  "Mark paid",
  "patchBill",
  "Save schedule",
  "markBillPaid",
  "Nothing due in the next 14 days",
  "No missed bills",
  "billReminderContent",
  "Bill calendar",
]) {
  assert(src.includes(needle), `bills must include ${needle}`);
}
assert(existsSync(join(root, "src/features/bills/screens/HubScreen.tsx")), "hub");
console.log("bills-flow: 058-066 and 150 wired");

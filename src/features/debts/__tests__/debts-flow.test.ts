import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");
const src = readFileSync(join(root, "src/features/debts/screens/debt-screens.tsx"), "utf8");
assert(!src.includes("PlanModuleScreen"), "debts must not clone PlanModuleScreen");
assert(!src.includes("FeatureScreen"), "debts must not clone FeatureScreen");
for (const needle of [
  "listDebts",
  "I owe someone",
  "Someone owes me",
  "createDebt",
  "Say who you owe",
  "getDebt",
  "debtMove",
  "borrow",
  "repay",
  "lend",
  "collect",
  "Save schedule",
  "patchDebt",
]) {
  assert(src.includes(needle), `debts must include ${needle}`);
}
const add = readFileSync(join(root, "src/features/transactions/screens/AddExpenseScreen.tsx"), "utf8");
assert(add.includes("Loan repayments"), "expense repayment category");
assert(add.includes("Repayment received"), "income collect category");
assert(add.includes("debtMove"), "transaction who calls debtMove");
assert(add.includes("Add who you owe first"), "empty I-owe list");
assert(add.includes("Add who owes you first"), "empty owed-to-me list");
console.log("debts-flow: 082-089 151 and transaction who wired");

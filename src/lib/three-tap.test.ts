import { readFileSync } from "node:fs";
import { join } from "node:path";
import { descriptionFor, draftIssues, quickExpenseDraft } from "@/features/transactions/services/add-draft";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}

const layout = readFileSync(join(__dirname, "..", "..", "app", "(tabs)", "_layout.tsx"), "utf8");
assert(layout.includes(`onAdd={() => openSheet("expense")}`), "phone + opens the expense sheet (tap 1)");
assert(layout.includes("AddTransactionSheet"), "save is the sheet, not a fourth route");

const sheet = readFileSync(join(__dirname, "..", "features", "transactions", "components", "AddTransactionSheet.tsx"), "utf8");
assert(sheet.includes("commitAdd"), "save goes through commitAdd");
assert(sheet.includes("descriptionFor") || readFileSync(join(__dirname, "..", "features", "transactions", "services", "commit-add.ts"), "utf8").includes("descriptionFor"), "blank description uses the category");

const draft = { ...quickExpenseDraft(), amount: "1500" };
assertEqual(draftIssues(draft).length, 0);
assertEqual(descriptionFor(draft), draft.category);
assertEqual(descriptionFor({ ...draft, kind: "income", category: "Salary", description: "" }), "Salary");

console.log("three-tap: +, amount, Save uses the category as the description");

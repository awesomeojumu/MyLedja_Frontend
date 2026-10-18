import { descriptionFor, draftIssues, quickExpenseDraft, savedMessage, saveLabel, type AddDraft } from "@/features/transactions/services/add-draft";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

const ready: AddDraft = {
  kind: "expense",
  description: "Jollof rice",
  amount: "4500.00",
  category: "Eating out",
  account: "Cash",
  date: "2026-10-15",
};

assertEqual(draftIssues(ready).length, 0);
assertEqual(saveLabel("expense"), "Save expense");
assertEqual(saveLabel("income"), "Save income");
assertEqual(saveLabel("transfer"), "Save transfer");
assertEqual(savedMessage("expense"), "Expense saved");

const blank = draftIssues({ ...ready, description: "  ", amount: "", category: "" });
assert(!blank.some((issue) => issue.field === "description"), "A blank description is allowed");
assert(blank.some((issue) => issue.field === "amount"), "A blank amount is rejected");
assert(blank.some((issue) => issue.field === "category"), "A blank category is rejected");

const transfer = draftIssues({ ...ready, kind: "transfer", category: "", amount: "1000" });
assertEqual(transfer.length, 0);

const mismatch = draftIssues({ ...ready, category: "Salary" });
assert(mismatch.some((issue) => issue.field === "category"), "Salary is not an expense category");

const zero = draftIssues({ ...ready, amount: "0" });
assert(zero.some((issue) => issue.field === "amount"), "Zero is not an amount");

const tapDraft = quickExpenseDraft();
assertEqual(tapDraft.kind, "expense");
assertEqual(tapDraft.description, "");
assertEqual(draftIssues({ ...tapDraft, amount: "1500" }).length, 0);
assertEqual(descriptionFor({ ...tapDraft, amount: "1500" }), tapDraft.category);
assertEqual(descriptionFor({ ...tapDraft, description: "  Shoprite " }), "Shoprite");
assertEqual(descriptionFor({ ...tapDraft, kind: "transfer", category: "" }), "Transfer");

console.log("add-draft: amount and category required; blank description falls back to the category (3 taps)");

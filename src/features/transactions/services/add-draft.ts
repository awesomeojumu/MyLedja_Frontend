import { EXPENSE_CATEGORIES, toKobo } from "../../../design/format";

export type EntryKind = "expense" | "income" | "transfer";

export interface AddDraft {
  kind: EntryKind;
  description: string;
  amount: string;
  category: string;
  account: string;
  date: string;
}

export interface DraftIssue {
  field: "description" | "amount" | "category";
  message: string;
}

export function draftIssues(draft: AddDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!draft.description.trim()) {
    issues.push({ field: "description", message: "Say what this was for." });
  }
  if (toKobo(draft.amount) <= 0) {
    issues.push({ field: "amount", message: "Enter an amount." });
  }
  if (draft.kind !== "transfer" && !draft.category.trim()) {
    issues.push({ field: "category", message: "Choose a category." });
  }
  return issues;
}

export function quickExpenseDraft(): AddDraft {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    kind: "expense",
    description: "Expense",
    amount: "",
    category: EXPENSE_CATEGORIES[0],
    account: "Cash",
    date: `${now.getFullYear()}-${month}-${day}`,
  };
}

export function saveLabel(kind: EntryKind): string {
  if (kind === "income") return "Save income";
  if (kind === "transfer") return "Save transfer";
  return "Save expense";
}

export function savedMessage(kind: EntryKind): string {
  if (kind === "income") return "Income saved";
  if (kind === "transfer") return "Transfer saved";
  return "Expense saved";
}

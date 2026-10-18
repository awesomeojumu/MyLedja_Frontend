import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, toKobo } from "@/design/format";

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

/**
 * The description is optional so quick add stays three taps (+, amount, Save). A blank one falls back to the
 * category, or "Transfer" for a transfer, so every record still reads clearly in lists.
 */
export function descriptionFor(draft: AddDraft): string {
  const typed = draft.description.trim();
  if (typed) return typed;
  if (draft.kind === "transfer") return "Transfer";
  return draft.category.trim() || (draft.kind === "income" ? "Income" : "Expense");
}

export function draftIssues(draft: AddDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (toKobo(draft.amount) <= 0) {
    issues.push({ field: "amount", message: "Enter an amount." });
  }
  if (draft.kind !== "transfer" && !draft.category.trim()) {
    issues.push({ field: "category", message: "Choose a category." });
  }
  if (draft.kind === "expense" && INCOME_CATEGORIES.includes(draft.category)) {
    issues.push({ field: "category", message: "An expense cannot use an income category." });
  }
  if (draft.kind === "income" && EXPENSE_CATEGORIES.includes(draft.category)) {
    issues.push({ field: "category", message: "Income cannot use an expense category." });
  }
  return issues;
}

export function quickExpenseDraft(): AddDraft {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    kind: "expense",
    description: "",
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

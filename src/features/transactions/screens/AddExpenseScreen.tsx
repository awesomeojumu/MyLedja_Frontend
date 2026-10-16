import { useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Button, CategoryPicker, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TextField, Toast } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { draftIssues, quickExpenseDraft, savedMessage, type DraftIssue } from "../services/add-draft";

export function AddExpenseScreen({ kind = "expense" }: { kind?: "expense" | "income" } = {}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => {
    const next = quickExpenseDraft();
    return kind === "income" ? { ...next, kind: "income" as const, description: "Income", category: INCOME_CATEGORIES[0] } : next;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const fieldError = (field: DraftIssue["field"]) => issues.find((issue) => issue.field === field)?.message;
  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0) return;
    setToast(savedMessage(draft.kind));
  };
  return (
    <TxScreen
      title={kind === "income" ? "Add income" : "Add expense"}
      emptyTitle="Nothing to save yet"
      errorTitle="Could not save"
      footer={<Button fullWidth onPress={save}>{kind === "income" ? "Save income" : "Save expense"}</Button>}
    >
      <TextField label="What it was for" value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} error={fieldError("description")} />
      <AmountInput label="Amount" value={draft.amount} onChange={(amount) => setDraft((current) => ({ ...current, amount }))} error={fieldError("amount")} />
      <CategoryPicker categories={kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} value={draft.category} onChange={(category) => setDraft((current) => ({ ...current, category }))} />
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </TxScreen>
  );
}

export function AddIncomeScreen() {
  return <AddExpenseScreen kind="income" />;
}

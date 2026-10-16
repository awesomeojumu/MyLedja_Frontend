import { useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, CategoryPicker, Dialog, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TextField, Toast } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { draftIssues, quickExpenseDraft, savedMessage, type DraftIssue } from "../services/add-draft";

export function AddExpenseScreen({ kind = "expense", extras = false }: { kind?: "expense" | "income"; extras?: boolean } = {}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => {
    const next = quickExpenseDraft();
    return kind === "income" ? { ...next, kind: "income" as const, description: "Income", category: INCOME_CATEGORIES[0] } : next;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const allowed = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const mismatch = extras && !allowed.includes(draft.category);
  const fieldError = (field: DraftIssue["field"]) => issues.find((issue) => issue.field === field)?.message;
  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0) return;
    if (extras) {
      setConflict(true);
      return;
    }
    setToast(savedMessage(draft.kind));
  };
  return (
    <TxScreen
      title={extras ? "Edit transaction" : kind === "income" ? "Add income" : "Add expense"}
      emptyTitle="Nothing to save yet"
      errorTitle="Could not save"
      footer={<Button fullWidth onPress={save}>{kind === "income" ? "Save income" : extras ? "Save changes" : "Save expense"}</Button>}
    >
      <WidePane
        sidebar={
          extras ? (
            <Banner tone="warning" title="Changed on another device">
              This record was edited elsewhere. Review before you save.
            </Banner>
          ) : (
            <Banner tone="neutral" title="Saved on this phone">
              Dummy records stay here until a later sync pass.
            </Banner>
          )
        }
      >
        {mismatch ? (
          <Banner tone="danger" title="Category type mismatch">
            An expense cannot use an income category.
          </Banner>
        ) : null}
        <TextField label="What it was for" value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} error={fieldError("description")} />
        <AmountInput label="Amount" value={draft.amount} onChange={(amount) => setDraft((current) => ({ ...current, amount }))} error={fieldError("amount")} />
        <CategoryPicker categories={extras ? [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] : allowed} value={draft.category} onChange={(category) => setDraft((current) => ({ ...current, category }))} />
      </WidePane>
      <Dialog
        title="Changed on another device"
        open={conflict}
        confirmLabel="Save anyway"
        onClose={() => setConflict(false)}
        onConfirm={() => {
          setConflict(false);
          setToast(savedMessage(draft.kind));
        }}
      >
        Keep your edit or leave the other device’s version. Dummy data is not sent to a server.
      </Dialog>
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

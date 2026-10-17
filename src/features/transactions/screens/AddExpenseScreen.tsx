import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { AmountInput, Banner, Button, CategoryPicker, Dialog, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TextField, Toast } from "@/design";
import { WidePane } from "@/lib";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";
import { persistExpense, drainOnce } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { draftIssues, quickExpenseDraft, savedMessage, type DraftIssue } from "@/features/transactions/services/add-draft";

export function AddExpenseScreen({ kind = "expense", extras = false }: { kind?: "expense" | "income"; extras?: boolean } = {}) {
  const router = useRouter();
  const { session, user, workspaces } = useSession();
  const [categories, setCategories] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [draft, setDraft] = useState(() => {
    const next = quickExpenseDraft();
    return kind === "income" ? { ...next, kind: "income" as const, description: "Income", category: INCOME_CATEGORIES[0] } : next;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const remoteNames = categories.filter((row) => row.kind === kind).map((row) => row.name);
  const allowed = remoteNames.length > 0 ? remoteNames : kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const mismatch = extras && !allowed.includes(draft.category);
  const fieldError = (field: DraftIssue["field"]) => issues.find((issue) => issue.field === field)?.message;
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (!workspaceId) return;
    void session.listCategories(workspaceId).then((res) => setCategories(res.data));
    void session.listAccounts(workspaceId).then((res) => {
      const first = res.data[0] as { id?: string } | undefined;
      if (first?.id) setAccountId(first.id);
    });
  }, [session, workspaceId]);

  const postDraft = () => {
    if (!user || !workspaceId || !accountId) {
      setToast("Add an account first.");
      return;
    }
    const operationId = newId();
    const categoryId = categories.find((row) => row.name === draft.category)?.id;
    const payload = {
      type: draft.kind,
      amount: draft.amount.includes(".") ? draft.amount : `${draft.amount}.00`,
      accountId,
      categoryId,
      description: draft.description,
      status: "posted",
    };
    const store = outboxForUser(user.userId);
    persistExpense(store, {
      operationId,
      userId: user.userId,
      workspaceId,
      entityType: "transaction",
      entityId: operationId,
      operationType: "create",
      payload,
      syncStatus: "saved_on_device",
      attemptCount: 0,
    });
    setToast(savedMessage(draft.kind));
    void drainOnce(store, user.userId, async (body, opId) => {
      try {
        await session.createTransaction(workspaceId, { ...(body as object), operationId: opId });
        return true;
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 0) return false;
        throw caught;
      }
    });
  };

  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0 || mismatch) return;
    if (extras) {
      setConflict(true);
      return;
    }
    postDraft();
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
              The expense is written locally first, then sent once.
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
          postDraft();
        }}
      >
        Keep your edit or leave the other device’s version.
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

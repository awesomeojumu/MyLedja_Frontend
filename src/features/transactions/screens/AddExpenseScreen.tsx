import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AmountInput, Banner, Button, CategoryPicker, Dialog, EXPENSE_CATEGORIES, INCOME_CATEGORIES, SegmentedControl, TextField, Toast, Txt } from "@/design";
import { WidePane } from "@/lib";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import { afterMoneyWrite } from "@/lib/after-money";
import { fetchScoped, readScoped } from "@/lib/cached-fetch";
import { useSession } from "@/state";
import { outboxForUser } from "@/sync/user-outbox";
import { newId } from "@/lib/ids";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { draftIssues, quickExpenseDraft, type DraftIssue } from "@/features/transactions/services/add-draft";
import { commitAdd } from "@/features/transactions/services/commit-add";

export function AddExpenseScreen({ kind = "expense", extras = false }: { kind?: "expense" | "income"; extras?: boolean } = {}) {
  const router = useRouter();
  const { session, user, workspaces } = useSession();
  const cacheUser = user?.userId;
  const cacheWorkspace = workspaces[0]?.id;
  const [initialAccounts] = useState(() =>
    cacheUser && cacheWorkspace ? readScoped<{ id: string; name: string }[]>(cacheUser, cacheWorkspace, "account-options") : null,
  );
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>(() => initialAccounts ?? []);
  const [categories, setCategories] = useState<{ id: string; name: string; kind: string }[]>(() =>
    cacheUser && cacheWorkspace
      ? readScoped<{ id: string; name: string; kind: string }[]>(cacheUser, cacheWorkspace, "category-options") ?? []
      : [],
  );
  const [accountId, setAccountId] = useState<string | undefined>(() => initialAccounts?.[0]?.id);
  const [accountsKnown, setAccountsKnown] = useState(initialAccounts != null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => {
    const next = quickExpenseDraft();
    return kind === "income" ? { ...next, kind: "income" as const, description: "", category: INCOME_CATEGORIES[0] } : next;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [debts, setDebts] = useState<{ id: string; counterparty?: string; direction?: string }[]>([]);
  const [debtId, setDebtId] = useState<string>("");
  const [interest, setInterest] = useState("0.00");
  const loanRepay = kind === "expense" && draft.category === "Loan repayments";
  const repaymentIn = kind === "income" && draft.category === "Repayment received";
  const people = debts.filter((row) => (loanRepay ? row.direction === "i_owe" : row.direction === "owed_to_me"));
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const remoteNames = categories.filter((row) => row.kind === kind).map((row) => row.name);
  const allowed = [...new Set([
    ...(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES),
    ...remoteNames,
  ])];
  const mismatch = extras && !allowed.includes(draft.category);
  const fieldError = (field: DraftIssue["field"]) => issues.find((issue) => issue.field === field)?.message;
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    const userId = user?.userId;
    if (!workspaceId || !userId) return;
    type Option = { id: string; name: string };
    void fetchScoped(userId, workspaceId, "category-options", async () => {
      const res = await session.listCategories(workspaceId);
      return res.data.map((row) => ({ id: row.id, name: row.name, kind: row.kind }));
    }).then(({ data }) => {
      if (data) setCategories(data);
    });
    void fetchScoped<Option[]>(userId, workspaceId, "account-options", async () => {
      const res = await session.listAccounts(workspaceId);
      return rememberAccountOptions(userId, workspaceId, res.data);
    }).then(({ data, offline }) => {
      if (data) {
        setAccounts(data);
        setAccountsKnown(true);
        if (data[0]) setAccountId((current) => current ?? data[0].id);
      } else if (!offline) {
        setAccountsKnown(true);
      }
    });
    void session.listDebts(workspaceId).then((res) => {
      setDebts((res.data ?? []) as { id: string; counterparty?: string; direction?: string }[]);
    }).catch(() => setDebts([]));
  }, [session, user, workspaceId]);

  const postDraft = () => {
    if (!user || !workspaceId) return;
    if ((loanRepay || repaymentIn) && !debtId) {
      setToast(loanRepay ? "Add who you owe first" : "Add who owes you first");
      return;
    }
    if (loanRepay || repaymentIn) {
      setSaving(true);
      const kindMove = loanRepay ? "repay" : "collect";
      const body = loanRepay
        ? { cashAccountId: accountId, principal: draft.amount, interest, operationId: newId() }
        : { cashAccountId: accountId, amount: draft.amount, operationId: newId() };
      void session
        .debtMove(workspaceId, debtId, kindMove, body)
        .then(() => {
          afterMoneyWrite();
          setToast(loanRepay ? "Paid this person." : "Collected.");
        })
        .catch((err: Error) => setToast(err.message))
        .finally(() => setSaving(false));
      return;
    }
    const categoryId = categories.find((row) => row.name === draft.category)?.id;
    setSaving(true);
    void commitAdd(
      outboxForUser(user.userId),
      {
        userId: user.userId,
        workspaceId,
        draft,
        chosenAccountId: accountId,
        accounts,
        knownEmpty: accountsKnown && accounts.length === 0,
        categoryId,
      },
      (ws, body, opId) => session.createTransaction(ws, { ...(body as object), operationId: opId }),
    )
      .then((result) => {
        if (result.kind === "invalid") return;
        if (result.kind === "refused") {
          setToast(result.message);
          if (result.message === "Add an account first.") router.push("/(tabs)/accounts/add");
          return;
        }
        if (result.outcome === "synced" || result.outcome === "saved_on_device") afterMoneyWrite();
        setToast(result.toast);
      })
      .catch((err: Error) => setToast(err.message))
      .finally(() => setSaving(false));
  };

  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0 || mismatch) return;
    if ((loanRepay || repaymentIn) && people.length === 0) return;
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
      footer={<Button fullWidth loading={saving} disabled={(loanRepay || repaymentIn) && (people.length === 0 || !debtId)} onPress={save}>{kind === "income" ? "Save income" : extras ? "Save changes" : "Save expense"}</Button>}
    >
      <Txt variant="titleMd" accessibilityRole="header">
        {kind === "income" ? "Add income" : "Add expense"}
      </Txt>
      <WidePane
        sidebar={
          extras ? (
            <Banner tone="warning" title="Changed on another device">
              This record was edited elsewhere. Review before you save.
            </Banner>
          ) : undefined
        }
      >
        {mismatch ? (
          <Banner tone="danger" title="Category type mismatch">
            An expense cannot use an income category.
          </Banner>
        ) : null}
        <TextField
          label="What it was for"
          placeholder={kind === "income" ? "Optional, e.g. Salary" : "Optional, e.g. Shoprite"}
          value={draft.description}
          onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
          error={fieldError("description")}
        />
        <AmountInput label="Amount" value={draft.amount} onChange={(amount) => setDraft((current) => ({ ...current, amount }))} error={fieldError("amount")} />
        <CategoryPicker categories={extras ? [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] : allowed} value={draft.category} onChange={(category) => setDraft((current) => ({ ...current, category }))} />
        {loanRepay || repaymentIn ? (
          people.length === 0 ? (
            <>
              <Banner tone="warning" title={loanRepay ? "Add who you owe first" : "Add who owes you first"} />
              <Button
                onPress={() => router.push(loanRepay ? "/(tabs)/plan/debt-owe" : "/(tabs)/plan/debt-owed")}
              >
                {loanRepay ? "I owe someone" : "Someone owes me"}
              </Button>
            </>
          ) : (
            <>
              <SegmentedControl
                label="Who"
                value={debtId}
                onChange={setDebtId}
                options={people.map((row) => ({ value: row.id, label: String(row.counterparty) }))}
              />
              {loanRepay ? <AmountInput label="Interest" value={interest} onChange={setInterest} /> : null}
            </>
          )
        ) : null}
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

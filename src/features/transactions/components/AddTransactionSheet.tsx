import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import {
  AmountDisplay,
  Button,
  CategoryPicker,
  DatePicker,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  SegmentedControl,
  Sheet,
  TextField,
  Txt,
  useTheme,
} from "@/design";
import { rememberAccountOptions, type AccountOption } from "@/features/accounts/services/account-options";
import { draftIssues, quickExpenseDraft, saveLabel, type AddDraft, type DraftIssue, type EntryKind } from "@/features/transactions/services/add-draft";
import { commitAdd } from "@/features/transactions/services/commit-add";
import { afterMoneyWrite } from "@/lib/after-money";
import { fetchScoped, readScoped } from "@/lib/cached-fetch";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";
import { outboxForUser } from "@/sync/user-outbox";

type Option = AccountOption;
type CategoryOption = Option & { kind: string };

const KINDS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

function draftFor(kind?: EntryKind): AddDraft {
  const next = quickExpenseDraft();
  if (kind === "income") {
    return { ...next, kind: "income", description: "", category: INCOME_CATEGORIES[0] };
  }
  if (kind === "transfer") {
    return { ...next, kind: "transfer", description: "", category: "" };
  }
  return next;
}

function messageFor(issues: DraftIssue[], field: DraftIssue["field"]): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

export function AddTransactionSheet({
  open,
  onClose,
  onSaved,
  initialKind,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  initialKind?: EntryKind;
}) {
  const t = useTheme();
  const { session, user } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const [draft, setDraft] = useState<AddDraft>(() => draftFor(initialKind));
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [more, setMore] = useState(false);
  const cacheUser = user?.userId;
  const cacheWorkspace = workspaceId;
  const [initialAccounts] = useState(() =>
    cacheUser && cacheWorkspace ? readScoped<Option[]>(cacheUser, cacheWorkspace, "account-options") : null,
  );
  const [accounts, setAccounts] = useState<Option[]>(() => initialAccounts ?? []);
  const [categories, setCategories] = useState<CategoryOption[]>(() =>
    cacheUser && cacheWorkspace ? readScoped<CategoryOption[]>(cacheUser, cacheWorkspace, "category-options") ?? [] : [],
  );
  const [accountsKnown, setAccountsKnown] = useState(initialAccounts != null);
  const [fromId, setFromId] = useState(() => initialAccounts?.[0]?.id ?? "");
  const [toId, setToId] = useState(() => initialAccounts?.[1]?.id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const userId = user?.userId;
    if (!workspaceId || !userId || !open) return;
    const applyAccounts = (rows: Option[] | null) => {
      if (!rows) return;
      setAccounts(rows);
      setAccountsKnown(true);
      setFromId((current) => current || rows[0]?.id || "");
      setToId((current) => current || rows[1]?.id || "");
    };
    void fetchScoped<Option[]>(userId, workspaceId, "account-options", async () => {
      const res = await session.listAccounts(workspaceId);
      return rememberAccountOptions(userId, workspaceId, res.data);
    }).then(({ data, offline }) => {
      if (data) applyAccounts(data);
      else if (!offline) setAccountsKnown(true);
    });
    void fetchScoped<CategoryOption[]>(userId, workspaceId, "category-options", async () => {
      const res = await session.listCategories(workspaceId);
      return res.data.map((row) => ({ id: row.id, name: row.name, kind: row.kind }));
    }).then(({ data }) => {
      if (data) setCategories(data);
    });
  }, [open, session, user, workspaceId]);

  const setKind = (kind: EntryKind) => {
    const category = kind === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
    setDraft((current) => ({ ...current, kind, category: kind === "transfer" ? "" : category }));
  };

  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0) return;
    const userId = user?.userId;
    if (!workspaceId || !userId) return;
    const categoryId = categories.find((row) => row.name === draft.category && row.kind === draft.kind)?.id;
    setBusy(true);
    void commitAdd(
      outboxForUser(userId),
      {
        userId,
        workspaceId,
        draft,
        chosenAccountId: fromId || undefined,
        accounts,
        knownEmpty: accountsKnown && accounts.length === 0,
        categoryId,
        toAccountId: toId,
      },
      (ws, payload, operationId) => session.createTransaction(ws, { ...(payload as object), operationId }),
    )
      .then((result) => {
        if (result.kind === "invalid") return;
        if (result.kind === "refused") {
          onSaved(result.message);
          return;
        }
        if (result.outcome === "synced" || result.outcome === "saved_on_device") afterMoneyWrite();
        onSaved(result.toast);
      })
      .catch((err: Error) => onSaved(err.message))
      .finally(() => setBusy(false));
  };

  const title = draft.kind === "income" ? "Add income" : draft.kind === "transfer" ? "Add transfer" : "Add expense";
  const accountOptions = accounts.map((row) => ({ value: row.id, label: row.name }));

  return (
    <Sheet
      title={title}
      open={open}
      onClose={onClose}
      footer={
        <View style={{ flex: 1 }}>
          <Button fullWidth size="lg" loading={busy} onPress={save}>
            {saveLabel(draft.kind)}
          </Button>
        </View>
      }
    >
      <SegmentedControl label="Type" options={KINDS} value={draft.kind} onChange={(value) => setKind(value as EntryKind)} />

      <AmountDisplay
        label="Amount"
        value={draft.amount}
        kind={draft.kind}
        autoFocus
        onChange={(amount) => setDraft((current) => ({ ...current, amount }))}
        error={messageFor(issues, "amount")}
      />

      {draft.kind === "transfer" ? null : (
        <View style={{ gap: t.space.space2 }}>
          <CategoryPicker
            categories={draft.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
            value={draft.category}
            onChange={(category) => setDraft((current) => ({ ...current, category }))}
          />
          {messageFor(issues, "category") ? (
            <Txt variant="caption" color={t.c.danger}>
              {messageFor(issues, "category")}
            </Txt>
          ) : null}
        </View>
      )}

      <TextField
        label="What it was for"
        placeholder={draft.kind === "transfer" ? "Optional note" : `Optional, e.g. ${draft.category || "Jollof rice"}`}
        value={draft.description}
        onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
        error={messageFor(issues, "description")}
      />

      {accountOptions.length > 0 ? (
        <SegmentedControl label={draft.kind === "transfer" ? "From" : "Account"} options={accountOptions} value={fromId} onChange={setFromId} />
      ) : null}
      {draft.kind === "transfer" && accountOptions.length > 1 ? (
        <SegmentedControl label="To" options={accountOptions} value={toId} onChange={setToId} />
      ) : null}

      <Pressable onPress={() => setMore((value) => !value)} accessibilityRole="button">
        <Txt variant="label" color={t.c.primary} style={{ fontWeight: "600" }}>
          {more ? "Hide details" : "More details"}
        </Txt>
      </Pressable>
      {more ? (
        <View style={{ gap: t.space.space4 }}>
          <TextField
            label="Account note"
            value={draft.account}
            onChangeText={(account) => setDraft((current) => ({ ...current, account }))}
          />
          <DatePicker
            label="Date"
            value={draft.date}
            onChange={(date) => setDraft((current) => ({ ...current, date }))}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

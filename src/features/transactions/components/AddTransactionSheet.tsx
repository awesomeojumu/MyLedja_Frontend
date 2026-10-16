import { useState } from "react";
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
} from "../../../design";
import { draftIssues, quickExpenseDraft, saveLabel, savedMessage, type AddDraft, type DraftIssue, type EntryKind } from "../services/add-draft";

const KINDS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

function draftFor(kind?: EntryKind): AddDraft {
  const next = quickExpenseDraft();
  if (kind === "income") {
    return { ...next, kind: "income", description: "Income", category: INCOME_CATEGORIES[0] };
  }
  if (kind === "transfer") {
    return { ...next, kind: "transfer", description: "Transfer", category: "" };
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
  const [draft, setDraft] = useState<AddDraft>(() => draftFor(initialKind));
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [more, setMore] = useState(false);

  const setKind = (kind: EntryKind) => {
    const category = kind === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0];
    setDraft((current) => ({ ...current, kind, category }));
  };

  const save = () => {
    const next = draftIssues(draft);
    setIssues(next);
    if (next.length > 0) return;
    onSaved(savedMessage(draft.kind));
  };

  const title = draft.kind === "income" ? "Add income" : draft.kind === "transfer" ? "Add transfer" : "Add expense";

  return (
    <Sheet
      title={title}
      open={open}
      onClose={onClose}
      footer={
        <View style={{ flex: 1 }}>
          <Button fullWidth size="lg" onPress={save}>
            {saveLabel(draft.kind)}
          </Button>
        </View>
      }
    >
      <SegmentedControl label="Type" options={KINDS} value={draft.kind} onChange={(value) => setKind(value as EntryKind)} />
      <TextField
        label="What it was for"
        placeholder="Jollof rice"
        value={draft.description}
        onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
        error={messageFor(issues, "description")}
      />
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
      <Pressable onPress={() => setMore((value) => !value)} accessibilityRole="button">
        <Txt variant="label" color={t.c.primary} style={{ fontWeight: "600" }}>
          {more ? "Hide details" : "More details"}
        </Txt>
      </Pressable>
      {more ? (
        <View style={{ gap: t.space.space4 }}>
          <TextField
            label="Account"
            value={draft.account}
            onChangeText={(account) => setDraft((current) => ({ ...current, account }))}
          />
          <DatePicker label="Date" value={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} />
        </View>
      ) : (
        <Txt variant="caption" color={t.c.inkMuted}>
          Cash · Today
        </Txt>
      )}
    </Sheet>
  );
}

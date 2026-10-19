import { useCallback, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AmountInput,
  Banner,
  Button,
  CategoryPicker,
  Dialog,
  Select,
  TextField,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";

export function EditTransactionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();

  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes, catRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
        session.listCategories(workspaceId),
      ]);
      const txns = (txRes.data.transactions ?? []).filter((row) => row.id);
      const accounts = (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) =>
        toLedgerAccount(row as ApiAccount),
      );
      const categories = (catRes.data ?? []).map((c) => ({
        name: c.name,
        kind: c.kind,
      }));
      return { txns, accounts, categories };
    },
    [session],
  );

  const { data, loading, offline, error, refresh } = useLiveQuery(
    load,
    { txns: [] as ApiTransaction[], accounts: [] as ReturnType<typeof toLedgerAccount>[], categories: [] as { name: string; kind: string }[] },
    "edit-tx",
  );

  const tx = data.txns.find((item) => item.id === id);

  const [description, setDescription] = useState(tx?.description ?? "");
  const [amount, setAmount] = useState(tx?.amount ?? "0.00");
  const [category, setCategory] = useState(tx?.type ?? "Food & groceries");
  const [accountId, setAccountId] = useState(tx?.accountId ?? "");
  const [reason, setReason] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const { busy, error: submitError, run } = useSubmit();

  const handleSave = () => {
    run(async () => {
      router.back();
    });
  };

  const handleVoid = () => {
    setVoidDialogOpen(false);
    run(async () => {
      router.back();
    });
  };

  return (
    <PageScaffold
      title="Edit transaction"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      footer={
        <View style={{ gap: t.space.space2 }}>
          <Button fullWidth loading={busy} onPress={handleSave}>
            Save changes
          </Button>
          <Button
            variant="destructive"
            fullWidth
            onPress={() => setVoidDialogOpen(true)}
          >
            Void transaction
          </Button>
        </View>
      }
    >
      {submitError ? <Banner tone="danger" title={submitError} /> : null}

      <TextField
        label="Description / Note"
        value={description}
        onChangeText={setDescription}
      />

      <AmountInput
        label="Amount"
        value={amount}
        onChange={setAmount}
      />

      <CategoryPicker
        label="Category"
        value={category}
        categories={data.categories.map((c) => c.name)}
        onChange={setCategory}
      />

      <Select
        label="Account"
        value={accountId}
        options={data.accounts.map((a) => ({ value: a.id, label: a.name }))}
        onChange={setAccountId}
      />

      <TextField
        label="Reason for change"
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. Corrected mistyped receipt amount"
      />

      <Dialog
        title="Void this transaction?"
        open={voidDialogOpen}
        onClose={() => setVoidDialogOpen(false)}
        tone="destructive"
        confirmLabel="Void transaction"
        onConfirm={handleVoid}
      >
        <Txt>
          Voiding stops this transaction from counting in totals, balances, and reports,
          while preserving it safely in audit history.
        </Txt>
      </Dialog>
    </PageScaffold>
  );
}

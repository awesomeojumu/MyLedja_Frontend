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
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";

export function EditTransactionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();

  const load = useCallback(
    async (wsId: string) => {
      const [txRes, accountsRes, catRes] = await Promise.all([
        session.listTransactions(wsId),
        session.listAccounts(wsId),
        session.listCategories(wsId),
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

  return (
    <EditTransactionForm
      key={tx?.id ?? (loading ? "loading" : "none")}
      tx={tx}
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      categories={data.categories}
      accounts={data.accounts}
      workspaceId={workspaceId}
      onDone={() => router.back()}
    />
  );
}

function EditTransactionForm({
  tx,
  loading,
  offline,
  error,
  onRetry,
  categories,
  accounts,
  workspaceId,
  onDone,
}: {
  tx?: ApiTransaction;
  loading: boolean;
  offline: boolean;
  error?: string | null;
  onRetry: () => void;
  categories: { name: string; kind: string }[];
  accounts: ReturnType<typeof toLedgerAccount>[];
  workspaceId: string | null;
  onDone: () => void;
}) {
  const t = useTheme();
  const { session } = useSession();

  const [description, setDescription] = useState(tx?.description ?? "");
  const [amount, setAmount] = useState(tx?.amount ?? "0.00");
  const [category, setCategory] = useState(tx?.type ?? "Food & groceries");
  const [accountId, setAccountId] = useState(tx?.accountId ?? (accounts[0]?.id ?? ""));
  const [reason, setReason] = useState("");
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  const { busy, error: submitError, run } = useSubmit();

  const handleSave = () => {
    run(async () => {
      if (workspaceId && tx?.id) {
        try {
          await session.setTransactionStatus(workspaceId, tx.id, "voided");
        } catch {
          // Proceed with posting replacement if already voided
        }
        await session.createTransaction(workspaceId, {
          operationId: newId(),
          type: tx.type ?? "expense",
          amount: amount.includes(".") ? amount : `${amount}.00`,
          accountId: accountId || tx.accountId,
          categoryId: category,
          description: reason ? `${description} (${reason})` : description,
          status: "posted",
        });
      }
      onDone();
    });
  };

  const handleVoid = () => {
    setVoidDialogOpen(false);
    run(async () => {
      if (workspaceId && tx?.id) {
        await session.setTransactionStatus(workspaceId, tx.id, "voided");
      }
      onDone();
    });
  };

  return (
    <PageScaffold
      title="Edit transaction"
      loading={loading}
      offline={offline}
      error={error}
      onRetry={onRetry}
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
        categories={categories.map((c) => c.name)}
        onChange={setCategory}
      />

      <Select
        label="Account"
        value={accountId}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
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

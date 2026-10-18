import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountInput, Banner, Button, ChipGroup, EmptyState, formatMoney, Toast } from "@/design";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { afterMoneyWrite } from "@/lib/after-money";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

type TxRow = { id: string; accountId?: string; description?: string; amount?: string; type?: string; status?: string };

export function RefundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; accountId?: string }>();
  const { session, workspaces } = useSession();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [id, setId] = useState(params.id ?? "");
  const [accountId, setAccountId] = useState(params.accountId ?? "");
  const [amount, setAmount] = useState("0.00");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) return;
    void session.listTransactions(workspaceId).then((res) => {
      // TC-07: only a posted expense can be refunded.
      const next = ((res.data.transactions ?? []) as TxRow[]).filter((row) => row.type === "expense" && (row.status ?? "posted") === "posted");
      setRows(next);
      if (!id && next[0]) {
        setId(next[0].id);
        if (next[0].accountId) setAccountId(next[0].accountId);
      }
    });
  }, [id, session, workspaces]);

  const options = rows.map((row) => ({
    value: row.id,
    label: `${row.description || "Expense"} · ${formatMoney(Number.parseFloat(row.amount ?? "0") || 0)}`,
  }));

  return (
    <TxScreen
      title="Refund or reversal"
      emptyTitle="Nothing to refund"
      errorTitle="Could not record this refund"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() => {
            const workspaceId = workspaces[0]?.id;
            const original = rows.find((row) => row.id === id);
            const acct = accountId || original?.accountId;
            if (!workspaceId || !id || !acct) {
              setToast("Need the original transaction and account.");
              return;
            }
            setBusy(true);
            void session
              .createTransaction(workspaceId, {
                operationId: newId(),
                type: "refund",
                amount: amount.includes(".") ? amount : `${amount}.00`,
                accountId: acct,
                originalTransactionId: id,
                description: "Refund",
                status: "posted",
              })
              .then(() => {
                afterMoneyWrite();
                setToast("Refund posted. It comes off your spending; the original stays posted.");
              })
              .catch((err: Error) => setToast(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Save refund
        </Button>
      }
    >
      <Banner tone="primary" title="Refund is a new row">
        A refund does not delete the original expense. It reduces your spending by the refund amount.
      </Banner>
      {options.length > 0 ? (
        <ChipGroup
          label="Original expense"
          scroll
          options={options}
          value={id}
          onChange={(next: string) => {
            setId(next);
            const row = rows.find((item) => item.id === next);
            if (row?.accountId) setAccountId(row.accountId);
          }}
        />
      ) : (
        <EmptyState title="No expenses to refund yet" icon="inbox">
          Record an expense first, then refund it here.
        </EmptyState>
      )}
      <AmountInput label="Refund amount" value={amount} onChange={setAmount} />
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            if (toast.startsWith("Refund posted")) router.back();
          }}
        />
      ) : null}
    </TxScreen>
  );
}

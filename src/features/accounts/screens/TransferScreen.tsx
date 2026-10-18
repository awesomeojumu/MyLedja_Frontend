import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AmountInput, Button, SegmentedControl, Toast } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { afterMoneyWrite } from "@/lib/after-money";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

type AccountRow = { id: string; name: string };

export function TransferScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { session, workspaces } = useSession();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) return;
    void session.listAccounts(workspaceId).then((res) => {
      const rows = (Array.isArray(res.data) ? res.data : []).map((row) => {
        const rec = row as { id?: string; name?: string };
        return { id: String(rec.id ?? ""), name: String(rec.name ?? rec.id) };
      });
      setAccounts(rows);
      if (from && rows.some((row) => row.id === from)) setFromId(from);
      else if (rows[0]) setFromId(rows[0].id);
      if (rows[1]) setToId(rows.find((row) => row.id !== (from || rows[0]?.id))?.id ?? rows[1].id);
    });
  }, [from, session, workspaces]);

  const options = accounts.map((row) => ({ value: row.id, label: row.name }));

  const save = () => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId || !fromId || !toId) {
      setToast("Add two accounts before you transfer.");
      return;
    }
    if (fromId === toId) {
      setToast("Pick two different accounts.");
      return;
    }
    setBusy(true);
    void session
      .createTransaction(workspaceId, {
        operationId: newId(),
        type: "transfer",
        amount: amount.includes(".") ? amount : `${amount}.00`,
        accountId: fromId,
        toAccountId: toId,
        description: "Transfer",
        status: "posted",
      })
      .then(() => {
        afterMoneyWrite();
        setToast("Transfer posted.");
      })
      .catch((err: Error) => setToast(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <AccountScreenShell
      title="Transfer"
      showBack
      footer={<Button fullWidth loading={busy} onPress={save}>Save transfer</Button>}
    >
      {options.length >= 1 ? (
        <SegmentedControl label="From" options={options} value={fromId} onChange={setFromId} />
      ) : null}
      {options.length >= 2 ? (
        <SegmentedControl label="To" options={options} value={toId} onChange={setToId} />
      ) : null}
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            if (toast === "Transfer posted.") router.back();
          }}
        />
      ) : null}
    </AccountScreenShell>
  );
}

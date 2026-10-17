import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/api/client";
import { AmountInput, Banner, Button, Select, Toast } from "@/design";
import { formatMoney } from "@/design/format";
import { WidePane } from "@/lib";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { ACCOUNTS } from "@/features/accounts/dummy-data";
import { savedTransferMessage, transferDraftIssues } from "@/features/accounts/services/account-draft";

export function TransferScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [remote, setRemote] = useState<{ id: string; name: string }[]>([]);
  const fallback = ACCOUNTS.filter((account) => !account.archived && account.group !== "liability").map((account) => ({
    value: account.id,
    label: account.name,
  }));
  const options = remote.length > 0 ? remote.map((account) => ({ value: account.id, label: account.name })) : fallback;
  const [fromId, setFromId] = useState(from && options.some((option) => option.value === from) ? from : options[0]?.value);
  const [toId, setToId] = useState(options.find((option) => option.value !== fromId)?.value ?? options[1]?.value);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (!workspaceId) return;
    void session.listAccounts(workspaceId).then((res) => {
      setRemote(
        (res.data as { id: string; name: string; archivedAt?: string | null }[])
          .filter((row) => !row.archivedAt)
          .map((row) => ({ id: row.id, name: row.name })),
      );
    });
  }, [session, workspaceId]);

  const save = () => {
    const issues = transferDraftIssues({ fromId: fromId ?? "", toId: toId ?? "", amount });
    if (issues.length > 0) {
      setError(issues[0]?.message);
      return;
    }
    if (!workspaceId || !fromId || !toId) {
      setError("Add two accounts first.");
      return;
    }
    setError(undefined);
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
      .then(() => setToast(savedTransferMessage(formatMoney(Number(amount), "NGN"))))
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : "Could not move this money.");
      });
  };

  return (
    <AccountScreenShell
      title="Create transfer"
      emptyTitle="Only one account"
      emptyBody="Add another account before you can move money."
      emptyAction={{ label: "Add account", icon: "plus", onPress: () => router.push("/(tabs)/accounts/types") }}
      errorTitle="Could not move this money"
      footer={<Button fullWidth onPress={save}>Move money</Button>}
    >
      <WidePane
        sidebar={
          <Banner tone="primary" title="Neither income nor expense">
            Money moved between your own accounts is a transfer.
          </Banner>
        }
      >
        <Select label="From" options={options} value={fromId} onChange={setFromId} />
        <Select label="To" options={options} value={toId} onChange={setToId} error={error} />
        <AmountInput label="Amount" value={amount} onChange={setAmount} />
      </WidePane>
      {toast ? (
        <View>
          <Toast
            message={toast}
            onClose={() => {
              setToast(null);
              router.back();
            }}
          />
        </View>
      ) : null}
    </AccountScreenShell>
  );
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AmountInput, Banner, Button, Select, Toast } from "../../../design";
import { formatMoney } from "../../../design/format";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ACCOUNTS } from "../dummy-data";
import { savedTransferMessage, transferDraftIssues } from "../services/account-draft";

export function TransferScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const options = ACCOUNTS.map((account) => ({ value: account.id, label: account.name }));
  const [fromId, setFromId] = useState(from && ACCOUNTS.some((account) => account.id === from) ? from : options[0]?.value);
  const [toId, setToId] = useState(options.find((option) => option.value !== fromId)?.value ?? options[1]?.value);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    const issues = transferDraftIssues({ fromId: fromId ?? "", toId: toId ?? "", amount });
    if (issues.length > 0) {
      setError(issues[0]?.message);
      return;
    }
    setError(undefined);
    setToast(savedTransferMessage(formatMoney(Number(amount), "NGN")));
  };

  return (
    <AccountScreenShell title="Transfer" emptyTitle="Pick two accounts" errorTitle="Could not move this money" footer={<Button fullWidth onPress={save}>Move money</Button>}>
      <Banner tone="primary" title="Neither income nor expense">
        Money moved between your own accounts is a transfer.
      </Banner>
      <Select label="From" options={options} value={fromId} onChange={setFromId} />
      <Select label="To" options={options} value={toId} onChange={setToId} error={error} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
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

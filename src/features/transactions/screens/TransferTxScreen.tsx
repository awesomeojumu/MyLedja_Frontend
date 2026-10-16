import { useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, Select, Toast } from "../../../design";
import { formatMoney } from "../../../design/format";
import { TxScreen } from "../components/TxScreen";

const ACCOUNTS = [
  { value: "gtbank", label: "GTBank Current" },
  { value: "cash", label: "Cash" },
  { value: "opay", label: "Opay" },
];

export function TransferTxScreen() {
  const router = useRouter();
  const [fromId, setFromId] = useState("gtbank");
  const [toId, setToId] = useState("cash");
  const [amount, setAmount] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  return (
    <TxScreen
      title="Transfer"
      emptyTitle="Pick two accounts"
      errorTitle="Could not move this money"
      footer={<Button fullWidth onPress={() => setToast(`Moved ${formatMoney(Number(amount) || 0, "NGN")} between your accounts.`)}>Move money</Button>}
    >
      <Banner tone="primary" title="Neither income nor expense">
        Money moved between your own accounts is a transfer.
      </Banner>
      <Select label="From" options={ACCOUNTS} value={fromId} onChange={setFromId} />
      <Select label="To" options={ACCOUNTS} value={toId} onChange={setToId} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
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

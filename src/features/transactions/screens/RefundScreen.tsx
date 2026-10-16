import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, SegmentedControl, Toast } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { transactionById } from "../dummy-data";

const MODES = [
  { value: "refund", label: "Refund" },
  { value: "reversal", label: "Reversal" },
];

export function RefundScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? "shoprite")) ?? transactionById("shoprite");
  const [amount, setAmount] = useState(row ? String(row.amount) : "");
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState("refund");
  const reversal = mode === "reversal";
  return (
    <TxScreen
      title="Refund or reversal"
      emptyTitle="Nothing to refund"
      errorTitle="Could not record this refund"
      footer={<Button fullWidth onPress={() => setToast(reversal ? "Reversal saved on this phone." : "Refund saved on this phone.")}>{reversal ? "Save reversal" : "Save refund"}</Button>}
    >
      <WidePane
        sidebar={
          <Banner tone="primary" title={row?.title ?? "This record"}>
            {reversal ? "A reversal undoes the original posting with a matching opposite record." : "A refund is income. It does not delete the original expense."}
          </Banner>
        }
      >
        <SegmentedControl label="Kind" options={MODES} value={mode} onChange={setMode} />
        <AmountInput label={reversal ? "Reversal amount" : "Refund amount"} value={amount} onChange={setAmount} />
      </WidePane>
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

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, Toast } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { transactionById } from "../dummy-data";

export function RefundScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? "shoprite")) ?? transactionById("shoprite");
  const [amount, setAmount] = useState(row ? String(row.amount) : "");
  const [toast, setToast] = useState<string | null>(null);
  return (
    <TxScreen
      title="Refund"
      emptyTitle="Nothing to refund"
      errorTitle="Could not record this refund"
      footer={<Button fullWidth onPress={() => setToast("Refund saved on this phone.")}>Save refund</Button>}
    >
      <Banner tone="primary" title={row?.title ?? "This record"}>
        A refund is income. It does not delete the original expense.
      </Banner>
      <AmountInput label="Refund amount" value={amount} onChange={setAmount} />
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

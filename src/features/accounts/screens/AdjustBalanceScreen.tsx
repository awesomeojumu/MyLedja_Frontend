import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, Toast } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { accountById } from "../dummy-data";

export function AdjustBalanceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? "cash")) ?? accountById("cash");
  const [value, setValue] = useState(String(account?.balance ?? 0));
  const [toast, setToast] = useState<string | null>(null);

  return (
    <AccountScreenShell title="Adjust balance" emptyTitle="No balance to adjust" errorTitle="Could not save this balance" footer={<Button fullWidth onPress={() => setToast("Balance updated on this device.")}>Save balance</Button>}>
      <Banner tone="primary" title="Not income">
        Use this when cash on hand changed and you are not recording a transaction.
      </Banner>
      <AmountInput label={`${account?.name ?? "Account"} balance`} value={value} onChange={setValue} />
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </AccountScreenShell>
  );
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AmountInput, Banner, Button, Toast } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { accountById } from "../dummy-data";

export function OpeningBalanceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? "gtbank"));
  const [opening, setOpening] = useState(account ? String(account.balance) : "0");
  const [toast, setToast] = useState<string | null>(null);
  return (
    <AccountScreenShell
      title="Opening balance"
      emptyTitle="No account yet"
      errorTitle="Could not save this opening balance"
      footer={<Button fullWidth onPress={() => setToast("Opening balance saved. It is not income.")}>Save opening balance</Button>}
    >
      <WidePane
        sidebar={
          <Banner tone="primary" title="Not income">
            This is the starting figure for {account?.name ?? "this account"}. It does not go on the transaction list.
          </Banner>
        }
      >
        <AmountInput label="Opening balance" value={opening} onChange={setOpening} helper="Use the bank’s opening figure on the day you start." />
      </WidePane>
      {toast ? (
        <View>
          <Toast
            message={toast}
            onClose={() => {
              setToast(null);
              router.replace("/(tabs)/accounts");
            }}
          />
        </View>
      ) : null}
    </AccountScreenShell>
  );
}

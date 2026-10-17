import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/api/client";
import { AmountInput, Banner, Button, Toast } from "@/design";
import { WidePane } from "@/lib";
import { useSession } from "@/state";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { accountById } from "@/features/accounts/dummy-data";

export function OpeningBalanceScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? "gtbank"));
  const [accountId, setAccountId] = useState(id);
  const [opening, setOpening] = useState(account ? String(account.balance) : "0");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (!workspaceId || accountId) return;
    void session.listAccounts(workspaceId).then((res) => {
      const first = res.data[0] as { id?: string } | undefined;
      if (first?.id) setAccountId(first.id);
    });
  }, [accountId, session, workspaceId]);

  const save = () => {
    if (!workspaceId || !accountId) {
      setError("Add an account first.");
      return;
    }
    void session
      .setOpening(workspaceId, accountId, opening)
      .then(() => setToast("Opening balance saved. It is not income."))
      .catch((caught) => {
        setError(caught instanceof ApiError ? caught.message : "Could not save this opening balance.");
      });
  };

  return (
    <AccountScreenShell
      title="Opening balance"
      emptyTitle="No account yet"
      errorTitle={error ?? "Could not save this opening balance"}
      footer={<Button fullWidth onPress={save}>Save opening balance</Button>}
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

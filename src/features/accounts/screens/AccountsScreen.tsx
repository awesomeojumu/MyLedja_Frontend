import { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState } from "@/design";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE: ReturnType<typeof toLedgerAccount>[] = [];

export function AccountsScreen({ empty: _empty = false }: { empty?: boolean } = {}) {
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listAccounts(workspaceId);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((row) => toLedgerAccount(row as ApiAccount)).filter((row) => row.id);
    },
    [session],
  );
  const { data: accounts } = useLiveQuery(load, NONE, "accounts");
  const add = () => router.push("/(tabs)/accounts/add");

  return (
    <AccountScreenShell title="Accounts" showBack={false} footer={<Button fullWidth onPress={add}>Add account</Button>}>
      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" icon="wallet" action={{ label: "Add account", icon: "plus" as const, onPress: add }}>
          Add a cash account to start.
        </EmptyState>
      ) : (
        <View>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onPress={() => router.push(`/(tabs)/accounts/${account.id}`)}
            />
          ))}
        </View>
      )}
    </AccountScreenShell>
  );
}

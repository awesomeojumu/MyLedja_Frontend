import { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Button, EmptyState } from "@/design";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE: ReturnType<typeof toLedgerAccount>[] = [];

export function AccountsScreen({ empty: _empty = false }: { empty?: boolean } = {}) {
  const router = useRouter();
  const { session, user } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listAccounts(workspaceId);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (user) rememberAccountOptions(user.userId, workspaceId, rows);
      return rows.map((row) => toLedgerAccount(row as ApiAccount)).filter((row) => row.id);
    },
    [session, user],
  );
  const { data: accounts, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "accounts");
  const add = () => router.push("/(tabs)/accounts/types");

  return (
    <AccountScreenShell
      title="Accounts"
      showBack={false}
      actions={[{ icon: "archive", label: "Archived accounts", onPress: () => router.push("/(tabs)/accounts/archived") }]}
      footer={<Button fullWidth onPress={add}>Add account</Button>}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && accounts.length === 0 ? (
        <DefaultLoading />
      ) : accounts.length === 0 && !known ? null : accounts.length === 0 ? (
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

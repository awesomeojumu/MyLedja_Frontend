import { useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { EmptyState } from "@/design";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE: ReturnType<typeof toLedgerAccount>[] = [];

export function ArchivedAccountsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listAccounts(workspaceId, true);
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((row) => toLedgerAccount(row as ApiAccount)).filter((row) => row.id);
    },
    [session],
  );
  const { data: accounts, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "accounts-archived");

  return (
    <AccountScreenShell title="Archived accounts" showBack>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && accounts.length === 0 ? (
        <DefaultLoading />
      ) : accounts.length === 0 ? (
        <EmptyState title="No archived accounts" icon="archive">
          Live accounts stay on the main list.
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

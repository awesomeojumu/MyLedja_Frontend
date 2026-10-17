import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Banner, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { useSession } from "@/state";
import { AccountRow } from "@/features/accounts/components/AccountRow";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { ARCHIVED_ACCOUNTS } from "@/features/accounts/dummy-data";
import type { LedgerAccount } from "@/features/accounts/types/account";

export function ArchivedAccountsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [rows, setRows] = useState(ARCHIVED_ACCOUNTS);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) return;
    void session.listAccounts(workspaceId, true).then((res) => {
      const next = (res.data as { id: string; name: string }[]).map(
        (row): LedgerAccount => ({
          ...ARCHIVED_ACCOUNTS[0],
          id: row.id,
          name: row.name,
          archived: true,
        }),
      );
      if (next.length > 0) setRows(next);
    });
  }, [session, workspaces]);
  return (
    <AccountScreenShell
      title="Archived accounts"
      emptyTitle="Nothing archived"
      emptyBody="Archived accounts leave the list. Their transactions stay."
      errorTitle="Could not load archived accounts"
    >
      <WidePane
        sidebar={
          <Banner tone="neutral" title="Hidden from the list">
            These accounts still keep their history.
          </Banner>
        }
      >
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {rows.map((account) => (
          <AccountRow key={account.id} account={account} onPress={() => router.push(`/(tabs)/accounts/${account.id}`)} />
        ))}
      </View>
      </WidePane>
    </AccountScreenShell>
  );
}

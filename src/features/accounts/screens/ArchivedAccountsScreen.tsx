import { useRouter } from "expo-router";
import { View } from "react-native";
import { Banner, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountRow } from "../components/AccountRow";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ARCHIVED_ACCOUNTS } from "../dummy-data";

export function ArchivedAccountsScreen() {
  const t = useTheme();
  const router = useRouter();
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
        {ARCHIVED_ACCOUNTS.map((account) => (
          <AccountRow key={account.id} account={account} onPress={() => router.push(`/(tabs)/accounts/${account.id}`)} />
        ))}
      </View>
      </WidePane>
    </AccountScreenShell>
  );
}

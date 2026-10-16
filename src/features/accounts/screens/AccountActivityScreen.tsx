import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { EmptyState, TransactionRow, useTheme } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ACCOUNT_ACTIVITY, accountById } from "../dummy-data";

export function AccountActivityScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? ""));
  const rows = ACCOUNT_ACTIVITY[String(id ?? "")] ?? [];

  return (
    <AccountScreenShell title={account ? `${account.name} activity` : "Activity"} emptyTitle="Nothing recorded yet" errorTitle="Could not load activity">
      {rows.length === 0 ? (
        <EmptyState title="Nothing recorded yet" icon="inbox" action={{ label: "Add a transaction", onPress: () => router.push("/(tabs)/transactions") }}>
          New records for this account will show here.
        </EmptyState>
      ) : (
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {rows.map((row) => (
            <TransactionRow
              key={row.id}
              title={row.title}
              category={row.category}
              account={account?.name}
              amount={row.amount}
              kind={row.kind}
              time={row.when}
            />
          ))}
        </View>
      )}
    </AccountScreenShell>
  );
}

import { useRouter } from "expo-router";
import { View } from "react-native";
import { FilterButton, TransactionRow, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { REVIEW_ROWS, TRANSACTIONS } from "../dummy-data";

export function TransactionsScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <TxScreen
      title="Transactions"
      showBack={false}
      demo
      actions={[
        { icon: "search", label: "Search", onPress: () => router.push("/(tabs)/transactions/search") },
        { icon: "shopping-cart", label: "Categories", onPress: () => router.push("/(tabs)/transactions/categories") },
      ]}
      emptyTitle="No transactions yet"
      emptyBody="Tap Add money to record an expense in three taps."
      emptyAction={{ label: "Add money", icon: "plus", onPress: () => router.push("/(tabs)/transactions/add-expense") }}
      errorTitle="Could not load transactions"
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <FilterButton count={0} onPress={() => router.push("/(tabs)/transactions/filters")} />
        <FilterButton count={REVIEW_ROWS.length} label="Needs review" onPress={() => router.push("/(tabs)/transactions/review")} />
        <FilterButton count={0} label="Recurring" onPress={() => router.push("/(tabs)/transactions/recurring")} />
      </View>
      <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
        {TRANSACTIONS.map((row) => (
          <TransactionRow
            key={row.id}
            title={row.title}
            category={row.category}
            account={row.account}
            amount={row.amount}
            kind={row.kind}
            time={row.time}
            status={row.status}
            onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
          />
        ))}
      </View>
    </TxScreen>
  );
}

import { useRouter } from "expo-router";
import { View } from "react-native";
import { FilterButton, TransactionRow, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { QUEUE_ROWS, TRANSACTIONS } from "../dummy-data";

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
        { icon: "plus", label: "Add", onPress: () => router.push("/(tabs)/transactions/chooser") },
      ]}
      emptyTitle="No transactions yet"
      emptyBody="Tap Add to record an expense in three taps."
      emptyAction={{ label: "Add expense", icon: "plus", onPress: () => router.push("/(tabs)/transactions/add-expense") }}
      errorTitle="Could not load transactions"
    >
      <WidePane tablet
        sidebar={
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <FilterButton count={0} onPress={() => router.push("/(tabs)/transactions/search")} />
          <FilterButton count={QUEUE_ROWS.length} label="Sync queue" onPress={() => router.push("/(tabs)/transactions/queue")} />
          <FilterButton count={0} label="Calendar" onPress={() => router.push("/(tabs)/transactions/calendar")} />
          <FilterButton count={0} label="Categories" onPress={() => router.push("/(tabs)/transactions/categories")} />
        </View>
        }
      >
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
      </WidePane>
    </TxScreen>
  );
}

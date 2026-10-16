import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Button, EmptyState, TransactionDetail, detailActions } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { transactionById } from "../dummy-data";

export function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = transactionById(String(id ?? ""));
  if (!row) {
    return (
      <TxScreen title="Transaction" emptyTitle="This record is not on this workspace">
        <EmptyState title="This record is not on this workspace" icon="inbox" action={{ label: "See transactions", onPress: () => router.replace("/(tabs)/transactions") }} />
      </TxScreen>
    );
  }
  return (
    <TxScreen
      title={row.title}
      emptyTitle="This record is not on this workspace"
      errorTitle="Could not load this record"
      footer={
        <View style={{ flexDirection: "row", gap: 12 }}>
          {detailActions({
            onEdit: () => router.push(`/(tabs)/transactions/edit?id=${row.id}`),
            onDelete: () => router.replace("/(tabs)/transactions"),
          })}
        </View>
      }
    >
      <TransactionDetail
        transaction={{
          title: row.title,
          category: row.category,
          amount: row.amount,
          kind: row.kind,
          account: row.account,
          date: row.time,
          status: row.status ?? "synced",
        }}
      />
      {row.kind === "expense" ? (
        <Button variant="tertiary" onPress={() => router.push(`/(tabs)/transactions/refund?id=${row.id}`)}>
          Record a refund
        </Button>
      ) : null}
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/split")}>
        Split
      </Button>
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/receipt")}>
        Receipt
      </Button>
    </TxScreen>
  );
}

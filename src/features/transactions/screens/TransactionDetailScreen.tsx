import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Dialog, EmptyState, TransactionDetail, detailActions } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { transactionById } from "@/features/transactions/dummy-data";

export function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = transactionById(String(id ?? ""));
  const [voidOpen, setVoidOpen] = useState(false);
  if (!row) {
    return (
      <TxScreen title="Transaction details" emptyTitle="This record is not on this workspace">
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
            onDelete: () => setVoidOpen(true),
          })}
        </View>
      }
    >
      <WidePane tablet
        sidebar={
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
        }
      >
        <Button variant="secondary" icon="receipt" onPress={() => router.push(`/(tabs)/transactions/receipt?id=${row.id}`)}>
          Receipt
        </Button>
        {row.kind === "expense" ? (
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/transactions/refund?id=${row.id}`)}>
            Record a refund
          </Button>
        ) : null}
        <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/split")}>
          Split
        </Button>
      </WidePane>
      <Dialog
        title="Void this record?"
        open={voidOpen}
        tone="destructive"
        confirmLabel="Void"
        onClose={() => setVoidOpen(false)}
        onConfirm={() => {
          setVoidOpen(false);
          router.replace("/(tabs)/transactions");
        }}
      >
        Voiding keeps the history. It does not delete the money movement from the ledger story.
      </Dialog>
    </TxScreen>
  );
}

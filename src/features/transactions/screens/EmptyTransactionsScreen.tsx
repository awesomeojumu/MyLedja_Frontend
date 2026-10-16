import { useRouter } from "expo-router";
import { EmptyState } from "../../../design";
import { TxScreen } from "../components/TxScreen";

export function EmptyTransactionsScreen() {
  const router = useRouter();
  const add = {
    label: "Add money",
    icon: "plus" as const,
    onPress: () => router.push("/(tabs)/transactions/add-expense"),
  };
  return (
    <TxScreen
      title="Transactions"
      showBack={false}
      emptyTitle="No transactions yet"
      emptyBody="Tap Add money, type the naira amount, then Save."
      emptyAction={add}
      errorTitle="Could not load transactions"
    >
      <EmptyState title="No transactions yet" icon="inbox" action={add}>
        Tap Add money, type the naira amount, then Save.
      </EmptyState>
    </TxScreen>
  );
}

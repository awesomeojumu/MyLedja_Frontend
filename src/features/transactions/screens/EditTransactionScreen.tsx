import { useLocalSearchParams } from "expo-router";
import { transactionById } from "@/features/transactions/dummy-data";
import { AddExpenseScreen } from "@/features/transactions/screens/AddExpenseScreen";

export function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? ""));
  return <AddExpenseScreen kind={row?.kind === "income" ? "income" : "expense"} extras />;
}

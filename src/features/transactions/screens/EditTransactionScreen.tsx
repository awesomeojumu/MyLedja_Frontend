import { useLocalSearchParams } from "expo-router";
import { transactionById } from "../dummy-data";
import { AddExpenseScreen } from "./AddExpenseScreen";

export function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? ""));
  return <AddExpenseScreen kind={row?.kind === "income" ? "income" : "expense"} extras />;
}

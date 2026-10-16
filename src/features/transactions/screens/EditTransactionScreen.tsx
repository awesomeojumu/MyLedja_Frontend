import { useLocalSearchParams } from "expo-router";
import { AddExpenseScreen } from "./AddExpenseScreen";
import { transactionById } from "../dummy-data";

export function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? ""));
  return <AddExpenseScreen kind={row?.kind === "income" ? "income" : "expense"} />;
}

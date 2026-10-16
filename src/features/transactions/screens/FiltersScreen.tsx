import { useRouter } from "expo-router";
import { useState } from "react";
import { Button, ChipGroup } from "../../../design";
import { TxScreen } from "../components/TxScreen";

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];
const WHEN = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

export function FiltersScreen() {
  const router = useRouter();
  const [type, setType] = useState("expense");
  const [when, setWhen] = useState("month");
  return (
    <TxScreen
      title="Filters"
      emptyTitle="No filters"
      errorTitle="Could not apply filters"
      footer={<Button fullWidth onPress={() => router.back()}>Show results</Button>}
    >
      <ChipGroup label="Type" options={TYPES} value={type} onChange={(value) => setType(Array.isArray(value) ? value[0] ?? "expense" : value)} />
      <ChipGroup label="When" options={WHEN} value={when} onChange={(value) => setWhen(Array.isArray(value) ? value[0] ?? "month" : value)} />
    </TxScreen>
  );
}

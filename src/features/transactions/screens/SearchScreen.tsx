import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ChipGroup, EmptyState, FilterButton, Sheet, TextField, TransactionRow, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { TRANSACTIONS } from "@/features/transactions/dummy-data";

const TYPES = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState("all");
  const needle = query.trim().toLowerCase();
  const rows = TRANSACTIONS.filter((row) => {
    if (type !== "all" && row.kind !== type) return false;
    if (!needle) return true;
    return [row.title, row.category, row.account].join(" ").toLowerCase().includes(needle);
  });
  return (
    <TxScreen title="Search and filters" emptyTitle="Nothing matches" emptyBody="Try another word." errorTitle="Could not search">
      <WidePane tablet
        sidebar={
          <View style={{ gap: t.space.space4 }}>
            <TextField label="Find a record" icon="search" placeholder="Shoprite, salary, cash" value={query} onChangeText={setQuery} autoCapitalize="none" returnKeyType="search" />
            <FilterButton count={type === "all" ? 0 : 1} onPress={() => setFiltersOpen(true)} />
          </View>
        }
      >
        {rows.length === 0 ? (
          <EmptyState title="Nothing matches" icon="search">
            Try another word. Dummy records stay on this phone.
          </EmptyState>
        ) : (
          <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
            {rows.map((row) => (
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
        )}
      </WidePane>
      <Sheet title="Filters" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <ChipGroup label="Type" options={TYPES} value={type} onChange={(value) => setType(Array.isArray(value) ? value[0] ?? "all" : value)} />
      </Sheet>
    </TxScreen>
  );
}

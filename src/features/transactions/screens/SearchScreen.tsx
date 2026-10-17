import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ChipGroup, EmptyState, FilterButton, Sheet, TextField, TransactionRow, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { useSession } from "@/state";

const TYPES = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, status, workspaces } = useSession();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const needle = query.trim();

  useEffect(() => {
    if (status !== "signedIn" || !workspaces[0] || needle.length < 2) {
      queueMicrotask(() => setRows([]));
      return;
    }
    void session.search(workspaces[0].id, needle).then((res) => {
      setError(null);
      setRows(res.data.transactions);
    }).catch((err: Error) => {
      setError(err.message);
      setRows([]);
    });
  }, [needle, session, status, workspaces]);

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
        {error ? (
          <EmptyState title="Could not search" icon="triangle-alert">
            {error}
          </EmptyState>
        ) : needle.length > 0 && needle.length < 2 ? (
          <EmptyState title="Type two letters" icon="search">
            Search needs at least two characters.
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing matches" icon="search">
            Try another word. Results come from your workspace.
          </EmptyState>
        ) : (
          <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
            {rows.map((row) => (
              <TransactionRow
                key={row.id}
                title={row.label}
                category="transaction"
                account=""
                amount={0}
                kind="expense"
                time=""
                status={null}
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

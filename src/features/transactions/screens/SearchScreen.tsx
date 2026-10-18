import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { DefaultLoading } from "@/lib/screen-state";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, parseNaira, rowKind } from "@/lib/money-map";
import { Pressable, View } from "react-native";
import { ChipGroup, EmptyState, FilterButton, SectionHeader, Sheet, TextField, TransactionRow, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { flattenSearch, searchGroups, searchHref, type SearchHit } from "@/features/transactions/services/search-hits";
import { useSession } from "@/state";
import { ApiError } from "@/api/client";

const TYPES = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const HEADING: Record<string, string> = {
  transaction: "Transactions",
  account: "Accounts",
  bill: "Bills",
  goal: "Goals",
  debt: "Debts",
};

export function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, status, workspaces } = useSession();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<SearchHit[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [known, setKnown] = useState(false);
  const needle = query.trim();

  useEffect(() => {
    if (status !== "signedIn" || !workspaces[0] || needle.length < 2) {
      queueMicrotask(() => {
        setRows([]);
        setKnown(false);
        setPending(false);
        setError(null);
        setOffline(false);
      });
      return;
    }
    queueMicrotask(() => setPending(true));
    void session
      .search(workspaces[0].id, needle)
      .then((res) => {
        setError(null);
        setOffline(false);
        setRows(flattenSearch(res.data));
        setKnown(true);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 0) {
          setOffline(true);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "Could not search");
        }
        setRows([]);
      })
      .finally(() => setPending(false));
  }, [needle, session, status, workspaces]);

  const visible = rows.filter((row) => type === "all" || row.type === type || row.kind !== "transaction");
  const groups = searchGroups(visible);

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
        <LiveNotice offline={offline} error={error} hasData={known && rows.length > 0} />
        {error && !offline ? (
          <EmptyState title="Could not search" icon="triangle-alert">
            {error}
          </EmptyState>
        ) : needle.length > 0 && needle.length < 2 ? (
          <EmptyState title="Type two letters" icon="search">
            Search needs at least two characters.
          </EmptyState>
        ) : pending && !known ? (
          <DefaultLoading />
        ) : groups.length === 0 && known ? (
          <EmptyState title="Nothing matches" icon="search">
            Try another word. Results come from your workspace.
          </EmptyState>
        ) : pending && !known ? (
          <DefaultLoading />
        ) : (
          <View style={{ gap: t.space.space5 }}>
            {groups.map((group) => (
              <View key={group.kind} style={{ gap: t.space.space2 }}>
                <SectionHeader title={HEADING[group.kind] ?? group.kind} />
                <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
                  {group.rows.map((row) =>
                    row.kind === "transaction" && parseNaira(row.amount) != null ? (
                      <TransactionRow
                        key={`${row.kind}-${row.id}`}
                        title={row.label}
                        category={row.type ?? "transaction"}
                        account=""
                        amount={nairaAmount(row.amount)}
                        kind={rowKind(row.type ?? "expense")}
                        time=""
                        status={null}
                        onPress={() => router.push(searchHref(row) as never)}
                      />
                    ) : (
                      <Pressable key={`${row.kind}-${row.id}`} onPress={() => router.push(searchHref(row) as never)} accessibilityRole="button" accessibilityLabel={row.label} accessibilityHint="Opens the result">
                        <Txt variant="label" style={{ padding: t.space.space4 }}>
                          {row.label}
                        </Txt>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
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

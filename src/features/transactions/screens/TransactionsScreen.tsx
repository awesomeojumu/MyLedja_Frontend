import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  Chip,
  StatTile,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: {} as Record<string, string> };

type FilterKind = "all" | "expense" | "income" | "transfer";

export function TransactionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();

  const [activeFilter, setActiveFilter] = useState<FilterKind>("all");

  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
      ]);
      const names = Object.fromEntries(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      ) as Record<string, string>;
      return { txns: (txRes.data?.transactions ?? []).filter((row) => row.id), names };
    },
    [session],
  );

  const { data, loading, offline, error, refresh } = useLiveQuery(
    load,
    EMPTY,
    "transactions-feed",
  );

  const allTxns = data?.txns ?? [];
  const names = data?.names ?? EMPTY.names;

  const filtered = allTxns.filter((tx) => {
    if (activeFilter === "all") return true;
    return tx.type === activeFilter;
  });

  // Calculate monthly stats
  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of allTxns) {
    if (tx.status === "voided" || tx.status === "reversed") continue;
    const amt = Number(tx.amount || "0");
    if (tx.type === "income") totalIncome += amt;
    else if (tx.type === "expense") totalExpense += amt;
  }

  // Group by day
  const grouped = new Map<string, ApiTransaction[]>();
  for (const tx of filtered) {
    const day = tx.occurredAt ? tx.occurredAt.slice(0, 10) : "Recent";
    const current = grouped.get(day) ?? [];
    grouped.set(day, [...current, tx]);
  }

  return (
    <PageScaffold
      title="Transactions"
      showBack={false}
      loading={loading}
      offline={offline}
      error={error}
      onRetry={refresh}
      actions={[
        { icon: "calendar", label: "Calendar", onPress: () => router.push("/(tabs)/transactions/calendar") },
        { icon: "list-filter", label: "Bulk", onPress: () => router.push("/(tabs)/transactions/bulk") },
        { icon: "search", label: "Search", onPress: () => router.push("/(tabs)/transactions/search") },
      ]}
      empty={allTxns.length === 0}
      emptyTitle="No transactions yet"
      emptyBody="Use + to record an expense, income, or transfer."
      emptyAction={{
        label: "Record an expense",
        onPress: () => router.push("/(tabs)/transactions/add-expense"),
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatTile
          label="Money in"
          value={totalIncome}
          kind="income"
          icon="arrow-down-left"
        />
        <StatTile
          label="Money out"
          value={totalExpense}
          kind="spent"
          icon="arrow-up-right"
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
        <Chip
          selected={activeFilter === "all"}
          onPress={() => setActiveFilter("all")}
        >
          All
        </Chip>
        <Chip
          selected={activeFilter === "expense"}
          onPress={() => setActiveFilter("expense")}
        >
          Expenses
        </Chip>
        <Chip
          selected={activeFilter === "income"}
          onPress={() => setActiveFilter("income")}
        >
          Income
        </Chip>
        <Chip
          selected={activeFilter === "transfer"}
          onPress={() => setActiveFilter("transfer")}
        >
          Transfers
        </Chip>
      </View>

      <View style={{ gap: t.space.space4, marginTop: t.space.space2 }}>
        {Array.from(grouped.entries()).map(([day, rows]) => (
          <View key={day} style={{ gap: 6 }}>
            <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600", textTransform: "uppercase" }}>
              {day}
            </Txt>
            <View
              style={{
                borderRadius: t.radius.radiusLg,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: t.c.borderStrong,
                backgroundColor: t.c.surface,
              }}
            >
              {rows.map((row) => (
                <TransactionRow
                  key={String(row.id)}
                  title={row.description || "Transaction"}
                  category={row.type}
                  account={names[String(row.accountId)] ?? ""}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </PageScaffold>
  );
}

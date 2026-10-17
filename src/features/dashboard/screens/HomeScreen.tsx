import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EmptyState,
  HeroBalance,
  IconButton,
  maxWidth,
  Rise,
  SectionHeader,
  SegmentedControl,
  StatTile,
  SummaryCard,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { twoColumn } from "@/lib";
import { getSnapshot, putSnapshot, cacheKey, dashboardBounds, lastSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useDashboardOverlays } from "@/features/dashboard/overlay-context";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { useSession } from "@/state";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function HomeScreen({ onMore }: { onMore?: () => void } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openSearch } = useDashboardOverlays();
  const { session, status, workspaces } = useSession();
  const signedIn = status === "signedIn";
  const [hidden, setHidden] = useState(false);
  const [period, setPeriod] = useState("today");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(() => lastSnapshot() ?? null);
  const [recent, setRecent] = useState<{ row: ApiTransaction; account: string }[]>([]);
  const columns = twoColumn(t.widthClass, t.portrait);
  const workspaceId = workspaces[0]?.id;

  const load = useCallback(() => {
    if (!signedIn || !workspaceId) return;
    const range = dashboardBounds(period);
    const key = cacheKey(workspaceId, range.from, range.to);
    const cached = getSnapshot(key) ?? lastSnapshot();
    if (cached) setSnapshot(cached);
    void session.dashboard(workspaceId, range.from, range.to).then((res) => {
      setSnapshot(putSnapshot(key, res.data as unknown as DashboardSnapshot));
    }).catch(() => {
      if (!cached) setSnapshot(lastSnapshot() ?? null);
    });
    void Promise.all([session.listTransactions(workspaceId), session.listAccounts(workspaceId)])
      .then(([txRes, accountsRes]) => {
        const names = new Map(
          (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((item) => {
            const account = toLedgerAccount(item as ApiAccount);
            return [account.id, account.name] as const;
          }),
        );
        const txns = (txRes.data.transactions ?? []).slice(-5).reverse();
        setRecent(txns.map((row) => ({ row, account: names.get(String(row.accountId)) ?? "" })));
      })
      .catch(() => {
        setRecent([]);
      });
  }, [signedIn, workspaceId, period, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const naira = (value?: string) => Number.parseFloat(value ?? "0") || 0;

  const hero = (
    <Rise delay={0}>
      <HeroBalance
        value={naira(snapshot?.netWorth.value)}
        currency="NGN"
        freshness="Live"
        hidden={hidden}
        onToggleHidden={() => setHidden((prev) => !prev)}
      />
    </Rise>
  );

  const stats = (
    <Rise delay={40}>
      <View style={{ flexDirection: "row", gap: t.space.space3 }}>
        <StatTile label="Spent" value={naira(snapshot?.expense.value)} kind="spent" icon="arrow-down-left" hidden={hidden} />
        <StatTile label="In" value={naira(snapshot?.income.value)} kind="income" icon="arrow-up-right" hidden={hidden} />
      </View>
    </Rise>
  );

  const summary = (
    <Rise delay={80}>
      <View style={{ gap: t.space.space3 }}>
        <SegmentedControl label="Period" options={PERIODS} value={period} onChange={setPeriod} />
        {snapshot ? (
          <SummaryCard
            label="Spent"
            value={naira(snapshot.expense.value)}
            kind="expense"
            hidden={hidden}
            freshness={snapshot.expense.basis}
          />
        ) : (
          <EmptyState title="Nothing recorded for this period" icon="calendar">
            Add a posted expense to see this range.
          </EmptyState>
        )}
      </View>
    </Rise>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + t.space.space4,
          paddingHorizontal: t.space.space4,
          paddingBottom: t.space.space12,
          gap: t.space.space5,
          maxWidth: maxWidth.widthContent,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt variant="titleMd" accessibilityRole="header">
            Home
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton icon="search" label="Search" onPress={openSearch} />
            {onMore ? <IconButton icon="ellipsis" label="More" onPress={onMore} /> : null}
          </View>
        </View>
        {columns ? (
          <View style={{ flexDirection: "row", gap: t.space.space6, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              {hero}
              {stats}
              {summary}
            </View>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              <SectionHeader title="Budgets" meta={snapshot?.budgetRemaining.basis ?? "Account budgets"} />
              <Txt variant="body">{snapshot ? `Remaining ${snapshot.budgetRemaining.value}` : "No snapshot yet."}</Txt>
              <SectionHeader title="Recent" action={{ label: "See all", onPress: () => router.push("/(tabs)/transactions") }} />
              {recent.map(({ row, account }) => (
                <TransactionRow
                  key={String(row.id)}
                  title={row.description || "Transaction"}
                  category={row.type}
                  account={account}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  hidden={hidden}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            {hero}
            {stats}
            {summary}
            <SectionHeader title="Budgets" />
            <Txt variant="body">{snapshot ? `Remaining ${snapshot.budgetRemaining.value}` : "No snapshot yet."}</Txt>
            <SectionHeader title="Recent" action={{ label: "See all", onPress: () => router.push("/(tabs)/transactions") }} />
            {recent.length === 0 ? (
              <Txt variant="body" color={t.c.inkMuted}>
                Nothing recorded yet
              </Txt>
            ) : (
              recent.map(({ row, account }) => (
                <TransactionRow
                  key={String(row.id)}
                  title={row.description || "Transaction"}
                  category={row.type}
                  account={account}
                  amount={nairaAmount(row.amount)}
                  kind={rowKind(row.type)}
                  hidden={hidden}
                  onPress={() => router.push(`/(tabs)/transactions/${row.id}`)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

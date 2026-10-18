import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { createLatestGate } from "@/lib/take-latest";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
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
import { ApiError } from "@/api/client";
import { onMoneyWrite } from "@/lib/after-money";
import { LiveNotice } from "@/lib/live-notice";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import { homePendingModel } from "@/features/dashboard/services/home-pending";
import { pendingBadge } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { readCache, scopedKey, writeCache } from "@/lib/offline-cache";
import { DefaultLoading } from "@/lib/screen-state";
import { remainingText } from "@/lib/budget-text";
import { useSession } from "@/state";

type RecentRow = { row: ApiTransaction; account: string };

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
  const { session, status, workspaces, user, offline: sessionOffline } = useSession();
  const signedIn = status === "signedIn";
  const [hidden, setHidden] = useState(false);
  const [period, setPeriod] = useState("today");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(() => lastSnapshot() ?? null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [recentKnown, setRecentKnown] = useState(false);
  const [budgetCount, setBudgetCount] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const columns = twoColumn(t.widthClass, t.portrait);
  const workspaceId = workspaces[0]?.id;
  const latest = useRef(createLatestGate()).current;

  const load = useCallback(() => {
    if (!signedIn || !workspaceId) return;
    const ticket = latest.begin();
    const userId = user?.userId ?? "anon";
    const range = dashboardBounds(period);
    const key = cacheKey(workspaceId, range.from, range.to);
    const deviceKey = scopedKey(userId, workspaceId, `dashboard:${period}`);
    const recentKey = scopedKey(userId, workspaceId, "home-recent");
    const budgetsKey = scopedKey(userId, workspaceId, "home-budget-count");
    const savedBudgets = readCache<number>(budgetsKey);
    if (typeof savedBudgets === "number") setBudgetCount(savedBudgets);
    const cached = getSnapshot(key) ?? readCache<DashboardSnapshot>(deviceKey) ?? lastSnapshot();
    if (cached) setSnapshot(cached);
    const savedRecent = readCache<RecentRow[]>(recentKey);
    if (savedRecent && savedRecent.length > 0) {
      setRecent(savedRecent);
      setRecentKnown(true);
    }
    const failed = (caught: unknown) => {
      if (!ticket.isCurrent()) return;
      if (caught instanceof ApiError && caught.status === 0) setOffline(true);
      else setLoadError(caught instanceof Error && caught.message ? caught.message : "Something went wrong. Try again.");
    };
    void session.dashboard(workspaceId, range.from, range.to).then((res) => {
      const next = res.data as unknown as DashboardSnapshot;
      ticket.apply(next, (value) => {
        writeCache(deviceKey, value);
        setSnapshot(putSnapshot(key, value));
        setOffline(false);
        setLoadError(null);
      });
    }).catch(failed);
    void session
      .listCollection(workspaceId, "budgets")
      .then((res) => {
        const count = Array.isArray(res.data) ? res.data.length : 0;
        ticket.apply(count, (value) => {
          writeCache(budgetsKey, value);
          setBudgetCount(value);
        });
      })
      .catch(() => undefined);
    void Promise.all([session.listTransactions(workspaceId), session.listAccounts(workspaceId)])
      .then(([txRes, accountsRes]) => {
        if (user) rememberAccountOptions(user.userId, workspaceId, accountsRes.data);
        const names = new Map(
          (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((item) => {
            const account = toLedgerAccount(item as ApiAccount);
            return [account.id, account.name] as const;
          }),
        );
        const txns = (txRes.data.transactions ?? []).slice(-5).reverse();
        const rows = txns.map((row) => ({ row, account: names.get(String(row.accountId)) ?? "" }));
        ticket.apply(rows, (value) => {
          writeCache(recentKey, value);
          setRecent(value);
          setRecentKnown(true);
        });
      })
      .catch(failed);
  }, [signedIn, workspaceId, period, session, user, latest]);

  useFocusEffect(
    useCallback(() => {
      load();
      return onMoneyWrite(() => load());
    }, [load]),
  );

  const queued = user
    ? outboxForUser(user.userId)
        .list(user.userId)
        .filter((row) => pendingBadge(row.syncStatus))
        .map((row) => ({ operationId: row.operationId, payload: row.payload as { description?: string; amount?: string } }))
    : [];
  const pending = homePendingModel({
    sessionOffline: Boolean(offline || sessionOffline),
    queued,
    postedSpent: snapshot?.expense.value ?? "0.00",
  });

  const naira = (value?: string) => Number.parseFloat(value ?? "0") || 0;

  const hero = !snapshot ? (
    <DefaultLoading />
  ) : (
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

  const budgets = (
    <View style={{ gap: t.space.space2 }}>
      <SectionHeader title="Budgets" meta={budgetCount ? "Left this period" : undefined} />
      {budgetCount === 0 ? (
        <View style={{ gap: 4, alignItems: "flex-start" }}>
          <Txt variant="body" color={t.c.inkMuted}>
            No budgets yet
          </Txt>
          <Button variant="tertiary" size="sm" icon="plus" onPress={() => router.push("/(tabs)/plan/budgets")}>
            Add a budget
          </Button>
        </View>
      ) : budgetCount != null && snapshot ? (
        <Txt variant="body" accessibilityLabel={hidden ? "Budget remaining hidden" : undefined}>
          {hidden ? "₦ ••••••" : remainingText(snapshot.budgetRemaining.value)}
        </Txt>
      ) : (
        <Txt variant="body" color={t.c.inkMuted}>
          {offline || sessionOffline ? "Not saved on this phone yet." : "Loading…"}
        </Txt>
      )}
    </View>
  );

  const stats = !snapshot ? null : (
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
          <>
            <SummaryCard
              label="Spent"
              value={naira(snapshot.expense.value)}
              kind="expense"
              hidden={hidden}
            />
            {pending.waitingLine ? (
              <Txt variant="caption" color={t.c.inkMuted}>
                {pending.waitingLine}
              </Txt>
            ) : null}
          </>
        ) : null}
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
        <LiveNotice offline={offline || pending.offline} error={loadError} hasData={snapshot != null || recentKnown} onRetry={load} />
        {columns ? (
          <View style={{ flexDirection: "row", gap: t.space.space6, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              {hero}
              {stats}
              {summary}
            </View>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              {budgets}
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
              {pending.pendingRows.map((row) => (
                <TransactionRow
                  key={row.id}
                  title={row.description}
                  category="Waiting to sync"
                  account=""
                  amount={nairaAmount(row.amount)}
                  kind="expense"
                  hidden={hidden}
                  status="pending"
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            {hero}
            {stats}
            {summary}
            {budgets}
            <SectionHeader title="Recent" action={{ label: "See all", onPress: () => router.push("/(tabs)/transactions") }} />
            {recent.length === 0 && pending.pendingRows.length === 0 ? (
              <Txt variant="body" color={t.c.inkMuted}>
                {recentKnown ? "Nothing recorded yet" : offline ? "Not saved on this phone yet." : "Loading…"}
              </Txt>
            ) : (
              <>
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
                {pending.pendingRows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    title={row.description}
                    category="Waiting to sync"
                    account=""
                    amount={nairaAmount(row.amount)}
                    kind="expense"
                    hidden={hidden}
                    status="pending"
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

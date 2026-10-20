import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { createLatestGate } from "@/lib/take-latest";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, BarChart, Button, CategoryBreakdown, LineChart, maxWidth, Rise, SectionHeader, Txt, useTheme } from "@/design";
import { twoColumn } from "@/lib";
import { getSnapshot, putSnapshot, cacheKey, dashboardBounds, lastSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useDashboardOverlays } from "@/features/dashboard/overlay-context";
import { BudgetCard, DashCard, EmptyChart, HomeHero, QuickActions, RecentGroups, weekLine, type QuickAction } from "@/features/dashboard/components/HomeParts";
import {
  availableBalance,
  budgetSummary,
  categorySpend,
  greeting,
  groupRecent,
  initialsFromEmail,
  monthlyFlow,
  weekSpend,
  type AvailableBalance,
  type BudgetRow,
  type BudgetSummary,
  type RecentGroup,
} from "@/features/dashboard/services/home-model";
import { ApiError } from "@/api/client";
import { onMoneyWrite } from "@/lib/after-money";
import { LiveNotice } from "@/lib/live-notice";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import { homePendingModel } from "@/features/dashboard/services/home-pending";
import { pendingBadge } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { nairaAmount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { readCache, scopedKey, writeCache } from "@/lib/offline-cache";
import { DefaultLoading } from "@/lib/screen-state";
import { goalNudge } from "@/features/plans-goals/services/goal-pace";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";

type RecentRow = { row: ApiTransaction; account: string };

/** Home always reads this month: In and Out on the hero, and the budget period, are monthly. */
const PERIOD = "month";
const RECENT_COUNT = 6;
/** Enough history for the six-month chart on wide screens. */
const LEDGER_COUNT = 1000;

function freshnessText(syncedAt: number | null, now = Date.now()): string | null {
  if (syncedAt == null) return null;
  const minutes = Math.floor((now - syncedAt) / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  return "Updated earlier";
}

export function HomeScreen({ onMore }: { onMore?: () => void } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openSearch, requestAdd } = useDashboardOverlays();
  const { session, status, user, offline: sessionOffline } = useSession();
  const { workspaceId, workspace } = useActiveWorkspace();
  const signedIn = status === "signedIn";
  const [hidden, setHidden] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(() => lastSnapshot() ?? null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [recentKnown, setRecentKnown] = useState(false);
  const [balance, setBalance] = useState<AvailableBalance | null>(null);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [budgetKnown, setBudgetKnown] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [ledger, setLedger] = useState<ApiTransaction[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const columns = twoColumn(t.widthClass, t.portrait);
  /** Desktop and landscape tablets get the dashboard: hero actions inline, plus charts. */
  const wide = (t.widthClass === "expanded" || t.widthClass === "large") && !t.portrait;

  const latest = useRef(createLatestGate()).current;

  const load = useCallback(() => {
    if (!signedIn || !workspaceId) return;
    const ticket = latest.begin();
    const userId = user?.userId ?? "anon";
    const range = dashboardBounds(PERIOD);
    const key = cacheKey(workspaceId, range.from, range.to);
    const deviceKey = scopedKey(userId, workspaceId, `dashboard:${PERIOD}`);
    const recentKey = scopedKey(userId, workspaceId, "home-recent");
    const budgetKey = scopedKey(userId, workspaceId, "home-budget");
    const balanceKey = scopedKey(userId, workspaceId, "home-balance");
    const savedBudget = readCache<{ summary: BudgetSummary | null }>(budgetKey);
    if (savedBudget) {
      setBudget(savedBudget.summary);
      setBudgetKnown(true);
    }
    const savedBalance = readCache<AvailableBalance>(balanceKey);
    if (savedBalance) setBalance(savedBalance);
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
        setSyncedAt(Date.now());
        setOffline(false);
        setLoadError(null);
      });
    }).catch(failed);
    void session
      .listCollection(workspaceId, "budgets")
      .then((res) => {
        const rows = (Array.isArray(res.data) ? res.data : []) as BudgetRow[];
        ticket.apply(budgetSummary(rows), (value) => {
          writeCache(budgetKey, { summary: value });
          setBudget(value);
          setBudgetKnown(true);
        });
      })
      .catch(() => undefined);
    void session
      .listGoals(workspaceId)
      .then((res) => {
        const rows = ((res.data ?? []) as { name?: string; target?: string; saved?: string; dueAt?: string | null }[]).map((row) => ({
          name: row.name,
          target: nairaAmount(row.target),
          saved: nairaAmount(row.saved),
          dueAt: row.dueAt,
        }));
        ticket.apply(goalNudge(rows)?.text ?? null, setNudge);
      })
      .catch(() => undefined);
    void Promise.all([session.listTransactions(workspaceId), session.listAccounts(workspaceId)])
      .then(([txRes, accountsRes]) => {
        if (user) rememberAccountOptions(user.userId, workspaceId, accountsRes.data);
        const accounts = (Array.isArray(accountsRes.data) ? accountsRes.data : []) as ApiAccount[];
        const names = new Map(accounts.map((item) => [String(item.id), item.name ?? ""] as const));
        const all = txRes.data.transactions ?? [];
        const txns = all.slice(-RECENT_COUNT).reverse();
        const rows = txns.map((row) => ({ row, account: names.get(String(row.accountId)) ?? "" }));
        ticket.apply({ rows, balance: availableBalance(accounts), ledger: all.slice(-LEDGER_COUNT) }, (value) => {
          writeCache(recentKey, value.rows);
          writeCache(balanceKey, value.balance);
          setRecent(value.rows);
          setRecentKnown(true);
          setBalance(value.balance);
          setLedger(value.ledger);
        });
      })
      .catch(failed);
    if (wide) {
      void session
        .listCategories(workspaceId)
        .then((res) => {
          const names: Record<string, string> = {};
          for (const row of Array.isArray(res.data) ? res.data : []) names[String(row.id)] = row.name;
          ticket.apply(names, setCategoryNames);
        })
        .catch(() => undefined);
    }
  }, [signedIn, workspaceId, session, user, latest, wide]);

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

  const groups: RecentGroup[] = groupRecent(recent);
  if (pending.pendingRows.length > 0) {
    groups.unshift({
      label: "Waiting to sync",
      net: 0,
      items: pending.pendingRows.map((row) => ({
        id: row.id,
        title: row.description,
        account: "",
        amount: nairaAmount(row.amount),
        kind: "expense" as const,
        time: "",
        pending: true,
      })),
    });
  }

  const quickActions: QuickAction[] = [
    { label: "Expense", icon: "receipt", onPress: () => requestAdd("expense") },
    { label: "Income", icon: "banknote", onPress: () => requestAdd("income") },
    { label: "Transfer", icon: "arrow-left-right", onPress: () => router.push("/(tabs)/accounts/transfer") },
    { label: "Insights", icon: "chart-pie", onPress: () => router.push("/(tabs)/insights") },
  ];

  const hero = (
    <HomeHero
      wide={wide}
      actions={quickActions}
      topInset={insets.top}
      initials={initialsFromEmail(user?.email)}
      greeting={greeting()}
      workspace={workspace?.name ?? "Home"}
      balance={balance ? balance.total : null}
      freshness={offline || sessionOffline ? "Saved on this phone" : freshnessText(syncedAt)}
      moneyIn={snapshot ? nairaAmount(snapshot.income.value) : null}
      moneyOut={snapshot ? nairaAmount(snapshot.expense.value) : null}
      hidden={hidden}
      onToggleHidden={() => setHidden((prev) => !prev)}
      onProfile={onMore}
      onSearch={openSearch}
      onUpcoming={() => router.push("/(tabs)/upcoming")}
      onCashFlow={() => router.push("/(tabs)/cash-flow")}
    />
  );


  const budgetSection = budget ? (
    <BudgetCard summary={budget} hidden={hidden} onPress={() => router.push("/(tabs)/plan/budgets")} />
  ) : budgetKnown ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, padding: t.space.space4, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="titleSm">Plan this month</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted}>{"Set a budget to see what's left as you spend."}</Txt>
      </View>
      <Button variant="secondary" size="sm" onPress={() => router.push("/(tabs)/plan/budget-add")}>
        Add budget
      </Button>
    </View>
  ) : null;

  const recentSection = (
    <View style={{ gap: t.space.space3 }}>
      <SectionHeader title="Recent" action={{ label: "See all", onPress: () => router.push("/(tabs)/transactions") }} />
      {pending.waitingLine ? (
        <Txt variant="caption" color={t.c.inkMuted}>
          {pending.waitingLine}
        </Txt>
      ) : null}
      {groups.length === 0 ? (
        recentKnown ? (
          <View style={{ gap: t.space.space2, alignItems: "flex-start" }}>
            <Txt variant="body" color={t.c.inkMuted}>
              Nothing recorded yet. Your first expense or income shows up here.
            </Txt>
            <Button variant="tertiary" size="sm" icon="plus" onPress={() => requestAdd("expense")}>
              Add an expense
            </Button>
          </View>
        ) : offline ? (
          <Txt variant="body" color={t.c.inkMuted}>Not saved on this phone yet.</Txt>
        ) : (
          <DefaultLoading />
        )
      ) : (
        <RecentGroups groups={groups} hidden={hidden} onOpen={(id) => router.push(`/(tabs)/transactions/${id}`)} />
      )}
    </View>
  );

  if (wide) {
    const week = weekSpend(ledger);
    const cats = categorySpend(ledger, categoryNames);
    const flow = monthlyFlow(ledger);
    const hasFlow = flow.income.some((v) => v > 0) || flow.expense.some((v) => v > 0);
    const loading = !recentKnown;
    const chartBody = (empty: boolean, emptyText: string, chart: ReactNode) =>
      loading ? <DefaultLoading /> : hidden ? <EmptyChart text="Amounts hidden" /> : empty ? <EmptyChart text={emptyText} /> : chart;
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 }}>
          <Rise delay={0}>{hero}</Rise>
          <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", padding: t.space.space6, gap: t.space.space5 }}>
            <LiveNotice offline={offline || pending.offline} error={loadError} hasData={snapshot != null || recentKnown} onRetry={load} />
            {nudge ? <Banner tone="warning" title={nudge} /> : null}
            <Rise delay={40}>
              <View style={{ flexDirection: "row", gap: t.space.space5, alignItems: "flex-start" }}>
                <View style={{ flex: 3, minWidth: 0, gap: t.space.space5 }}>
                  <DashCard title="Last 7 days" meta={hidden || loading ? undefined : weekLine(week.total, week.previous)} action={{ label: "Cash flow", onPress: () => router.push("/(tabs)/cash-flow") }}>
                    {chartBody(
                      week.total === 0 && week.previous === 0,
                      "No spending in the last two weeks",
                      <BarChart data={week.days} series={["This week", "Last week"]} highlight="Today" height={220} />,
                    )}
                  </DashCard>
                  <DashCard title="Money in vs out" meta="Last 6 months">
                    {chartBody(
                      !hasFlow,
                      "Record income and expenses to see the trend",
                      <LineChart labels={flow.labels} series={[{ name: "Money in", values: flow.income }, { name: "Money out", values: flow.expense }]} height={220} />,
                    )}
                  </DashCard>
                  <DashCard title="Where it went" meta="This month" action={{ label: "Insights", onPress: () => router.push("/(tabs)/insights") }}>
                    {chartBody(cats.length === 0, "No spending yet this month", <CategoryBreakdown items={cats} />)}
                  </DashCard>
                </View>
                <View style={{ flex: 2, minWidth: 280, gap: t.space.space6 }}>
                  {budgetSection ?? <DefaultLoading />}
                  {recentSection}
                </View>
              </View>
            </Rise>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <Rise delay={0}>{hero}</Rise>
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
          <Rise delay={40}>
            <QuickActions actions={quickActions} />
          </Rise>
          <View style={{ paddingHorizontal: t.space.space4, paddingTop: t.space.space5, gap: t.space.space6 }}>
            <LiveNotice offline={offline || pending.offline} error={loadError} hasData={snapshot != null || recentKnown} onRetry={load} />
            {nudge ? <Banner tone="warning" title={nudge} /> : null}
            {columns ? (
              <View style={{ flexDirection: "row", gap: t.space.space6, alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>{budgetSection}</View>
                <View style={{ flex: 1 }}>{recentSection}</View>
              </View>
            ) : (
              <>
                <Rise delay={80}>{budgetSection}</Rise>
                <Rise delay={120}>{recentSection}</Rise>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

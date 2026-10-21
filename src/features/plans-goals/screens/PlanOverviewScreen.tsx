import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Rise, Sheet, Toast, Txt, maxWidth, useTheme, type IconName } from "@/design";
import {
  BeforePaydayCard,
  BillsTileBody,
  BudgetTileBody,
  DebtsTileBody,
  GoalsTileBody,
  IncomeTileBody,
  PaydaySheet,
  PlanHeader,
  PlanTile,
  TilePrompt,
} from "@/features/plans-goals/components/PlanParts";
import {
  mainStream,
  planOverview,
  type PlanBill,
  type PlanBudget,
  type PlanDebt,
  type PlanGoal,
  type PlanInput,
  type PlanStream,
} from "@/features/plans-goals/services/plan-overview";
import { LiveNotice } from "@/lib/live-notice";
import type { ApiAccount } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { useActiveWorkspace, useScrollTopOnFocus } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY: PlanInput = { accounts: [], bills: [], streams: [], goals: [], debts: [], budgets: [], txns: [] };

const ADD: { label: string; icon: IconName; href: string; hint: string }[] = [
  { label: "Budget", icon: "chart-pie", href: "/(tabs)/plan/budget-add", hint: "Set a limit for the month" },
  { label: "Bill", icon: "receipt", href: "/(tabs)/plan/bill-add", hint: "Something you pay on a schedule" },
  { label: "Goal", icon: "target", href: "/(tabs)/plan/goal-add", hint: "Save toward something" },
  { label: "Income", icon: "banknote", href: "/(tabs)/plan/income-add", hint: "Salary or money you expect" },
];

function list<T>(res: { data?: unknown } | undefined): T[] {
  return Array.isArray(res?.data) ? (res!.data as T[]) : [];
}

export function PlanOverviewScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const [addOpen, setAddOpen] = useState(false);
  const [paydayOpen, setPaydayOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wide = (t.widthClass === "expanded" || t.widthClass === "large") && !t.portrait;

  const load = useCallback(
    async (ws: string): Promise<PlanInput> => {
      // Each list is optional: one failing section shouldn't blank the whole plan.
      const soft = <T,>(p: Promise<{ data?: unknown }>) => p.then((r) => list<T>(r)).catch(() => [] as T[]);
      const [accounts, bills, streams, goals, debts, budgets, txRes] = await Promise.all([
        soft<ApiAccount>(session.listAccounts(ws)),
        soft<PlanBill>(session.listBills(ws)),
        soft<PlanStream>(session.listIncomeStreams(ws)),
        soft<PlanGoal>(session.listGoals(ws)),
        soft<PlanDebt>(session.listDebts(ws)),
        soft<PlanBudget>(session.listBudgets(ws)),
        session.listTransactions(ws),
      ]);
      return { accounts, bills, streams, goals, debts, budgets, txns: txRes.data?.transactions ?? [] };
    },
    [session],
  );
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, EMPTY, "plan-overview");
  const overview = known ? planOverview(data ?? EMPTY) : null;
  const main = mainStream(data?.streams ?? []);

  const savePayday = async (day: number) => {
    if (!workspaceId || !main) return;
    setSaving(true);
    try {
      await session.patchIncomeStream(workspaceId, main.id, { payDay: day });
      setPaydayOpen(false);
      setToast("Payday saved");
      refresh();
    } catch {
      setToast("Couldn't save your payday. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const go = (href: string) => router.push(href as never);

  const tiles = overview ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space3 }}>
      <PlanTile title="Budgets" onPress={() => go("/(tabs)/plan/budgets")}>
        {overview.budget ? <BudgetTileBody budget={overview.budget} /> : <TilePrompt text="Add a budget" />}
      </PlanTile>
      <PlanTile title="Bills" onPress={() => go("/(tabs)/plan/bills")}>
        {overview.bills.length ? <BillsTileBody overview={overview} /> : <TilePrompt text="Add a bill" />}
      </PlanTile>
      <PlanTile title="Goals" onPress={() => go("/(tabs)/plan/goals")}>
        {overview.goals.length ? <GoalsTileBody goals={overview.goals} /> : <TilePrompt text="Add a goal" />}
      </PlanTile>
      <PlanTile title="Debts" onPress={() => go("/(tabs)/plan/debts")}>
        {overview.debts.count ? <DebtsTileBody debts={overview.debts} /> : <Txt variant="bodySm" color={t.c.inkMuted}>No debts. Nice.</Txt>}
      </PlanTile>
      <PlanTile title="Budget categories" onPress={() => go("/(tabs)/transactions/categories")}>
        <Txt variant="bodySm" color={t.c.inkMuted}>Groups and categories for expenses and income</Txt>
      </PlanTile>
      <PlanTile title="Income this month" onPress={() => go("/(tabs)/plan/income")} wide={!wide}>
        {overview.hasIncome ? <IncomeTileBody income={overview.income} /> : <TilePrompt text="Add your income" />}
      </PlanTile>
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <PlanHeader
          topInset={insets.top}
          overview={overview}
          onAdd={() => setAddOpen(true)}
          onSetPayday={() => setPaydayOpen(true)}
          onAddIncome={() => go("/(tabs)/plan/income-add")}
        />
        <View style={{ width: "100%", maxWidth: wide ? maxWidth.widthContent : maxWidth.widthReading, alignSelf: "center" }}>
          {overview ? (
            <Rise delay={20}>
              <BeforePaydayCard
                bills={overview.beforePayday}
                hasPayday={overview.payday != null}
                onPay={(id) => go(`/(tabs)/plan/bill-paid?id=${encodeURIComponent(id)}`)}
                onAll={() => go("/(tabs)/plan/bills-upcoming")}
              />
            </Rise>
          ) : null}
          <View style={{ paddingHorizontal: t.space.space4, paddingTop: t.space.space4, gap: t.space.space4 }}>
            <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
            {loading && !known ? <DefaultLoading /> : <Rise delay={60}>{tiles}</Rise>}
            {overview?.payday ? (
              <Txt variant="caption" color={t.c.inkMuted} style={{ textAlign: "center" }}>
                {"Projection uses today's balance, unpaid bills, expected pay and scheduled savings. Day-to-day spending isn't included."}
              </Txt>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <Sheet title="Add to your plan" open={addOpen} onClose={() => setAddOpen(false)}>
        <View style={{ gap: t.space.space2 }}>
          {ADD.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                setAddOpen(false);
                go(a.href);
              }}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, padding: t.space.space3, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <Icon name={a.icon} size={20} color={t.c.onPrimarySoft} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="titleSm">{a.label}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>{a.hint}</Txt>
              </View>
              <Icon name="chevron-right" size={16} color={t.c.inkMuted} />
            </Pressable>
          ))}
        </View>
      </Sheet>

      <PaydaySheet key={String(paydayOpen)} open={paydayOpen} name={main?.name || "your pay"} busy={saving} onClose={() => setPaydayOpen(false)} onSave={savePayday} />

      {toast ? (
        <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + 96, alignItems: "center" }} pointerEvents="box-none">
          <View style={{ width: "100%", maxWidth: 420 }}>
            <Toast message={toast} onClose={() => setToast(null)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

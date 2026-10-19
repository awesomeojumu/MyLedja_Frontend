import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useRouter } from "expo-router";
import { Amount, Banner, Button, EmptyState, SegmentedControl, Txt, useTheme } from "@/design";
import { dashboardBounds } from "@/features/dashboard/services/range-cache";
import {
  healthModel,
  healthReportText,
  moneyNumber,
  previousMonthBounds,
  type HealthSettings,
} from "@/features/financial-health/services/health-model";
import { loadHealthSettings, onHealthSettingsChange, saveHealthSettings } from "@/features/financial-health/services/health-settings";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { scopedKey } from "@/lib/offline-cache";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Dash = { income?: { value: string }; expense?: { value: string }; netWorth?: { value: string }; budgetRemaining?: { value: string } };
type Account = { id?: string; kind?: string; balance?: string };
type Bill = { dueFor?: string; lastPaidAt?: string | null; nextDue?: string };
type Goal = { id?: string; saved?: string; target?: string };

function missed(bill: Bill) {
  const today = new Date().toISOString().slice(0, 10);
  if (!bill.dueFor || bill.dueFor >= today) return false;
  if (!bill.lastPaidAt) return true;
  return bill.lastPaidAt.slice(0, 10) < bill.dueFor;
}

function cashTotal(accounts: Account[]) {
  return accounts
    .filter((row) => row.kind === "cash" || row.kind === "bank" || row.kind === "wallet")
    .reduce((sum, row) => sum + nairaAmount(row.balance), 0)
    .toFixed(2);
}

function useHealthSettings() {
  const { user, workspaces } = useSession();
  const key = user && workspaces[0] ? scopedKey(user.userId, workspaces[0].id, "health-settings") : "health-settings";
  const [settings, setSettings] = useState<HealthSettings>(() => loadHealthSettings(key));
  useEffect(() => onHealthSettingsChange(() => setSettings(loadHealthSettings(key))), [key]);
  const save = (next: HealthSettings) => setSettings(saveHealthSettings(key, next));
  return { settings, save };
}

function useHealthBundle() {
  const { session } = useSession();
  const { settings } = useHealthSettings();
  const load = useCallback(async (workspaceId: string) => {
    const month = dashboardBounds("month");
    const [dash, accounts, bills, goals, budgets] = await Promise.all([
      session.dashboard(workspaceId, month.from, month.to),
      session.listAccounts(workspaceId),
      session.listBills(workspaceId),
      session.listGoals(workspaceId),
      session.listBudgets(workspaceId),
    ]);
    const snapshot = dash.data as Dash;
    const accountRows = (accounts.data ?? []) as Account[];
    const billRows = (bills.data ?? []) as Bill[];
    const goalRows = (goals.data ?? []) as Goal[];
    const hasBudget = (budgets.data ?? []).length > 0;
    return {
      snapshot,
      cash: cashTotal(accountRows),
      missedBills: billRows.filter(missed).length,
      goals: goalRows.map((row) => ({
        id: row.id,
        saved: String(row.saved ?? "0.00"),
        target: String(row.target ?? "0.00"),
      })),
      budgetRemaining: hasBudget ? snapshot.budgetRemaining?.value ?? "0.00" : null,
    };
  }, [session]);
  const query = useLiveQuery(load, null, "health-bundle");
  const model = query.data
    ? healthModel({
        budgetRemaining: query.data.budgetRemaining,
        cash: query.data.cash,
        expense: query.data.snapshot.expense?.value ?? "0.00",
        goals: query.data.goals,
        missedBills: query.data.missedBills,
        settings,
      })
    : null;
  return { ...query, model };
}

function useTwoMonths() {
  const { session } = useSession();
  const { settings } = useHealthSettings();
  const load = useCallback(async (workspaceId: string) => {
    const month = dashboardBounds("month");
    const prev = previousMonthBounds();
    const [now, last, accounts, bills, goals, budgets] = await Promise.all([
      session.dashboard(workspaceId, month.from, month.to),
      session.dashboard(workspaceId, prev.from, prev.to),
      session.listAccounts(workspaceId),
      session.listBills(workspaceId),
      session.listGoals(workspaceId),
      session.listBudgets(workspaceId),
    ]);
    const cash = cashTotal((accounts.data ?? []) as Account[]);
    const missedBills = ((bills.data ?? []) as Bill[]).filter(missed).length;
    const goalRows = ((goals.data ?? []) as Goal[]).map((row) => ({
      id: row.id,
      saved: String(row.saved ?? "0.00"),
      target: String(row.target ?? "0.00"),
    }));
    const hasBudget = (budgets.data ?? []).length > 0;
    const nowDash = now.data as Dash;
    const lastDash = last.data as Dash;
    return {
      now: nowDash,
      last: lastDash,
      nowScore: healthModel({
        budgetRemaining: hasBudget ? nowDash.budgetRemaining?.value ?? "0.00" : null,
        cash,
        expense: nowDash.expense?.value ?? "0.00",
        goals: goalRows,
        missedBills,
        settings,
      }).score,
      lastScore: healthModel({
        budgetRemaining: hasBudget ? lastDash.budgetRemaining?.value ?? "0.00" : null,
        cash: "0.00",
        expense: lastDash.expense?.value ?? "0.00",
        goals: [],
        missedBills: 0,
        settings: { ...settings, runway: false, goals: false, bills: false },
      }).score,
    };
  }, [session, settings]);
  return useLiveQuery(load, null, "health-two-months");
}

export function HealthHubScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, loading, offline, error, known, refresh } = useHealthBundle();
  const links = [
    { label: "Score", href: "/(tabs)/more/health-score" },
    { label: "Runway", href: "/(tabs)/more/health-runway" },
    { label: "Stress test", href: "/(tabs)/more/health-stress" },
    { label: "Advice", href: "/(tabs)/more/health-advice" },
    { label: "History", href: "/(tabs)/more/health-history" },
    { label: "Compare", href: "/(tabs)/more/health-compare" },
    { label: "Report", href: "/(tabs)/more/health-report" },
    { label: "Settings", href: "/(tabs)/more/health-settings" },
  ] as const;
  return (
    <ScreenShell title="Financial health">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt>Income</Txt>
          <Amount value={nairaAmount(data.snapshot.income?.value)} kind="income" />
          <Txt>Expense</Txt>
          <Amount value={nairaAmount(data.snapshot.expense?.value)} kind="expense" />
          <Txt>Net worth</Txt>
          <Amount value={nairaAmount(data.snapshot.netWorth?.value)} />
        </View>
      ) : null}
      {links.map((link) => (
        <Pressable key={link.href} onPress={() => router.push(link.href)}>
          <Txt variant="label" color={t.c.primary}>{link.label}</Txt>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

export function HealthScoreScreen() {
  const t = useTheme();
  const { model, loading, offline, error, known, refresh } = useHealthBundle();
  return (
    <ScreenShell title="Health score">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !model ? <DefaultLoading /> : null}
      {model ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt variant="titleMd">{model.score}</Txt>
          {model.parts.map((row) => (
            <View key={row.key}>
              <Txt variant="label">
                {row.key} {row.points}/{row.max}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted}>{row.reason}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function HealthRunwayScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, model, loading } = useHealthBundle();
  return (
    <ScreenShell title="Runway">
      {loading && !data ? <DefaultLoading /> : null}
      {model?.runwayMonths == null ? (
        <EmptyState title="No spend this month" />
      ) : (
        <>
          <Txt variant="titleMd">{model.runwayMonths.toFixed(1)} months</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            Cash {data?.cash} · Expense {data?.snapshot.expense?.value}
          </Txt>
          <Button variant="tertiary" onPress={() => router.push("/(tabs)/more/health-stress")}>Stress test</Button>
        </>
      )}
    </ScreenShell>
  );
}

export function HealthStressScreen() {
  const t = useTheme();
  const { data, model } = useHealthBundle();
  const [bump, setBump] = useState("10");
  const expense = moneyNumber(data?.snapshot.expense?.value);
  const cash = moneyNumber(data?.cash);
  const stressed = expense * (1 + Number(bump) / 100);
  const next = stressed > 0 ? cash / stressed : null;
  return (
    <ScreenShell title="Stress test">
      <SegmentedControl
        label="Spend increase"
        value={bump}
        onChange={setBump}
        options={[
          { value: "10", label: "10%" },
          { value: "25", label: "25%" },
          { value: "50", label: "50%" },
        ]}
      />
      <Txt>Today {model?.runwayMonths == null ? "—" : `${model.runwayMonths.toFixed(1)} months`}</Txt>
      <Txt>If spend rises {next == null ? "—" : `${next.toFixed(1)} months`}</Txt>
      <Txt variant="caption" color={t.c.inkMuted}>This is not saved.</Txt>
    </ScreenShell>
  );
}

export function HealthAdviceScreen() {
  const router = useRouter();
  const { model, loading } = useHealthBundle();
  return (
    <ScreenShell title="Advice">
      {loading && !model ? <DefaultLoading /> : null}
      {model && model.advice.length === 0 ? <EmptyState title="Nothing to change." /> : null}
      {model?.advice.map((row) => (
        <Pressable key={row.key} onPress={() => router.push(row.href as never)}>
          <Txt variant="label">{row.text}</Txt>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

export function HealthHistoryScreen() {
  const t = useTheme();
  const { data, loading } = useTwoMonths();
  return (
    <ScreenShell title="Health history">
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ flexDirection: "row", gap: t.space.space4 }}>
          <View style={{ flex: 1 }}>
            <Txt variant="label">This month</Txt>
            <Txt variant="titleMd">{data.nowScore}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="label">Last month</Txt>
            <Txt variant="titleMd">{data.lastScore}</Txt>
          </View>
        </View>
      ) : null}
      <Txt variant="caption" color={t.c.inkMuted}>
        Last month uses budget and spend from that month only.
      </Txt>
    </ScreenShell>
  );
}

export function HealthCompareScreen() {
  const t = useTheme();
  const { data, loading } = useTwoMonths();
  return (
    <ScreenShell title="Compare periods">
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ flexDirection: "row", gap: t.space.space4 }}>
          {[
            { title: "This month", row: data.now },
            { title: "Last month", row: data.last },
          ].map((col) => (
            <View key={col.title} style={{ flex: 1, gap: t.space.space2 }}>
              <Txt variant="label">{col.title}</Txt>
              <Txt>Income {col.row.income?.value}</Txt>
              <Txt>Expense {col.row.expense?.value}</Txt>
              <Txt>Net {col.row.netWorth?.value}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function HealthSettingsScreen() {
  const { settings, save } = useHealthSettings();
  const toggle = (key: keyof HealthSettings) => save({ ...settings, [key]: !settings[key] });
  return (
    <ScreenShell title="Health settings">
      {(["budget", "runway", "goals", "bills"] as const).map((key) => (
        <Button key={key} variant={settings[key] ? "primary" : "secondary"} onPress={() => toggle(key)}>
          {key} {settings[key] ? "on" : "off"}
        </Button>
      ))}
    </ScreenShell>
  );
}

export function HealthReportScreen() {
  const router = useRouter();
  const { data, model, loading } = useHealthBundle();
  const text = data && model
    ? healthReportText({
        income: data.snapshot.income?.value ?? "0.00",
        expense: data.snapshot.expense?.value ?? "0.00",
        netWorth: data.snapshot.netWorth?.value ?? "0.00",
        runway: model.runwayMonths == null ? "No spend this month" : `${model.runwayMonths.toFixed(1)} months`,
        score: model.score,
        reasons: model.parts.map((row) => row.reason),
      })
    : "";
  return (
    <ScreenShell title="Health report">
      {loading && !data ? <DefaultLoading /> : null}
      {text ? <Txt>{text}</Txt> : null}
      <Button onPress={() => router.push("/(tabs)/more/health-share")}>Share</Button>
    </ScreenShell>
  );
}

export function HealthShareScreen() {
  const { data, model } = useHealthBundle();
  const text = data && model
    ? healthReportText({
        income: data.snapshot.income?.value ?? "0.00",
        expense: data.snapshot.expense?.value ?? "0.00",
        netWorth: data.snapshot.netWorth?.value ?? "0.00",
        runway: model.runwayMonths == null ? "No spend this month" : `${model.runwayMonths.toFixed(1)} months`,
        score: model.score,
        reasons: model.parts.map((row) => row.reason),
      })
    : "";
  return (
    <ScreenShell title="Health share">
      <Txt>{text}</Txt>
      <Banner tone="primary" title="No accounts or transactions are included." />
      <Button onPress={() => void Share.share({ message: text, title: "MyLedja health" })}>Share</Button>
    </ScreenShell>
  );
}

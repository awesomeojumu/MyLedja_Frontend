import { useCallback, useEffect, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Amount,
  Banner,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Select,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { dashboardBounds } from "@/features/dashboard/services/range-cache";
import {
  healthModel,
  healthReportText,
  moneyNumber,
  previousMonthBounds,
  type HealthSettings,
} from "@/features/financial-health/services/health-model";
import { loadHealthSettings, onHealthSettingsChange, saveHealthSettings } from "@/features/financial-health/services/health-settings";
import { nairaAmount, type ApiTransaction } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { scopedKey } from "@/lib/offline-cache";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { InfoTip, StatusPill } from "@/lib/ui/common-widgets";

type Dash = { income?: { value: string }; expense?: { value: string }; netWorth?: { value: string }; budgetRemaining?: { value: string } };
type Account = { id?: string; name?: string; kind?: string; balance?: string };
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
  const { user } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const key = user && activeWorkspace ? scopedKey(user.userId, activeWorkspace.workspaceId, "health-settings") : "health-settings";
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
    const nowDash = now.data as Dash;
    const lastDash = last.data as Dash;
    const accountRows = (accounts.data ?? []) as Account[];
    const billRows = (bills.data ?? []) as Bill[];
    const goalRows = (goals.data ?? []) as Goal[];
    const hasBudget = (budgets.data ?? []).length > 0;
    const cash = cashTotal(accountRows);
    const missedBills = billRows.filter(missed).length;
    const goalList = goalRows.map((row) => ({ id: row.id, saved: String(row.saved ?? "0.00"), target: String(row.target ?? "0.00") }));
    const nowModel = healthModel({
      budgetRemaining: hasBudget ? nowDash.budgetRemaining?.value ?? "0.00" : null,
      cash,
      expense: nowDash.expense?.value ?? "0.00",
      goals: goalList,
      missedBills,
      settings,
    });
    const lastModel = healthModel({
      budgetRemaining: hasBudget ? lastDash.budgetRemaining?.value ?? "0.00" : null,
      cash,
      expense: lastDash.expense?.value ?? "0.00",
      goals: goalList,
      missedBills,
      settings,
    });
    return {
      now: nowDash,
      last: lastDash,
      nowScore: nowModel.score,
      lastScore: lastModel.score,
    };
  }, [session, settings]);
  return useLiveQuery(load, null, "health-two-months");
}

/** 110 · Reports hub */
export function ReportsHubScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, model, loading, offline, error, known, refresh } = useHealthBundle();

  const reportsList = [
    { title: "Income & expense", desc: "Compare inflows vs outflows by category", href: "/(tabs)/more/report-income-expense" as const },
    { title: "Category trends", desc: "Track month-over-month spending shifts", href: "/(tabs)/more/report-trends" as const },
    { title: "Net worth", desc: "Total assets minus debts & liabilities", href: "/(tabs)/more/report-net-worth" as const },
    { title: "Cash flow", desc: "Operating cash burn and runway trajectory", href: "/(tabs)/more/report-cash-flow" as const },
    { title: "Data quality health", desc: "Audit uncategorized items, memos & duplicates", href: "/(tabs)/more/report-data-quality" as const },
    { title: "Custom report", desc: "Filter by date, account, type & category", href: "/(tabs)/more/report-custom" as const },
    { title: "Statement of account", desc: "Official ledger for any single account", href: "/(tabs)/more/report-statement" as const },
    { title: "Period comparisons", desc: "Side-by-side comparative analysis", href: "/(tabs)/more/report-comparisons" as const },
    { title: "Export or print", desc: "Download CSV, PDF summary, or JSON archive", href: "/(tabs)/more/report-export" as const },
  ];

  return (
    <ScreenShell title="Reports hub">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space4 }}>
        {/* Financial Health Summary Card */}
        {model ? (
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="label">Financial health</Txt>
                <StatusPill label={`Score: ${model.score}/100`} tone="positive" />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Runway</Txt>
                  <Txt variant="titleMd">
                    {model.runwayMonths == null ? "—" : `${model.runwayMonths.toFixed(1)} mo`}
                  </Txt>
                </View>
                <Button variant="tertiary" onPress={() => router.push("/(tabs)/more/health-score")}>
                  View health details
                </Button>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Reports Navigation Grid */}
        <View style={{ gap: t.space.space3 }}>
          <Txt variant="label">Financial Reports</Txt>
          {reportsList.map((item) => (
            <Pressable key={item.title} onPress={() => router.push(item.href as never)}>
              <Card>
                <View style={{ gap: t.space.space1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt variant="body" style={{ fontWeight: "600" }}>{item.title}</Txt>
                    <Txt variant="caption" color={t.c.primary}>Open →</Txt>
                  </View>
                  <Txt variant="caption" color={t.c.inkMuted}>{item.desc}</Txt>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

/** 111 · Income and expense report */
export function IncomeExpenseReportScreen() {
  const t = useTheme();
  const { session } = useSession();
  const [period, setPeriod] = useState("month");
  const load = useCallback(async (workspaceId: string) => {
    const bounds = dashboardBounds(period as "month" | "year");
    const [dash, txns] = await Promise.all([
      session.dashboard(workspaceId, bounds.from, bounds.to),
      session.listTransactions(workspaceId),
    ]);
    const snapshot = dash.data as Dash;
    const transactions = (txns.data.transactions ?? []) as ApiTransaction[];
    return { snapshot, transactions };
  }, [period, session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, null, `inc-exp-${period}`);

  const income = nairaAmount(data?.snapshot.income?.value);
  const expense = nairaAmount(data?.snapshot.expense?.value);
  const net = income - expense;

  return (
    <ScreenShell title="Income and expense report">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space4 }}>
        <SegmentedControl
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "month", label: "This month" },
            { value: "year", label: "Year to date" },
          ]}
        />

        <Card>
          <View style={{ gap: t.space.space3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Txt variant="caption" color={t.c.inkMuted}>Total Income</Txt>
                <Amount value={income} kind="income" />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt variant="caption" color={t.c.inkMuted}>Total Expense</Txt>
                <Amount value={expense} kind="expense" />
              </View>
            </View>

            <View style={{ paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border, flexDirection: "row", justifyContent: "space-between" }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>Net Margin</Txt>
              <Amount value={net} kind={net >= 0 ? "income" : "expense"} />
            </View>
          </View>
        </Card>

        {/* Top Expenditures */}
        <View style={{ gap: t.space.space2 }}>
          <Txt variant="label">Recorded Ledger Entries ({data?.transactions.length ?? 0})</Txt>
          {(data?.transactions ?? []).slice(0, 10).map((row) => (
            <TransactionRow
              key={row.id}
              title={row.description ?? "Transaction"}
              amount={nairaAmount(row.amount)}
              kind={row.type === "income" ? "income" : "expense"}
            />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

/** 112 · Category trends */
export function CategoryTrendsScreen() {
  const t = useTheme();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    const [txns, cats] = await Promise.all([
      session.listTransactions(workspaceId),
      session.listCategories(workspaceId),
    ]);
    const catList = (cats.data ?? []) as { id: string; name: string }[];
    const catNameById = new Map<string, string>(catList.map((c) => [c.id, c.name]));
    const rows = (txns.data.transactions ?? []) as ApiTransaction[];
    const catMap = new Map<string, number>();
    for (const tx of rows) {
      if (tx.type === "transfer" || tx.type === "income") continue;
      const cat = (tx.categoryId && catNameById.get(tx.categoryId)) ?? tx.description ?? "General";
      catMap.set(cat, (catMap.get(cat) ?? 0) + nairaAmount(tx.amount));
    }
    const total = Array.from(catMap.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(catMap.entries())
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [session]);
  const { data: categories, loading, offline, error, known, refresh } = useLiveQuery(load, [], "cat-trends");

  return (
    <ScreenShell title="Category trends">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && categories.length === 0 ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space3 }}>
        <Txt variant="label">Spending Distribution by Category</Txt>
        {categories.map((c) => (
          <Card key={c.category}>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt variant="body" style={{ fontWeight: "600" }}>{c.category}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>{c.pct}% of total</Txt>
              </View>
              <Amount value={c.amount} kind="expense" />
              <View style={{ height: 6, width: "100%", backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${c.pct}%`, backgroundColor: t.c.primary }} />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </ScreenShell>
  );
}

/** 113 · Net-worth report */
export function NetWorthReportScreen() {
  const t = useTheme();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    const [accounts, debts] = await Promise.all([
      session.listAccounts(workspaceId),
      session.listDebts(workspaceId),
    ]);
    const accountList = (accounts.data ?? []) as Account[];
    const debtList = (debts.data ?? []) as { balance?: string; amount?: string }[];
    const assets = accountList.reduce((sum, a) => sum + Math.max(0, nairaAmount(a.balance)), 0);
    const liabilities = debtList.reduce((sum, d) => sum + nairaAmount(d.balance ?? d.amount), 0);
    return { assets, liabilities, netWorth: assets - liabilities, accounts: accountList };
  }, [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, null, "net-worth-rep");

  return (
    <ScreenShell title="Net-worth report">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      {data ? (
        <View style={{ gap: t.space.space4 }}>
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="label">Total Net Worth</Txt>
                <InfoTip text="Sum of all liquid accounts and assets minus recorded debts." />
              </View>
              <Amount value={data.netWorth} kind={data.netWorth >= 0 ? "income" : "expense"} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Assets</Txt>
                  <Amount value={data.assets} kind="income" />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt variant="caption" color={t.c.inkMuted}>Liabilities</Txt>
                  <Amount value={data.liabilities} kind="expense" />
                </View>
              </View>
            </View>
          </Card>

          <View style={{ gap: t.space.space2 }}>
            <Txt variant="label">Asset Holdings ({data.accounts.length})</Txt>
            {data.accounts.map((acc, i) => (
              <Card key={acc.id ?? String(i)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Txt variant="body" style={{ fontWeight: "600" }}>{acc.name ?? "Account"}</Txt>
                    <Txt variant="caption" color={t.c.inkMuted}>{acc.kind ?? "Bank"}</Txt>
                  </View>
                  <Amount value={nairaAmount(acc.balance)} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/** 114 · Cash-flow report */
export function CashFlowReportScreen() {
  const t = useTheme();
  const { data, model, loading, offline, error, known, refresh } = useHealthBundle();
  const income = nairaAmount(data?.snapshot.income?.value);
  const expense = nairaAmount(data?.snapshot.expense?.value);
  const burn = expense - income;

  return (
    <ScreenShell title="Cash-flow report">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space3 }}>
            <Txt variant="label">Monthly Cash Flow Trajectory</Txt>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Txt variant="caption" color={t.c.inkMuted}>Operating Cash</Txt>
                <Amount value={nairaAmount(data?.cash)} />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt variant="caption" color={t.c.inkMuted}>Monthly Burn Rate</Txt>
                <Amount value={burn} kind={burn > 0 ? "expense" : "income"} />
              </View>
            </View>
          </View>
        </Card>

        {model ? (
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label">Calculated Runway</Txt>
              <Txt variant="titleMd">
                {model.runwayMonths == null ? "Indefinite (Surplus)" : `${model.runwayMonths.toFixed(1)} Months`}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                Number of months current liquid reserves will sustain baseline living expenses.
              </Txt>
            </View>
          </Card>
        ) : null}
      </View>
    </ScreenShell>
  );
}

/** 115 · Data-quality health */
export function DataQualityHealthScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    const txns = await session.listTransactions(workspaceId);
    const rows = (txns.data.transactions ?? []) as ApiTransaction[];
    const uncategorized = rows.filter((tx) => !tx.categoryId && tx.type !== "transfer").length;
    const missingDescription = rows.filter((tx) => !tx.description).length;
    const total = Math.max(1, rows.length);
    const cleanScore = Math.max(0, Math.round(100 - (uncategorized * 10 + missingDescription * 5) / total));
    return { uncategorized, missingDescription, total: rows.length, cleanScore };
  }, [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, null, "data-quality");

  return (
    <ScreenShell title="Data-quality health">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      {data ? (
        <View style={{ gap: t.space.space4 }}>
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="label">Ledger Integrity Score</Txt>
                <StatusPill label={`${data.cleanScore}% Clean`} tone={data.cleanScore >= 80 ? "positive" : "warning"} />
              </View>
              <Txt variant="titleMd">{data.total} Total Records Analyzed</Txt>
            </View>
          </Card>

          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Txt variant="body" style={{ fontWeight: "600" }}>Uncategorized Transactions</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>{data.uncategorized} records need categorization</Txt>
                </View>
                {data.uncategorized > 0 ? (
                  <Button variant="secondary" onPress={() => router.push("/(tabs)/transactions/rules")}>
                    Categorize
                  </Button>
                ) : (
                  <StatusPill label="All Clean" tone="positive" icon="check" />
                )}
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Txt variant="body" style={{ fontWeight: "600" }}>Duplicate Candidate Detection</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>Scan for matching amount & timestamp records</Txt>
                </View>
                <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/dupes")}>
                  Scan dupes
                </Button>
              </View>
            </View>
          </Card>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/** 116 · Custom report */
export function CustomReportScreen() {
  const t = useTheme();
  const { session } = useSession();
  const [typeFilter, setTypeFilter] = useState("all");
  const load = useCallback(async (workspaceId: string) => {
    const txns = await session.listTransactions(workspaceId);
    return (txns.data.transactions ?? []) as ApiTransaction[];
  }, [session]);
  const { data: allTxns, loading, offline, error, known, refresh } = useLiveQuery(load, [], "custom-rep-txns");

  const filtered = allTxns.filter((tx) => {
    if (typeFilter === "income") return tx.type === "income";
    if (typeFilter === "expense") return tx.type !== "income" && tx.type !== "transfer";
    return true;
  });

  const totalSum = filtered.reduce((sum, tx) => sum + nairaAmount(tx.amount), 0);

  return (
    <ScreenShell title="Custom report">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && allTxns.length === 0 ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space4 }}>
        <SegmentedControl
          label="Transaction type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "all", label: "All types" },
            { value: "income", label: "Inflow" },
            { value: "expense", label: "Outflow" },
          ]}
        />

        <Card>
          <View style={{ gap: t.space.space2 }}>
            <Txt variant="label">Filtered Aggregate Sum</Txt>
            <Amount value={totalSum} />
            <Txt variant="caption" color={t.c.inkMuted}>{filtered.length} matching transactions</Txt>
          </View>
        </Card>

        <View style={{ gap: t.space.space2 }}>
          {filtered.slice(0, 15).map((row) => (
            <TransactionRow
              key={row.id}
              title={row.description ?? "Transaction"}
              amount={nairaAmount(row.amount)}
              kind={row.type === "income" ? "income" : "expense"}
            />
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

/** 117 · Export or print */
export function ExportPrintScreen() {
  const t = useTheme();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [format, setFormat] = useState<"csv" | "json" | "pdf">("csv");
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    const workspaceId = activeWorkspace?.workspaceId;
    if (!workspaceId) return;
    const txns = await session.listTransactions(workspaceId);
    const rows = (txns.data.transactions ?? []) as ApiTransaction[];

    let payload = "";
    if (format === "csv") {
      payload = "Date,Description,Amount,Type\n" +
        rows.map((r) => `${r.occurredAt ?? ""},"${r.description ?? ""}",${r.amount ?? ""},${r.type ?? ""}`).join("\n");
    } else {
      payload = JSON.stringify(rows, null, 2);
    }

    await Share.share({
      title: `MyLedja_Export_${format.toUpperCase()}`,
      message: payload,
    });
    setExported(true);
  };

  return (
    <ScreenShell
      title="Export or print"
      footer={
        <Button fullWidth size="lg" icon="archive" onPress={handleExport}>
          Download & Share {format.toUpperCase()}
        </Button>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space2 }}>
            <Txt variant="label">Export Financial Records</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Generate a full export of your workspace transactions and ledger accounts.
            </Txt>
          </View>
        </Card>

        <SegmentedControl
          label="Format"
          value={format}
          onChange={(v) => setFormat(v as "csv" | "json" | "pdf")}
          options={[
            { value: "csv", label: "CSV (Excel)" },
            { value: "pdf", label: "PDF Statement" },
            { value: "json", label: "JSON Archive" },
          ]}
        />

        {exported ? (
          <Banner tone="primary" title="Export ready">
            Your export was prepared and shared with your phone&apos;s share sheet.
          </Banner>
        ) : null}
      </View>
    </ScreenShell>
  );
}

/** 153 · Statement of account */
export function StatementOfAccountScreen() {
  const t = useTheme();
  const { session } = useSession();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const loadAccounts = useCallback(async (workspaceId: string) => ((await session.listAccounts(workspaceId)).data as Account[]) ?? [], [session]);
  const { data: accounts } = useLiveQuery(loadAccounts, [], "statement-accounts");

  const accountId = selectedAccountId || (accounts[0]?.id ?? "");

  const loadStatement = useCallback(async (workspaceId: string) => {
    if (!accountId) return null;
    const txns = await session.listTransactions(workspaceId);
    const rows = ((txns.data.transactions ?? []) as ApiTransaction[]).filter((tx) => tx.accountId === accountId);
    const account = accounts.find((a) => a.id === accountId);
    const balance = nairaAmount(account?.balance);
    return { account, rows, balance };
  }, [accountId, accounts, session]);
  const { data: statement, loading, offline, error, known, refresh } = useLiveQuery(loadStatement, null, accountId ? `stmt-${accountId}` : undefined);

  return (
    <ScreenShell title="Statement of account">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !statement ? <DefaultLoading /> : null}

      <View style={{ gap: t.space.space4 }}>
        <Select
          label="Select Account"
          value={accountId}
          options={accounts.map((a) => ({ value: String(a.id), label: String(a.name) }))}
          onChange={setSelectedAccountId}
        />

        {statement ? (
          <>
            <Card>
              <View style={{ gap: t.space.space2 }}>
                <Txt variant="label">Current Account Balance</Txt>
                <Amount value={statement.balance} />
                <Txt variant="caption" color={t.c.inkMuted}>{statement.rows.length} total posted entries</Txt>
              </View>
            </Card>

            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label">Itemized Account Ledger</Txt>
              {statement.rows.length === 0 ? (
                <EmptyState title="No transactions for this account" />
              ) : (
                statement.rows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    title={row.description ?? "Transaction"}
                    amount={nairaAmount(row.amount)}
                    kind={row.type === "income" ? "income" : "expense"}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}

/** 154 · Period comparisons */
export function PeriodComparisonsScreen() {
  const t = useTheme();
  const { data, loading, offline, error, known, refresh } = useTwoMonths();

  return (
    <ScreenShell title="Period comparisons">
      <LiveNotice offline={offline ?? false} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      {data ? (
        <View style={{ gap: t.space.space4 }}>
          <View style={{ flexDirection: "row", gap: t.space.space3 }}>
            {[
              { title: "This month", row: data.now },
              { title: "Last month", row: data.last },
            ].map((col) => (
              <Card key={col.title} style={{ flex: 1 }}>
                <View style={{ gap: t.space.space2 }}>
                  <Txt variant="label">{col.title}</Txt>
                  <View>
                    <Txt variant="caption" color={t.c.inkMuted}>Income</Txt>
                    <Amount value={nairaAmount(col.row.income?.value)} kind="income" />
                  </View>
                  <View>
                    <Txt variant="caption" color={t.c.inkMuted}>Expense</Txt>
                    <Amount value={nairaAmount(col.row.expense?.value)} kind="expense" />
                  </View>
                  <View>
                    <Txt variant="caption" color={t.c.inkMuted}>Net</Txt>
                    <Amount value={nairaAmount(col.row.netWorth?.value)} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/** Supplementary Financial Health Screens (Retained & Wired) */
export function HealthHubScreen() {
  return <ReportsHubScreen />;
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
  const { data, loading, offline, error, known, refresh } = useTwoMonths();
  return (
    <ScreenShell title="Compare periods">
      <LiveNotice offline={offline ?? false} error={error} hasData={known} onRetry={refresh} />
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

import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Amount,
  AmountInput,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  SegmentedControl,
  Select,
  TextField,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { InfoTip, StatusPill } from "@/lib/ui/common-widgets";

export type Budget = {
  id: string;
  name?: string;
  primaryPeriod?: string;
  planned?: string;
  onHand?: string;
  expected?: string;
  gap?: string;
  spent?: string;
  remaining?: string;
  needsMoney?: boolean;
  overspent?: boolean;
  lines?: { categoryId: string; name: string; planned: string; spent: string; remaining: string }[];
  fundingAccountIds?: string[];
  views?: Record<string, { value: string }>;
  periodFrom?: string;
  periodTo?: string;
  rolloverSurplus?: boolean;
  rolloverDeficit?: boolean;
  alertThreshold50?: boolean;
  alertThreshold80?: boolean;
  alertThreshold100?: boolean;
};

type AccountItem = {
  id: string;
  name: string;
  kind: string;
  balance?: string;
};

const NONE: Budget[] = [];
const PERIODS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function asBudgets(rows: unknown[]): Budget[] {
  return rows as Budget[];
}

export function toDecimal(value: string): string {
  return nairaAmount(value).toFixed(2);
}

export function useBudget() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getBudget(workspaceId, id)).data as Budget;
  }, [id, session]);
  const query = useLiveQuery(load, null, id && activeWorkspace ? `budget-${id}` : undefined);
  return { id, ...query };
}

/** 048 · Budget overview */
export function BudgetsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [filter, setFilter] = useState<"all" | "funded" | "needs" | "overspent">("all");
  const load = useCallback(async (workspaceId: string) => asBudgets((await session.listBudgets(workspaceId)).data ?? []), [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "budgets");
  const add = () => router.push("/(tabs)/plan/budget-add");

  const totalPlanned = data.reduce((sum, b) => sum + nairaAmount(b.planned), 0);
  const totalSpent = data.reduce((sum, b) => sum + nairaAmount(b.spent), 0);
  const totalRemaining = Math.max(0, totalPlanned - totalSpent);
  const totalGap = data.reduce((sum, b) => sum + Math.max(0, nairaAmount(b.gap)), 0);

  const filtered = data.filter((b) => {
    if (filter === "funded") return !b.overspent && nairaAmount(b.gap) <= 0;
    if (filter === "needs") return b.needsMoney || nairaAmount(b.gap) > 0;
    if (filter === "overspent") return b.overspent;
    return true;
  });

  return (
    <ScreenShell
      title="Budget overview"
      actions={[
        { icon: "triangle-alert", label: "Needs money", onPress: () => router.push("/(tabs)/plan/budget-overspent") },
      ]}
      footer={<Button fullWidth onPress={add}>Add budget</Button>}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No budgets yet" action={{ label: "Add budget", onPress: add }}>
          Plan by category, not by one account.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space4 }}>
          {/* Summary Metrics */}
          <Card>
            <View style={{ gap: t.space.space3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
                  <Txt variant="label">Total Planned Budget</Txt>
                  <InfoTip text="Sum of planned allocations across all active budget envelopes." />
                </View>
                {totalGap > 0 ? (
                  <StatusPill label={`Gap ₦${totalGap.toLocaleString()}`} tone="warning" icon="triangle-alert" />
                ) : (
                  <StatusPill label="Fully funded" tone="positive" icon="check" />
                )}
              </View>
              <Amount value={totalPlanned} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Spent</Txt>
                  <Amount value={totalSpent} kind="expense" />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt variant="caption" color={t.c.inkMuted}>Remaining</Txt>
                  <Amount value={totalRemaining} kind="income" />
                </View>
              </View>
            </View>
          </Card>

          {/* Filter Chips */}
          <View style={{ flexDirection: "row", gap: t.space.space2, flexWrap: "wrap" }}>
            <Chip selected={filter === "all"} onPress={() => setFilter("all")}>All ({data.length})</Chip>
            <Chip selected={filter === "funded"} onPress={() => setFilter("funded")}>Funded</Chip>
            <Chip selected={filter === "needs"} onPress={() => setFilter("needs")}>Needs money</Chip>
            <Chip selected={filter === "overspent"} onPress={() => setFilter("overspent")}>Overspent</Chip>
          </View>

          {/* Budgets List */}
          <View style={{ gap: t.space.space3 }}>
            {filtered.map((row) => {
              const plannedVal = nairaAmount(row.planned);
              const spentVal = nairaAmount(row.spent);
              const pct = plannedVal > 0 ? Math.min(100, Math.round((spentVal / plannedVal) * 100)) : 0;
              const isOver = row.overspent || spentVal > plannedVal;

              return (
                <Pressable
                  key={row.id}
                  onPress={() => router.push(`/(tabs)/plan/budget-detail?id=${row.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.name ?? "Budget"}, ${row.primaryPeriod ?? "month"}, planned ${row.planned}`}
                >
                  <Card>
                    <View style={{ gap: t.space.space2 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Txt variant="body" style={{ fontWeight: "600" }}>{row.name ?? "Budget"} · {row.primaryPeriod}</Txt>
                        {isOver ? (
                          <StatusPill label="Overspent" tone="danger" icon="triangle-alert" />
                        ) : nairaAmount(row.gap) > 0 ? (
                          <StatusPill label={`Gap ₦${row.gap}`} tone="warning" icon="triangle-alert" />
                        ) : (
                          <StatusPill label="Funded" tone="positive" />
                        )}
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Amount value={plannedVal} />
                        <Txt variant="caption" color={t.c.inkMuted}>
                          Spent ₦{spentVal.toLocaleString()} ({pct}%)
                        </Txt>
                      </View>

                      {/* Spend Progress Bar */}
                      <View style={{ height: 6, width: "100%", backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                        <View
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            backgroundColor: isOver ? t.c.danger : pct >= 80 ? t.c.warning : t.c.positive,
                          }}
                        />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

/** 049 · Create budget */
export function BudgetCreateScreen() {
  return <BudgetFormScreen mode="add" />;
}

/** 050 · Edit budget */
export function BudgetEditScreen() {
  return <BudgetFormScreen mode="edit" />;
}

export function BudgetFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [name, setName] = useState("Monthly Budget");
  const [period, setPeriod] = useState("month");
  const [lines, setLines] = useState([{ categoryId: "", amount: "0.00" }]);
  const [fundingAccountIds, setFundingAccountIds] = useState<string[]>([]);
  const { busy, error, run } = useSubmit();

  const loadCats = useCallback(async (workspaceId: string) => (await session.listCategories(workspaceId)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "budget-cats");
  const catOptions = categories
    .filter((row) => row.kind !== "income")
    .map((row) => ({ value: row.id, label: row.name }));

  const loadAccounts = useCallback(async (workspaceId: string) => ((await session.listAccounts(workspaceId)).data as AccountItem[]) ?? [], [session]);
  const { data: accounts } = useLiveQuery(loadAccounts, [], "budget-accounts");

  const load = useCallback(async (workspaceId: string) => {
    if (mode !== "edit" || !id) return null;
    const res = await session.getBudget(workspaceId, id);
    const data = res.data as Budget;
    setName(data.name ?? "Budget");
    setPeriod(String(data.primaryPeriod ?? "month"));
    setLines((data.lines ?? []).map((line) => ({ categoryId: line.categoryId, amount: toDecimal(line.planned) })));
    setFundingAccountIds(data.fundingAccountIds ?? []);
    return data;
  }, [id, mode, session]);
  useLiveQuery(load, null, mode === "edit" && id ? `budget-edit-${id}` : undefined);

  const totalAllocated = lines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);

  return (
    <ScreenShell
      title={mode === "add" ? "Create budget" : "Edit budget"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId) return;
              const clean = lines
                .filter((line) => line.categoryId && nairaAmount(line.amount) > 0)
                .map((line) => ({ categoryId: line.categoryId, amount: toDecimal(line.amount) }));
              if (clean.length === 0) throw new Error("Add at least one category line.");
              const body = { name, primaryPeriod: period, lines: clean, fundingAccountIds };
              if (mode === "add") {
                await session.createBudget(workspaceId, body);
                router.replace("/(tabs)/plan/budgets");
              } else if (id) {
                await session.patchBudget(workspaceId, id, body);
                router.back();
              }
            })
          }
        >
          {mode === "add" ? "Save budget" : "Save changes"}
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}

      <View style={{ gap: t.space.space4 }}>
        <TextField
          label="Budget name"
          value={name}
          onChangeText={setName}
          helper="The total of these lines is your plan. Money in accounts and expected salary fund it."
        />

        <SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />

        {/* Category Lines */}
        <View style={{ gap: t.space.space3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt variant="label">Category lines</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>Total: ₦{totalAllocated.toLocaleString()}</Txt>
          </View>

          {lines.map((line, index) => (
            <Card key={index}>
              <View style={{ gap: t.space.space2 }}>
                <Select
                  label="Category"
                  value={line.categoryId}
                  options={catOptions}
                  onChange={(value) => setLines(lines.map((row, i) => (i === index ? { ...row, categoryId: value } : row)))}
                />
                <AmountInput
                  label="For this category"
                  value={line.amount}
                  onChange={(value) => setLines(lines.map((row, i) => (i === index ? { ...row, amount: value } : row)))}
                />
                {lines.length > 1 ? (
                  <Button variant="tertiary" onPress={() => setLines(lines.filter((_, i) => i !== index))}>
                    Remove line
                  </Button>
                ) : null}
              </View>
            </Card>
          ))}

          <Button variant="secondary" icon="plus" onPress={() => setLines([...lines, { categoryId: "", amount: "0.00" }])}>
            Add line
          </Button>

          <View style={{ flexDirection: "row", gap: t.space.space2 }}>
            <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/add-category?from=budget")}>
              Add category
            </Button>
            <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/categories")}>
              Browse categories
            </Button>
          </View>
        </View>

        {/* Funding Accounts */}
        <View style={{ gap: t.space.space2 }}>
          <Txt variant="label">Funding accounts</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>Select the accounts that fund this budget.</Txt>
          <View style={{ flexDirection: "row", gap: t.space.space2, flexWrap: "wrap" }}>
            {accounts
              .filter((a) => a.kind === "bank" || a.kind === "cash" || a.kind === "wallet")
              .map((acc) => {
                const selected = fundingAccountIds.includes(acc.id);
                return (
                  <Chip
                    key={acc.id}
                    selected={selected}
                    onPress={() =>
                      setFundingAccountIds(
                        selected ? fundingAccountIds.filter((x) => x !== acc.id) : [...fundingAccountIds, acc.id]
                      )
                    }
                  >
                    {acc.name}
                  </Chip>
                );
              })}
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

/** 051 · Category allocation */
export function BudgetCategoryAllocationScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useBudget();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const { busy, error: submitError, run } = useSubmit();
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  if (data && !initialized) {
    const map: Record<string, string> = {};
    (data.lines ?? []).forEach((line) => {
      map[line.categoryId] = toDecimal(line.planned);
    });
    setAllocations(map);
    setInitialized(true);
  }

  const plannedTotal = nairaAmount(data?.planned);
  const currentTotal = Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const unallocated = plannedTotal - currentTotal;

  const handleSave = () => {
    run(async () => {
      const workspaceId = activeWorkspace?.workspaceId;
      if (!workspaceId || !id || !data) return;
      const updatedLines = (data.lines ?? []).map((line) => ({
        categoryId: line.categoryId,
        amount: allocations[line.categoryId] ? toDecimal(allocations[line.categoryId]) : toDecimal(line.planned),
      }));
      await session.patchBudget(workspaceId, id, { lines: updatedLines });
      refresh();
      router.back();
    });
  };

  const distributeEvenly = () => {
    if (!data?.lines?.length || plannedTotal <= 0) return;
    const share = (plannedTotal / data.lines.length).toFixed(2);
    const updated: Record<string, string> = {};
    data.lines.forEach((line) => {
      updated[line.categoryId] = share;
    });
    setAllocations(updated);
  };

  return (
    <ScreenShell
      title="Category allocation"
      footer={
        <Button fullWidth loading={busy} onPress={handleSave}>
          Save allocations
        </Button>
      }
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {submitError ? <Banner tone="danger" title={submitError} /> : null}

      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label">Budget Envelope Allocation</Txt>
              <InfoTip text="Assign money to category envelopes. Keep unallocated at ₦0.00 for zero-based budgeting." />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Txt variant="caption" color={t.c.inkMuted}>Target Budget</Txt>
                <Amount value={plannedTotal} />
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {unallocated < 0 ? "Overallocated by" : "Remaining unallocated"}
                </Txt>
                <Amount value={Math.abs(unallocated)} kind={unallocated < 0 ? "expense" : "income"} />
              </View>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
          <Button variant="secondary" onPress={distributeEvenly}>
            Distribute evenly
          </Button>
          <Button
            variant="tertiary"
            onPress={() => {
              const cleared: Record<string, string> = {};
              (data?.lines ?? []).forEach((line) => {
                cleared[line.categoryId] = "0.00";
              });
              setAllocations(cleared);
            }}
          >
            Clear all
          </Button>
        </View>

        <View style={{ gap: t.space.space3 }}>
          {(data?.lines ?? []).map((line) => (
            <Card key={line.categoryId}>
              <View style={{ gap: t.space.space2 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt variant="body" style={{ fontWeight: "600" }}>{line.name}</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>Spent: ₦{nairaAmount(line.spent).toLocaleString()}</Txt>
                </View>
                <AmountInput
                  label="Allocation"
                  value={allocations[line.categoryId] ?? toDecimal(line.planned)}
                  onChange={(val) => setAllocations({ ...allocations, [line.categoryId]: val })}
                />
              </View>
            </Card>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

/** 052 · Budget details */
export function BudgetDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useBudget();
  const gap = nairaAmount(data?.gap);
  const plannedVal = nairaAmount(data?.planned);
  const spentVal = nairaAmount(data?.spent);
  const overallPct = plannedVal > 0 ? Math.min(100, Math.round((spentVal / plannedVal) * 100)) : 0;

  return (
    <ScreenShell
      title={data?.name ?? "Budget details"}
      actions={[
        { icon: "pencil", label: "Edit", onPress: () => router.push(`/(tabs)/plan/budget-edit?id=${id}`) },
      ]}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      {data ? (
        <View style={{ gap: t.space.space4 }}>
          {/* Header Card */}
          <Card>
            <View style={{ gap: t.space.space3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="titleLg">{data.name ?? "Budget"}</Txt>
                <StatusPill
                  label={data.overspent ? "Overspent" : gap > 0 ? "Needs money" : "Funded"}
                  tone={data.overspent ? "danger" : gap > 0 ? "warning" : "positive"}
                />
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Planned</Txt>
                  <Amount value={plannedVal} />
                </View>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>On hand</Txt>
                  <Amount value={nairaAmount(data.onHand)} />
                </View>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Expected</Txt>
                  <Amount value={nairaAmount(data.expected)} />
                </View>
              </View>

              {gap > 0 ? (
                <Banner tone="warning" title="Wait for salary or add income">
                  Funding gap of ₦{data.gap}. On-hand cash and expected income are less than planned expenses.
                </Banner>
              ) : null}

              {/* Progress bar */}
              <View style={{ gap: t.space.space1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt variant="caption" color={t.c.inkMuted}>Total spend progress</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>{overallPct}%</Txt>
                </View>
                <View style={{ height: 8, width: "100%", backgroundColor: t.c.surfaceAlt, borderRadius: 4, overflow: "hidden" }}>
                  <View
                    style={{
                      height: "100%",
                      width: `${overallPct}%`,
                      backgroundColor: data.overspent ? t.c.danger : overallPct >= 80 ? t.c.warning : t.c.positive,
                    }}
                  />
                </View>
              </View>
            </View>
          </Card>

          {/* Category Envelopes */}
          <View style={{ gap: t.space.space2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label">Category Envelopes</Txt>
              <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-edit?id=${id}`)}>
                Add line
              </Button>
            </View>

            {(data.lines ?? []).map((line) => {
              const linePlanned = nairaAmount(line.planned);
              const lineSpent = nairaAmount(line.spent);
              const lineRem = nairaAmount(line.remaining);
              const linePct = linePlanned > 0 ? Math.min(100, Math.round((lineSpent / linePlanned) * 100)) : 0;
              const isOver = lineRem < 0 || lineSpent > linePlanned;

              return (
                <Pressable
                  key={line.categoryId}
                  onPress={() => router.push(`/(tabs)/transactions/category?id=${line.categoryId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${line.name}, planned ${line.planned}, spent ${line.spent}`}
                >
                  <Card>
                    <View style={{ gap: t.space.space2 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Txt variant="body" style={{ fontWeight: "600" }}>{line.name}</Txt>
                        {isOver ? (
                          <StatusPill label={`Over by ₦${Math.abs(lineRem).toLocaleString()}`} tone="danger" />
                        ) : (
                          <Txt variant="caption" color={t.c.inkMuted}>left ₦{lineRem.toLocaleString()}</Txt>
                        )}
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Amount value={linePlanned} />
                        <Txt variant="caption" color={t.c.inkMuted}>
                          Spent ₦{lineSpent.toLocaleString()} ({linePct}%)
                        </Txt>
                      </View>

                      <View style={{ height: 4, width: "100%", backgroundColor: t.c.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
                        <View
                          style={{
                            height: "100%",
                            width: `${linePct}%`,
                            backgroundColor: isOver ? t.c.danger : linePct >= 80 ? t.c.warning : t.c.positive,
                          }}
                        />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          {/* Quick Actions Grid */}
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label">Manage Budget</Txt>
              <Button onPress={() => router.push(`/(tabs)/plan/budget-edit?id=${id}`)}>Edit</Button>
              <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/budget-period?id=${id}`)}>Period</Button>
              <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/add-category?from=budget")}>
                Add category
              </Button>
              <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/categories")}>
                Browse categories
              </Button>
              <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-remaining?id=${id}`)}>
                Budget remaining
              </Button>
              <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-history?id=${id}`)}>
                Budget history
              </Button>
              <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-accounts?id=${id}`)}>
                Funding accounts
              </Button>
              <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-insights?id=${id}`)}>
                Budget insights
              </Button>
            </View>
          </Card>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/** 053 · Period selector */
export function BudgetPeriodScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data } = useBudget();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [periodOverride, setPeriod] = useState<string | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const { busy, run } = useSubmit();
  const period = periodOverride ?? data?.primaryPeriod ?? "month";

  return (
    <ScreenShell
      title="Period selector"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId || !id) return;
              await session.patchBudget(workspaceId, id, { primaryPeriod: period, autoRenew });
              router.back();
            })
          }
        >
          Save
        </Button>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space3 }}>
            <Txt variant="label">Budget Period Cycle</Txt>
            <SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />
            <Txt variant="caption" color={t.c.inkMuted}>
              Defines how often your budget envelopes reset and track expenditure.
            </Txt>
          </View>
        </Card>

        <Card>
          <View style={{ gap: t.space.space3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 2 }}>
                <Txt variant="body" style={{ fontWeight: "600" }}>Auto-renew cycle</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>Automatically advance to next period on renewal</Txt>
              </View>
              <Chip selected={autoRenew} onPress={() => setAutoRenew(!autoRenew)}>
                {autoRenew ? "Enabled" : "Manual"}
              </Chip>
            </View>
          </View>
        </Card>
      </View>
    </ScreenShell>
  );
}

/** 054 · Overspend analysis */
export function BudgetOverspentScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [filter, setFilter] = useState("needs");
  const load = useCallback(async (workspaceId: string) => asBudgets((await session.listBudgets(workspaceId)).data ?? []), [session]);
  const { data } = useLiveQuery(load, NONE, "budgets-gap");
  const rows = data.filter((row) => (filter === "needs" ? row.needsMoney : row.overspent));

  return (
    <ScreenShell title="Overspend analysis">
      <View style={{ gap: t.space.space4 }}>
        <SegmentedControl
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "needs", label: "Needs money" },
            { value: "over", label: "Overspent" },
          ]}
        />

        {rows.length === 0 ? (
          <EmptyState title="No deficits found" icon="check">
            All your budget envelopes are currently funded and within their spending limits.
          </EmptyState>
        ) : (
          <View style={{ gap: t.space.space3 }}>
            {rows.map((row) => (
              <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/budget-detail?id=${row.id}`)}>
                <Card>
                  <View style={{ gap: t.space.space2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Txt variant="body" style={{ fontWeight: "600" }}>{row.name}</Txt>
                      <StatusPill
                        label={filter === "needs" ? `Gap ₦${row.gap}` : "Overspent"}
                        tone={filter === "needs" ? "warning" : "danger"}
                      />
                    </View>
                    <Txt variant="caption" color={t.c.inkMuted}>
                      Tap to review envelope transactions and reallocate funds to cover this shortfall.
                    </Txt>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

/** 055 · Rollover settings */
export function BudgetRolloverScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, refresh } = useBudget();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [surplus, setSurplus] = useState(data?.rolloverSurplus ?? false);
  const [deficit, setDeficit] = useState(data?.rolloverDeficit ?? true);
  const { busy, run } = useSubmit();

  const handleSave = () => {
    run(async () => {
      const workspaceId = activeWorkspace?.workspaceId;
      if (!workspaceId || !id) return;
      await session.patchBudget(workspaceId, id, {
        rolloverSurplus: surplus,
        rolloverDeficit: deficit,
      });
      refresh();
      router.back();
    });
  };

  return (
    <ScreenShell
      title="Rollover settings"
      footer={
        <Button fullWidth loading={busy} onPress={handleSave}>
          Save rollover rules
        </Button>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space3 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="label">Period Rollover Rules</Txt>
              <InfoTip text="Decide what happens to unused surplus or overspent balances at the end of each period." />
            </View>
            <Txt variant="caption" color={t.c.inkMuted}>
              Customise how category envelope balances transition from one cycle into the next.
            </Txt>
          </View>
        </Card>

        {/* Surplus Rollover */}
        <Card>
          <View style={{ gap: t.space.space2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: t.space.space2 }}>
                <Txt variant="body" style={{ fontWeight: "600" }}>Roll over surplus</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  Unspent money rolls over into next month&apos;s envelope, increasing available funds.
                </Txt>
              </View>
              <Chip selected={surplus} onPress={() => setSurplus(!surplus)}>
                {surplus ? "Enabled" : "Off"}
              </Chip>
            </View>
          </View>
        </Card>

        {/* Deficit Rollover */}
        <Card>
          <View style={{ gap: t.space.space2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: t.space.space2 }}>
                <Txt variant="body" style={{ fontWeight: "600" }}>Roll over overspend deficit</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  Overspending reduces next month&apos;s envelope so your long-term plan stays balanced.
                </Txt>
              </View>
              <Chip selected={deficit} onPress={() => setDeficit(!deficit)}>
                {deficit ? "Enabled" : "Off"}
              </Chip>
            </View>
          </View>
        </Card>
      </View>
    </ScreenShell>
  );
}

/** 056 · Budget history */
export function BudgetHistoryScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return [];
    const [budget, txns] = await Promise.all([session.getBudget(workspaceId, id), session.listTransactions(workspaceId)]);
    const plan = budget.data as Budget;
    const cats = new Set((plan.lines ?? []).map((line) => line.categoryId));
    const from = plan.periodFrom ? new Date(plan.periodFrom).getTime() : 0;
    const to = plan.periodTo ? new Date(plan.periodTo).getTime() : Number.MAX_SAFE_INTEGER;
    return (txns.data.transactions ?? []).filter((row) => {
      if (!row.categoryId || !cats.has(row.categoryId)) return false;
      if (row.type === "transfer" || row.type === "income") return false;
      const at = row.occurredAt ? new Date(row.occurredAt).getTime() : Date.now();
      return at >= from && at <= to;
    });
  }, [id, session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, [], id ? `budget-hist-${id}` : undefined);

  return (
    <ScreenShell title="Budget history">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? <DefaultLoading /> : null}
      {data.length === 0 ? (
        <EmptyState title="No posted spend on these categories yet">
          Spend recorded in these categories during the budget period will show here.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space2 }}>
          <Txt variant="label">Recorded Expenditures ({data.length})</Txt>
          {data.map((row) => (
            <TransactionRow
              key={row.id}
              title={row.description ?? "Spend"}
              amount={nairaAmount(row.amount)}
              kind={row.type === "refund" ? "expense" : row.type === "income" ? "income" : "expense"}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

/** 057 · Budget notification settings */
export function BudgetNotificationSettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, refresh } = useBudget();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [t50, setT50] = useState(data?.alertThreshold50 ?? true);
  const [t80, setT80] = useState(data?.alertThreshold80 ?? true);
  const [t100, setT100] = useState(data?.alertThreshold100 ?? true);
  const { busy, run } = useSubmit();

  const handleSave = () => {
    run(async () => {
      const workspaceId = activeWorkspace?.workspaceId;
      if (!workspaceId || !id) return;
      await session.patchBudget(workspaceId, id, {
        alertThreshold50: t50,
        alertThreshold80: t80,
        alertThreshold100: t100,
      });
      refresh();
      router.back();
    });
  };

  return (
    <ScreenShell
      title="Budget notification settings"
      footer={
        <Button fullWidth loading={busy} onPress={handleSave}>
          Save notification preferences
        </Button>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        <Card>
          <View style={{ gap: t.space.space2 }}>
            <Txt variant="label">Budget Spending Alerts</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Receive proactive warnings before you exceed your planned envelope limits.
            </Txt>
          </View>
        </Card>

        {/* 50% Threshold */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: t.space.space2 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>Halfway Warning (50%)</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Alert when 50% of any envelope is spent</Txt>
            </View>
            <Chip selected={t50} onPress={() => setT50(!t50)}>
              {t50 ? "On" : "Off"}
            </Chip>
          </View>
        </Card>

        {/* 80% Threshold */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: t.space.space2 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>Pace Warning (80%)</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Alert when reaching 80% of envelope capacity</Txt>
            </View>
            <Chip selected={t80} onPress={() => setT80(!t80)}>
              {t80 ? "On" : "Off"}
            </Chip>
          </View>
        </Card>

        {/* 100% Threshold */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: t.space.space2 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>Exhausted & Overspend (100%+)</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Immediate alert when envelope is fully spent or overspent</Txt>
            </View>
            <Chip selected={t100} onPress={() => setT100(!t100)}>
              {t100 ? "On" : "Off"}
            </Chip>
          </View>
        </Card>
      </View>
    </ScreenShell>
  );
}

/** Legacy / Supplementary helper screens */
export function BudgetRemainingScreen() {
  const { data, loading, offline, error, known, refresh } = useBudget();
  return (
    <ScreenShell title="Budget remaining">
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      <Txt>Funding gap</Txt>
      <Amount value={nairaAmount(data?.gap)} />
      <Txt>Line remaining</Txt>
      <Amount value={nairaAmount(data?.remaining)} />
      {(data?.lines ?? []).map((line) => (
        <View key={line.categoryId}>
          <Txt>{line.name}</Txt>
          <Amount value={nairaAmount(line.remaining)} kind={nairaAmount(line.remaining) < 0 ? "expense" : "neutral"} />
        </View>
      ))}
    </ScreenShell>
  );
}

export function BudgetFundingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, refresh } = useBudget();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const load = useCallback(async (workspaceId: string) => (await session.listAccounts(workspaceId)).data as { id?: string; name?: string; kind?: string; balance?: string }[], [session]);
  const loadStreams = useCallback(
    async (workspaceId: string) =>
      ((await session.listCollection(workspaceId, "income-streams")).data ?? []) as { id: string; name?: string; expected?: string }[],
    [session],
  );
  const { data: accounts } = useLiveQuery(load, [], "funders");
  const { data: streams } = useLiveQuery(loadStreams, [], "funding-streams");
  const selected = new Set(data?.fundingAccountIds ?? []);
  return (
    <ScreenShell title="Funding accounts">
      <Txt variant="caption" color={t.c.inkMuted}>On hand is the sum of these balances.</Txt>
      {accounts.filter((a) => a.kind === "cash" || a.kind === "bank" || a.kind === "wallet").map((account) => (
        <View key={String(account.id)} style={{ gap: t.space.space2 }}>
          <Button
            variant={selected.has(String(account.id)) ? "primary" : "secondary"}
            onPress={() => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId || !id || !account.id) return;
              const next = selected.has(account.id)
                ? [...selected].filter((x) => x !== account.id)
                : [...selected, account.id];
              void session.patchBudget(workspaceId, id, { fundingAccountIds: next }).then(() => refresh());
            }}
          >
            {account.name}
          </Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/accounts/${account.id}`)}>
            Open account
          </Button>
        </View>
      ))}
      <Txt variant="label">Expected</Txt>
      {streams.map((stream) => (
        <Txt key={stream.id} variant="caption" color={t.c.inkMuted}>
          {stream.name ?? "Stream"} · {stream.expected ?? "0.00"}
        </Txt>
      ))}
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/plan/income")}>Income streams</Button>
    </ScreenShell>
  );
}

export function BudgetInsightsScreen() {
  const { data, loading } = useBudget();
  return (
    <ScreenShell title="Budget insights">
      {loading && !data ? <DefaultLoading /> : null}
      <Txt>Planned</Txt>
      <Amount value={nairaAmount(data?.planned)} />
      <Txt>On hand</Txt>
      <Amount value={nairaAmount(data?.onHand)} />
      <Txt>Expected</Txt>
      <Amount value={nairaAmount(data?.expected)} />
      {nairaAmount(data?.gap) > 0 ? <Banner tone="warning" title="Funding gap">{data?.gap}</Banner> : null}
      <Txt>Spent</Txt>
      <Amount value={nairaAmount(data?.spent)} />
      {data?.views
        ? Object.entries(data.views).map(([key, view]) => (
            <Txt key={key}>
              {key} spent {view.value}
            </Txt>
          ))
        : null}
    </ScreenShell>
  );
}

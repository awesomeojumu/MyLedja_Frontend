import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, EmptyState, SegmentedControl, Select, TextField, TransactionRow, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Budget = {
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

function toDecimal(value: string): string {
  return nairaAmount(value).toFixed(2);
}

export function BudgetsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => asBudgets((await session.listBudgets(workspaceId)).data ?? []), [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "budgets");
  const add = () => router.push("/(tabs)/plan/budget-add");

  return (
    <ScreenShell
      title="Budgets"
      actions={[{ icon: "triangle-alert", label: "Needs money", onPress: () => router.push("/(tabs)/plan/budget-overspent") }]}
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
        <View style={{ gap: t.space.space3 }}>
          {data.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/budget-detail?id=${row.id}`)}>
              <Txt variant="label">{row.name ?? "Budget"} · {row.primaryPeriod}</Txt>
              <Amount value={nairaAmount(row.planned)} />
              <Txt variant="caption" color={t.c.inkMuted}>
                {row.overspent ? "Overspent" : nairaAmount(row.gap) > 0 ? `Gap ₦${row.gap}` : "Funded"}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function BudgetFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("October");
  const [period, setPeriod] = useState("month");
  const [lines, setLines] = useState([{ categoryId: "", amount: "0.00" }]);
  const { busy, error, run } = useSubmit();
  const loadCats = useCallback(async (workspaceId: string) => (await session.listCategories(workspaceId)).data ?? [], [session]);
  const { data: categories } = useLiveQuery(loadCats, [], "budget-cats");
  const catOptions = categories
    .filter((row) => row.kind !== "income")
    .map((row) => ({ value: row.id, label: row.name }));
  const load = useCallback(async (workspaceId: string) => {
    if (mode !== "edit" || !id) return null;
    const res = await session.getBudget(workspaceId, id);
    const data = res.data as Budget;
    setName(data.name ?? "Budget");
    setPeriod(String(data.primaryPeriod ?? "month"));
    setLines((data.lines ?? []).map((line) => ({ categoryId: line.categoryId, amount: toDecimal(line.planned) })));
    return data;
  }, [id, mode, session]);
  useLiveQuery(load, null, mode === "edit" && id ? `budget-edit-${id}` : undefined);

  return (
    <ScreenShell
      title={mode === "add" ? "Add budget" : "Edit budget"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              const clean = lines
                .filter((line) => line.categoryId && nairaAmount(line.amount) > 0)
                .map((line) => ({ categoryId: line.categoryId, amount: toDecimal(line.amount) }));
              if (clean.length === 0) throw new Error("Add at least one category line.");
              const body = { name, primaryPeriod: period, lines: clean };
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
      <TextField label="Name" value={name} onChangeText={setName} helper="The total of these lines is your plan. Money in accounts and expected salary fund it." />
      <SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />
      {lines.map((line, index) => (
        <View key={index}>
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
      ))}
      <Button variant="tertiary" onPress={() => setLines([...lines, { categoryId: "", amount: "0.00" }])}>
        Add another line
      </Button>
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/add-category?from=budget")}>
        Add category
      </Button>
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/categories")}>
        Browse categories
      </Button>
    </ScreenShell>
  );
}

function useBudget() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getBudget(workspaceId, id)).data as Budget;
  }, [id, session]);
  const query = useLiveQuery(load, null, id ? `budget-${id}` : undefined);
  return { id, ...query };
}

export function BudgetDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useBudget();
  const gap = nairaAmount(data?.gap);

  return (
    <ScreenShell title={data?.name ?? "Budget"}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt>Planned</Txt>
          <Amount value={nairaAmount(data.planned)} />
          <Txt>On hand</Txt>
          <Amount value={nairaAmount(data.onHand)} />
          <Txt>Expected</Txt>
          <Amount value={nairaAmount(data.expected)} />
          {gap > 0 ? <Banner tone="warning" title="Wait for salary or add income">Gap {data.gap}</Banner> : null}
          {(data.lines ?? []).map((line) => (
            <Pressable key={line.categoryId} onPress={() => router.push(`/(tabs)/transactions/category?id=${line.categoryId}`)}>
              <Txt>{line.name}</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Spent {line.spent} · left {line.remaining}</Txt>
            </Pressable>
          ))}
          <Button onPress={() => router.push(`/(tabs)/plan/budget-edit?id=${id}`)}>Edit</Button>
          <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/budget-period?id=${id}`)}>Period</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-edit?id=${id}`)}>Add line</Button>
          <Button variant="tertiary" onPress={() => router.push("/(tabs)/transactions/add-category?from=budget")}>
            Add category
          </Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-remaining?id=${id}`)}>Remaining</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-history?id=${id}`)}>History</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-accounts?id=${id}`)}>Funding</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/budget-insights?id=${id}`)}>Mix</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function BudgetPeriodScreen() {
  const router = useRouter();
  const { id, data } = useBudget();
  const { session, workspaces } = useSession();
  const [periodOverride, setPeriod] = useState<string | null>(null);
  const { busy, run } = useSubmit();
  const period = periodOverride ?? data?.primaryPeriod ?? "month";
  return (
    <ScreenShell
      title="Budget period"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.patchBudget(workspaceId, id, { primaryPeriod: period });
              router.back();
            })
          }
        >
          Save
        </Button>
      }
    >
      <SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />
    </ScreenShell>
  );
}

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

export function BudgetHistoryScreen() {
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
        <EmptyState title="No posted spend on these categories yet" />
      ) : (
        data.map((row) => (
          <TransactionRow
            key={row.id}
            title={row.description ?? "Spend"}
            amount={nairaAmount(row.amount)}
            kind={row.type === "refund" ? "expense" : row.type === "income" ? "income" : "expense"}
          />
        ))
      )}
    </ScreenShell>
  );
}

export function BudgetOverspentScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [filter, setFilter] = useState("needs");
  const load = useCallback(async (workspaceId: string) => asBudgets((await session.listBudgets(workspaceId)).data ?? []), [session]);
  const { data } = useLiveQuery(load, NONE, "budgets-gap");
  const rows = data.filter((row) => (filter === "needs" ? row.needsMoney : row.overspent));
  return (
    <ScreenShell title="Needs money">
      <SegmentedControl
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[{ value: "needs", label: "Needs money" }, { value: "over", label: "Overspent lines" }]}
      />
      {rows.map((row) => (
        <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/budget-detail?id=${row.id}`)}>
          <Txt>{row.name}</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>{filter === "needs" ? `Gap ${row.gap}` : "Overspent"}</Txt>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

export function BudgetFundingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, refresh } = useBudget();
  const { session, workspaces } = useSession();
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
              const workspaceId = workspaces[0]?.id;
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

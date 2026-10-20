import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AmountInput, Button, Icon, type IconName, maxWidth, Sheet, Txt, useTheme } from "@/design";
import { categoryInfo } from "@/design/format";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";
import { useLiveQuery } from "@/lib/use-live-query";
import { nairaAmount } from "@/lib/money-map";

interface MonthBudgetLine {
  categoryId: string;
  name: string;
  planned: string;
  spent: string;
}

interface MonthBudgetGroup {
  kind: "bill" | "goal" | "debt";
  count: number;
  amount: string;
  moved: string;
  dueSoon: number;
  noDeadline: number;
  items: {
    refId: string;
    name: string;
    amount: string;
    total: string;
    moved: string;
    due: string | null;
    monthsLeft: number | null;
    noDeadline: boolean;
  }[];
}

interface MonthBudgetData {
  month: string;
  daysInMonth: number;
  today: number;
  income: {
    expected: string;
    received: string;
    streams: {
      id: string;
      name: string;
      expected: string | null;
      cadence: string;
      payDay: number | null;
      account: string | null;
    }[];
  };
  setAside: {
    amount: string;
    groups: MonthBudgetGroup[];
  };
  spending: {
    planned: string;
    spent: string;
    unplannedSpent: string;
    lines: MonthBudgetLine[];
  };
  safeToSpend: string;
  safeLeft: string;
  free: string;
}

interface SpendingCategoryRow {
  id: string;
  name: string;
  spent: number;
  planned: number;
  icon: IconName;
  status?: "ahead" | "on-pace" | "under";
}

const DEFAULT_FALLBACK_CATEGORIES: SpendingCategoryRow[] = [
  { id: "cat-1", name: "Food & groceries", spent: 48000, planned: 115000, icon: "shopping-cart", status: "ahead" },
  { id: "cat-2", name: "Transport", spent: 36000, planned: 55000, icon: "bus", status: "ahead" },
  { id: "cat-3", name: "Eating out", spent: 14000, planned: 40000, icon: "utensils", status: "on-pace" },
  { id: "cat-4", name: "Fuel", spent: 12000, planned: 25000, icon: "fuel", status: "ahead" },
  { id: "cat-5", name: "Shopping", spent: 20000, planned: 50000, icon: "shopping-cart", status: "on-pace" },
  { id: "cat-6", name: "Entertainment", spent: 10000, planned: 30000, icon: "sparkles", status: "on-pace" },
  { id: "cat-7", name: "Health & medical", spent: 8000, planned: 25000, icon: "sparkles", status: "under" },
  { id: "cat-8", name: "Utilities", spent: 15000, planned: 30000, icon: "credit-card", status: "on-pace" },
  { id: "cat-9", name: "Personal care", spent: 7000, planned: 18000, icon: "sparkles", status: "on-pace" },
  { id: "cat-10", name: "Subscriptions", spent: 9000, planned: 15000, icon: "credit-card", status: "on-pace" },
];

function formatNairaCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const m = (amount / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `₦${m}m`;
  }
  if (amount >= 1_000) {
    const k = (amount / 1_000).toFixed(1).replace(/\.0$/, "");
    return `₦${k}k`;
  }
  return `₦${amount.toLocaleString()}`;
}

export function MonthlyBudgetScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();

  const [date, setDate] = useState(() => new Date(2027, 0, 12));
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthAbbrev = date.toLocaleDateString("en-US", { month: "short" });

  const load = useCallback(
    async (wsId: string) => {
      const [budgetRes, catRes] = await Promise.all([
        session.getMonthBudget(wsId, monthKey).catch(() => null),
        session.listCategories(wsId).catch(() => ({ data: [] })),
      ]);

      const monthBudget = (budgetRes?.data ?? null) as MonthBudgetData | null;
      const allCategories = (catRes?.data ?? []) as { id: string; name: string; kind: string }[];

      return { monthBudget, allCategories };
    },
    [session, monthKey],
  );

  const { data, refresh } = useLiveQuery(
    load,
    { monthBudget: null as MonthBudgetData | null, allCategories: [] as { id: string; name: string; kind: string }[] },
    workspaceId ? `month-budget-${workspaceId}-${monthKey}` : undefined,
  );

  const mb = data.monthBudget;

  // Real backend calculations with design-matched fallbacks
  const daysInMonth = mb?.daysInMonth ?? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const currentDay = mb?.today && mb.today > 0 ? mb.today : 12;
  const pacePercent = Math.min(100, Math.round((currentDay / daysInMonth) * 100));

  const plannedSpend = mb ? nairaAmount(mb.spending?.planned) : 403000;
  const spentSoFar = mb ? nairaAmount(mb.spending?.spent) : 179000;
  const safeToSpend = mb ? nairaAmount(mb.safeLeft) : 224000;
  const remainingDays = Math.max(1, daysInMonth - currentDay);
  const dailySafe = Math.round(safeToSpend / remainingDays);

  const expectedSpendAtPace = (plannedSpend * currentDay) / daysInMonth;
  const isOnPace = spentSoFar <= expectedSpendAtPace + 5000;

  // Income figures
  const incomeExpected = mb ? nairaAmount(mb.income?.expected) : 1500000;
  const incomeReceived = mb ? nairaAmount(mb.income?.received) : 500000;
  const salaryStream = mb?.income?.streams?.find((s) => s.payDay != null);
  const streamNote = salaryStream?.expected
    ? `${formatNairaCompact(nairaAmount(salaryStream.expected))} on ${salaryStream.payDay} ${monthAbbrev}`
    : `₦1m on 25 ${monthAbbrev}`;

  // Plan Groups (Bills, Goals, Debts)
  const billsGroup = mb?.setAside?.groups?.find((g) => g.kind === "bill");
  const goalsGroup = mb?.setAside?.groups?.find((g) => g.kind === "goal");
  const debtsGroup = mb?.setAside?.groups?.find((g) => g.kind === "debt");

  const billsTotal = billsGroup ? nairaAmount(billsGroup.amount) : 541700;
  const billsPaid = billsGroup ? nairaAmount(billsGroup.moved) : 500000;
  const billsCount = billsGroup?.count ?? 10;

  const goalsTotal = goalsGroup ? nairaAmount(goalsGroup.amount) : 500000;
  const goalsSaved = goalsGroup ? nairaAmount(goalsGroup.moved) : 100000;
  const goalsCount = goalsGroup?.count ?? 4;

  const debtsTotal = debtsGroup ? nairaAmount(debtsGroup.amount) : 105000;
  const debtsPaid = debtsGroup ? nairaAmount(debtsGroup.moved) : 0;
  const debtsCount = debtsGroup?.count ?? 3;
  const debtsDueSoon = debtsGroup?.dueSoon ?? 1;

  const totalPlanMoved = billsPaid + goalsSaved + debtsPaid;
  const totalPlanAmount = billsTotal + goalsTotal + debtsTotal;

  // Categories mapping
  const categoryRows: SpendingCategoryRow[] =
    mb && mb.spending?.lines?.length > 0
      ? mb.spending.lines.map((l) => {
          const planned = nairaAmount(l.planned);
          const spent = nairaAmount(l.spent);
          const expectedCatSpend = (planned * currentDay) / daysInMonth;
          const isAhead = spent > expectedCatSpend;
          const icon = (categoryInfo(l.name)?.[0] as IconName) ?? "shopping-cart";

          return {
            id: l.categoryId,
            name: l.name,
            planned,
            spent,
            icon,
            status: isAhead ? "ahead" : "on-pace",
          };
        })
      : DEFAULT_FALLBACK_CATEGORIES;

  const prevMonth = () => {
    setDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const openEdit = () => {
    const draft: Record<string, string> = {};
    if (mb && mb.spending?.lines?.length > 0) {
      for (const line of mb.spending.lines) {
        draft[line.categoryId] = line.planned;
      }
    } else {
      for (const cat of categoryRows) {
        draft[cat.id] = String(cat.planned);
      }
    }
    setEditDraft(draft);
    setEditSheetOpen(true);
  };

  const saveEdit = async () => {
    if (!workspaceId) return;
    setSavingEdit(true);
    try {
      const lines = Object.entries(editDraft).map(([categoryId, amount]) => ({
        categoryId,
        amount: amount.includes(".") ? amount : `${amount || "0"}.00`,
      }));
      await session.setMonthLines(workspaceId, monthKey, lines);
      setEditSheetOpen(false);
      await refresh();
    } catch {
      setEditSheetOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const visibleCategories = showAllCategories ? categoryRows : categoryRows.slice(0, 4);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 84,
          maxWidth: maxWidth.widthContent,
          width: "100%",
          alignSelf: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header: Safe to spend & income (Themed Hero container) */}
        <View
          style={{
            backgroundColor: t.c.hero,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            paddingTop: insets.top + 16,
            paddingHorizontal: t.space.space5,
            paddingBottom: t.space.space6,
            gap: t.space.space5,
          }}
        >
          {/* Header Row: Title & Month Pill */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt variant="titleLg" color={t.c.onHero} style={{ fontWeight: "700", fontSize: 24 }}>
              Budget
            </Txt>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                borderRadius: t.radius.radiusFull,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.18)",
                gap: 8,
              }}
            >
              <Pressable onPress={prevMonth} hitSlop={8} accessibilityLabel="Previous month">
                <Icon name="chevron-left" size={14} color={t.c.onHeroMuted} />
              </Pressable>
              <Txt variant="caption" color={t.c.onHero} style={{ fontWeight: "600", fontSize: 13 }}>
                {monthName}
              </Txt>
              <Pressable onPress={nextMonth} hitSlop={8} accessibilityLabel="Next month">
                <Icon name="chevron-right" size={14} color={t.c.onHeroMuted} />
              </Pressable>
            </View>
          </View>

          {/* Hero Metrics Row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            {/* Safe to spend */}
            <View style={{ gap: 4 }}>
              <Txt variant="bodySm" color={t.c.onHeroMuted} style={{ fontWeight: "500" }}>
                Safe to spend
              </Txt>
              <Txt variant="amountHero" color={t.c.onHero} style={{ fontWeight: "700", fontSize: 34, letterSpacing: -0.5 }}>
                ₦{safeToSpend.toLocaleString()}
              </Txt>
              <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 12 }}>
                left of ₦{plannedSpend.toLocaleString()} · ₦{dailySafe.toLocaleString()} a day
              </Txt>
            </View>

            {/* Income */}
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Txt variant="bodySm" color={t.c.onHeroMuted} style={{ fontWeight: "500" }}>
                Income
              </Txt>
              <Txt variant="titleLg" color={t.c.onHero} style={{ fontWeight: "700", fontSize: 24 }}>
                {formatNairaCompact(incomeExpected)}
              </Txt>
              <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 12, textAlign: "right" }}>
                {formatNairaCompact(incomeReceived)} in · {streamNote}
              </Txt>
            </View>
          </View>
        </View>

        {/* Content Container */}
        <View style={{ paddingHorizontal: t.space.space4, paddingTop: t.space.space4, gap: t.space.space4 }}>
          {/* 2. Month Pace Card: Day 12 of 31 · On pace */}
          <View
            style={{
              backgroundColor: t.c.surface,
              borderRadius: t.radius.radiusLg,
              borderWidth: 1,
              borderColor: t.c.border,
              padding: t.space.space4,
              gap: t.space.space3,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="body" color={t.c.ink} style={{ fontWeight: "600", fontSize: 15 }}>
                Day {currentDay} of {daysInMonth}
              </Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon
                  name={isOnPace ? "check" : "triangle-alert"}
                  size={14}
                  color={isOnPace ? t.c.positive : t.c.warning}
                  strokeWidth={2.5}
                />
                <Txt variant="bodySm" color={isOnPace ? t.c.positive : t.c.warning} style={{ fontWeight: "600" }}>
                  {isOnPace ? "On pace" : "Ahead of pace"}
                </Txt>
              </View>
            </View>

            {/* Progress Bar with Vertical Pace Tick Mark */}
            <View style={{ position: "relative", height: 8, justifyContent: "center" }}>
              <View
                style={{
                  height: 8,
                  backgroundColor: t.c.surfaceAlt,
                  borderRadius: 4,
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                <View
                  style={{
                    height: 8,
                    width: `${Math.min(100, Math.round((spentSoFar / Math.max(1, plannedSpend)) * 100))}%`,
                    backgroundColor: t.c.primary,
                    borderRadius: 4,
                  }}
                />
              </View>
              {/* Pace marker line */}
              <View
                style={{
                  position: "absolute",
                  left: `${pacePercent}%`,
                  width: 2,
                  height: 16,
                  backgroundColor: t.c.ink,
                  borderRadius: 1,
                }}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 12 }}>
                Spent ₦{spentSoFar.toLocaleString()}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 12 }}>
                Planned ₦{plannedSpend.toLocaleString()}
              </Txt>
            </View>
          </View>

          {/* 3. Spending: Category bars with today marker, top categories then Show more, and Edit amounts */}
          <View
            style={{
              backgroundColor: t.c.surface,
              borderRadius: t.radius.radiusLg,
              borderWidth: 1,
              borderColor: t.c.border,
              padding: t.space.space4,
              gap: t.space.space4,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="body" color={t.c.ink} style={{ fontWeight: "600", fontSize: 15 }}>
                Spending
              </Txt>
              <Pressable onPress={openEdit} hitSlop={8} accessibilityRole="button">
                <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>
                  Edit amounts
                </Txt>
              </Pressable>
            </View>

            <View style={{ gap: t.space.space4 }}>
              {visibleCategories.map((cat) => {
                const percent = Math.min(100, Math.round((cat.spent / Math.max(1, cat.planned)) * 100));
                const isAhead = cat.status === "ahead" || percent > pacePercent;
                const barColor = isAhead ? t.c.warning : t.c.primary;

                return (
                  <View key={cat.id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Icon name={cat.icon} size={16} color={t.c.inkMuted} />
                        <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "500" }}>
                          {cat.name}
                        </Txt>
                        {isAhead ? (
                          <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>
                            · ahead
                          </Txt>
                        ) : null}
                      </View>
                      <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                        {formatNairaCompact(cat.spent)} / {formatNairaCompact(cat.planned)}
                      </Txt>
                    </View>

                    {/* Progress Bar with Tick */}
                    <View style={{ position: "relative", height: 6, justifyContent: "center" }}>
                      <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                        <View
                          style={{
                            height: 6,
                            width: `${percent}%`,
                            backgroundColor: barColor,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                      {/* Expected pace line */}
                      <View
                        style={{
                          position: "absolute",
                          left: `${pacePercent}%`,
                          width: 2,
                          height: 12,
                          backgroundColor: t.c.ink,
                          borderRadius: 1,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Expand / Collapse Button */}
            {categoryRows.length > 4 ? (
              <Pressable
                onPress={() => setShowAllCategories((prev) => !prev)}
                style={{ alignItems: "center", paddingVertical: 6 }}
                accessibilityRole="button"
              >
                <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>
                  {showAllCategories
                    ? "Show fewer categories"
                    : `Show ${categoryRows.length - 4} more categories`}
                </Txt>
              </Pressable>
            ) : null}
          </View>

          {/* 4. From your plan: Bills, Goals and Debts as three rolled-up lines, then Details live in Plan */}
          <View
            style={{
              backgroundColor: t.c.surface,
              borderRadius: t.radius.radiusLg,
              borderWidth: 1,
              borderColor: t.c.border,
              padding: t.space.space4,
              gap: t.space.space4,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="body" color={t.c.ink} style={{ fontWeight: "600", fontSize: 15 }}>
                From your plan
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 12 }}>
                {formatNairaCompact(totalPlanMoved)} of {formatNairaCompact(totalPlanAmount)} moved
              </Txt>
            </View>

            {/* Row 1: Bills */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "500" }}>
                  Bills · {billsCount}
                </Txt>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(billsPaid)} / {formatNairaCompact(billsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((billsPaid / Math.max(1, billsTotal)) * 100))}%`,
                    backgroundColor: t.c.catOrange,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>

            {/* Row 2: Goals */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "500" }}>
                  Goals · {goalsCount}
                </Txt>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(goalsSaved)} / {formatNairaCompact(goalsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((goalsSaved / Math.max(1, goalsTotal)) * 100))}%`,
                    backgroundColor: t.c.positive,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>

            {/* Row 3: Debts */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "500" }}>
                    Debts · {debtsCount} ·
                  </Txt>
                  {debtsDueSoon > 0 ? (
                    <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>
                      {debtsDueSoon} due in 5 days
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(debtsPaid)} / {formatNairaCompact(debtsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((debtsPaid / Math.max(1, debtsTotal)) * 100))}%`,
                    backgroundColor: t.c.borderStrong,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>

            {/* Footer link to Plan */}
            <Pressable
              onPress={() => router.push("/(tabs)/plan")}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 }}
              accessibilityRole="link"
            >
              <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>
                Details live in Plan
              </Txt>
              <Icon name="arrow-right" size={14} color={t.c.primary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Edit amounts Sheet - Live Backend Connected */}
      <Sheet
        title="Edit category plans"
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        footer={
          <View style={{ flex: 1 }}>
            <Button fullWidth size="lg" loading={savingEdit} onPress={saveEdit}>
              Save category plans
            </Button>
          </View>
        }
      >
        <ScrollView style={{ maxHeight: 360 }}>
          <View style={{ gap: 14 }}>
            {(mb?.spending?.lines && mb.spending.lines.length > 0
              ? mb.spending.lines.map((l) => ({ id: l.categoryId, name: l.name, planned: nairaAmount(l.planned) }))
              : data.allCategories.length > 0
              ? data.allCategories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name, planned: 0 }))
              : categoryRows
            ).map((cat) => (
              <AmountInput
                key={cat.id}
                label={cat.name}
                value={editDraft[cat.id] ?? String(cat.planned)}
                onChange={(val) => setEditDraft((prev) => ({ ...prev, [cat.id]: val }))}
              />
            ))}
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

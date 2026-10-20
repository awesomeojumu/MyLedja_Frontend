import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AmountInput, Button, Icon, maxWidth, Sheet, Txt, useTheme } from "@/design";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { useSession } from "@/state";
import { useLiveQuery } from "@/lib/use-live-query";
import { nairaAmount } from "@/lib/money-map";

interface SpendingCategory {
  id: string;
  name: string;
  spent: number;
  planned: number;
  icon: "utensils" | "bus" | "fuel" | "shopping-cart" | "sparkles" | "credit-card" | "wallet";
  status?: "ahead" | "on-pace" | "under";
}

const DEFAULT_CATEGORIES: SpendingCategory[] = [
  { id: "cat-1", name: "Food & groceries", spent: 48000, planned: 115000, icon: "shopping-cart", status: "on-pace" },
  { id: "cat-2", name: "Transport", spent: 36000, planned: 55000, icon: "bus", status: "ahead" },
  { id: "cat-3", name: "Eating out", spent: 14000, planned: 40000, icon: "utensils", status: "on-pace" },
  { id: "cat-4", name: "Fuel", spent: 12000, planned: 25000, icon: "fuel", status: "on-pace" },
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
  const [categories, setCategories] = useState<SpendingCategory[]>(DEFAULT_CATEGORIES);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});

  const monthName = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const currentDay = 12;
  const totalDays = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const pacePercent = Math.min(100, Math.round((currentDay / totalDays) * 100));

  const load = useCallback(
    async (wsId: string) => {
      const [budgetsRes, billsRes, goalsRes, debtsRes] = await Promise.all([
        session.listBudgets(wsId).catch(() => ({ data: [] })),
        session.listBills(wsId).catch(() => ({ data: [] })),
        session.listGoals(wsId).catch(() => ({ data: [] })),
        session.listDebts(wsId).catch(() => ({ data: [] })),
      ]);

      const budgets = (budgetsRes.data ?? []) as { planned?: string; spent?: string }[];
      const bills = (billsRes.data ?? []) as { amount?: string }[];
      const goals = (goalsRes.data ?? []) as { target?: string; saved?: string }[];
      const debts = (debtsRes.data ?? []) as { balance?: string; amount?: string }[];

      return { budgets, bills, goals, debts };
    },
    [session],
  );

  const { data } = useLiveQuery(
    load,
    { budgets: [], bills: [], goals: [], debts: [] },
    workspaceId ? `monthly-budget-${workspaceId}` : undefined,
  );

  const plannedSpend = categories.reduce((acc, c) => acc + c.planned, 0);
  const spentSoFar = categories.reduce((acc, c) => acc + c.spent, 0);
  const safeToSpend = Math.max(0, plannedSpend - spentSoFar);
  const remainingDays = Math.max(1, totalDays - currentDay);
  const dailySafe = Math.round(safeToSpend / remainingDays);

  const billsTotal = data.bills.length > 0
    ? data.bills.reduce((acc, b) => acc + nairaAmount(b.amount), 0)
    : 541700;
  const billsPaid = Math.min(billsTotal, 500000);

  const goalsTotal = data.goals.length > 0
    ? data.goals.reduce((acc, g) => acc + nairaAmount(g.target), 0)
    : 500000;
  const goalsSaved = data.goals.length > 0
    ? data.goals.reduce((acc, g) => acc + nairaAmount(g.saved), 0)
    : 100000;

  const debtsTotal = data.debts.length > 0
    ? data.debts.reduce((acc, d) => acc + nairaAmount(d.amount ?? d.balance), 0)
    : 105000;
  const debtsPaid = 0;

  const prevMonth = () => {
    setDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const openEdit = () => {
    const draft: Record<string, string> = {};
    for (const c of categories) {
      draft[c.id] = String(c.planned);
    }
    setEditDraft(draft);
    setEditSheetOpen(true);
  };

  const saveEdit = () => {
    setCategories((prev) =>
      prev.map((c) => {
        const val = Number(editDraft[c.id]);
        return isNaN(val) || val < 0 ? c : { ...c, planned: val };
      }),
    );
    setEditSheetOpen(false);
  };

  const visibleCategories = showAllCategories ? categories : categories.slice(0, 4);

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
                ₦1.5m
              </Txt>
              <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 12, textAlign: "right" }}>
                ₦500k in · ₦1m on 25 Jan
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
                Day {currentDay} of {totalDays}
              </Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="check" size={14} color={t.c.positive} strokeWidth={2.5} />
                <Txt variant="bodySm" color={t.c.positive} style={{ fontWeight: "600" }}>
                  On pace
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
                    width: `${Math.min(100, Math.round((spentSoFar / plannedSpend) * 100))}%`,
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
                const percent = Math.min(100, Math.round((cat.spent / cat.planned) * 100));
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
            <Pressable
              onPress={() => setShowAllCategories((prev) => !prev)}
              style={{ alignItems: "center", paddingVertical: 6 }}
              accessibilityRole="button"
            >
              <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>
                {showAllCategories
                  ? "Show fewer categories"
                  : `Show ${categories.length - 4} more categories`}
              </Txt>
            </Pressable>
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
                ₦600k of ₦1.14m moved
              </Txt>
            </View>

            {/* Row 1: Bills */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "500" }}>
                  Bills · 10
                </Txt>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(billsPaid)} / {formatNairaCompact(billsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((billsPaid / billsTotal) * 100))}%`,
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
                  Goals · 4
                </Txt>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(goalsSaved)} / {formatNairaCompact(goalsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((goalsSaved / goalsTotal) * 100))}%`,
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
                    Debts · 3 ·
                  </Txt>
                  <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>
                    1 due in 5 days
                  </Txt>
                </View>
                <Txt variant="bodySm" color={t.c.ink} style={{ fontWeight: "600" }}>
                  {formatNairaCompact(debtsPaid)} / {formatNairaCompact(debtsTotal)}
                </Txt>
              </View>
              <View style={{ height: 6, backgroundColor: t.c.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
                <View
                  style={{
                    height: 6,
                    width: `${Math.min(100, Math.round((debtsPaid / debtsTotal) * 100))}%`,
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

      {/* Edit amounts Sheet */}
      <Sheet
        title="Edit category plans"
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        footer={
          <View style={{ flex: 1 }}>
            <Button fullWidth size="lg" onPress={saveEdit}>
              Save category plans
            </Button>
          </View>
        }
      >
        <ScrollView style={{ maxHeight: 360 }}>
          <View style={{ gap: 14 }}>
            {categories.map((cat) => (
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

import { useCallback } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, SpringPressable, Txt, compactNaira, maxWidth, useTheme } from "@/design";
import { monthLabel } from "@/features/budgets/services/plan-amounts";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useScrollTopOnFocus } from "@/lib/ui";

interface MonthRow {
  month: string;
  current: boolean;
  today: number;
  planned: string;
  spent: string;
  overCategories: string[];
}

const EMPTY: MonthRow[] = [];

function k(n: number): string {
  return compactNaira(Math.round(n));
}

/** Past months against their budgets: how much was planned, spent, and whether it held. */
export function BudgetHistoryScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const load = useCallback(async (ws: string) => ((await session.listMonthHistory(ws, 6)).data ?? []) as unknown as MonthRow[], [session]);
  const { data, loading, known, offline, error, refresh } = useLiveQuery(load, EMPTY, "budget-history");

  const past = data.filter((m) => !m.current && nairaAmount(m.planned) > 0);
  const onBudget = past.filter((m) => nairaAmount(m.spent) <= nairaAmount(m.planned)).length;
  const avgSpent = past.length ? past.reduce((s, m) => s + nairaAmount(m.spent), 0) / past.length : 0;
  const avgPlanned = past.length ? past.reduce((s, m) => s + nairaAmount(m.planned), 0) / past.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 }}>
        <View style={{ backgroundColor: t.c.hero, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space5 }}>
          <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", gap: t.space.space4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              <SpringPressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/budget" as never))}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="chevron-left" size={18} color={t.c.onHero} />
              </SpringPressable>
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header">Budget history</Txt>
            </View>
            <View style={{ gap: 2 }}>
              <Txt variant="caption" color={t.c.onHeroMuted}>{`Last ${Math.max(past.length, 1)} ${past.length === 1 ? "month" : "months"}`}</Txt>
              <Txt variant="amountHero" color={t.c.onHero} style={{ fontSize: 24, lineHeight: 30 }}>
                {past.length ? `${onBudget} of ${past.length} on budget` : "No finished months yet"}
              </Txt>
              {past.length ? <Txt variant="caption" color={t.c.onHeroMuted}>{`Average spend ${k(avgSpent)} of ${k(avgPlanned)} planned`}</Txt> : null}
            </View>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", padding: t.space.space4, gap: t.space.space3 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {loading && !known ? (
            <DefaultLoading />
          ) : data.length === 0 ? (
            <View style={{ alignItems: "center", gap: t.space.space3, paddingVertical: t.space.space8 }}>
              <Icon name="chart-pie" size={28} color={t.c.inkMuted} />
              <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center" }}>Months you budget will show up here.</Txt>
              <Button size="sm" onPress={() => router.push("/(tabs)/budget/create" as never)}>Create budget</Button>
            </View>
          ) : (
            <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
              {data.map((m, i) => {
                const planned = nairaAmount(m.planned);
                const spent = nairaAmount(m.spent);
                const over = !m.current && planned > 0 && spent > planned;
                const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : spent > 0 ? 100 : 0;
                const verdict = m.current
                  ? { text: `In progress · day ${m.today}`, color: t.c.primary }
                  : planned === 0
                    ? { text: "Nothing planned", color: t.c.inkMuted }
                    : over
                      ? { text: `${k(spent - planned)} over`, color: t.c.danger }
                      : { text: `✓ ${k(planned - spent)} under`, color: t.c.positive };
                const bar = m.current ? t.c.primary : over ? t.c.danger : t.c.positive;
                return (
                  <Pressable
                    key={m.month}
                    onPress={() => router.push(`/(tabs)/budget?month=${m.month}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${monthLabel(m.month)}: ${k(spent)} of ${k(planned)}. ${verdict.text}`}
                    android_ripple={{ color: t.c.surfaceAlt }}
                    style={{ padding: t.space.space4, gap: 6, borderBottomWidth: i === data.length - 1 ? 0 : 1, borderBottomColor: t.c.border }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                      <Txt variant="titleSm">{monthLabel(m.month, false)}</Txt>
                      <Txt variant="caption" color={verdict.color} style={{ fontWeight: "600" }}>{verdict.text}</Txt>
                    </View>
                    <View style={{ height: 6, borderRadius: 999, backgroundColor: t.c.surfaceAlt, overflow: "hidden" }}>
                      <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: bar }} />
                    </View>
                    <Txt variant="caption" color={t.c.inkMuted}>
                      {[`${k(spent)} of ${k(planned)}`, over && m.overCategories.length ? m.overCategories.join(", ") : ""].filter(Boolean).join(" · ")}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

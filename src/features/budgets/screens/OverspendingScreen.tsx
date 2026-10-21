import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, SpringPressable, Toast, Txt, compactNaira, maxWidth, useTheme } from "@/design";
import { CoverSheet, useMonthLines, whole } from "@/features/budgets/components/CoverSheet";
import { overspend, type Line } from "@/features/budgets/services/month-lines";
import { monthKeyOf, monthLabel } from "@/features/budgets/services/plan-amounts";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useScrollTopOnFocus } from "@/lib/ui";

function PaceBar({ line, todayPct, color }: { line: Line; todayPct: number; color: string }) {
  const t = useTheme();
  const pct = line.planned > 0 ? Math.min(100, (line.spent / line.planned) * 100) : 100;
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: t.c.surfaceAlt, marginTop: 8 }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, backgroundColor: color }} />
      {todayPct > 0 && todayPct < 100 ? <View style={{ position: "absolute", top: -4, bottom: -4, left: `${todayPct}%`, width: 2, borderRadius: 2, backgroundColor: t.c.ink, opacity: 0.55 }} /> : null}
    </View>
  );
}

/** This month's categories that are over budget, and those spending fast enough to get there. */
export function OverspendingScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ month?: string }>();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf(new Date());
  const { data, loading, known, offline, error, refresh } = useMonthLines(month);
  const [cover, setCover] = useState<{ categoryId: string; name: string; need: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const o = data ? overspend(data.lines, data.today, data.daysInMonth) : null;
  const todayPct = data && data.daysInMonth ? Math.min(100, (data.today / data.daysInMonth) * 100) : 0;
  const lastDay = data ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  const open = (id: string) => router.push(`/(tabs)/budget/category?id=${encodeURIComponent(id)}&month=${month}` as never);

  const headline = !o ? "—" : o.totalOver > 0 ? `${whole(o.totalOver)} over` : o.fast.length ? "Nothing over yet" : "Everything's on track";
  const sub = !o
    ? " "
    : [o.over.length ? `in ${o.over.length} ${o.over.length === 1 ? "category" : "categories"}` : "", o.fast.length ? `${o.fast.length} ${o.fast.length === 1 ? "is" : "are"} running fast` : ""].filter(Boolean).join(" · ") || "No category is over or spending too fast";

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
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header">Overspending</Txt>
            </View>
            <View style={{ alignItems: "center", gap: 2 }}>
              <Txt variant="caption" color={t.c.onHeroMuted}>{data ? `${monthLabel(month, false)}${data.today > 0 && data.today < data.daysInMonth ? ` · day ${data.today} of ${data.daysInMonth}` : ""}` : " "}</Txt>
              <Txt variant="amountHero" color={o && o.totalOver > 0 ? "#F0997B" : t.c.onHero} style={{ fontSize: 28, lineHeight: 34 }}>{headline}</Txt>
              <Txt variant="caption" color={t.c.onHeroMuted}>{sub}</Txt>
            </View>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", paddingHorizontal: t.space.space4, gap: t.space.space2 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {!o ? (
            loading ? <DefaultLoading /> : null
          ) : o.over.length === 0 && o.fast.length === 0 ? (
            <View style={{ alignItems: "center", gap: t.space.space3, paddingVertical: t.space.space8 }}>
              <Icon name="circle-check" size={32} color={t.c.positive} />
              <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center" }}>Every category is within its plan and on pace.</Txt>
            </View>
          ) : (
            <>
              {o.over.length ? (
                <View style={{ gap: t.space.space2, marginTop: t.space.space4 }}>
                  <Txt variant="label" color={t.c.danger} accessibilityRole="header" style={{ paddingHorizontal: 4 }}>Over budget</Txt>
                  <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                    {o.over.map((l, i) => (
                      <Pressable
                        key={l.categoryId}
                        onPress={() => open(l.categoryId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${l.name}, ${whole(l.by)} over`}
                        style={{ padding: t.space.space4, borderBottomWidth: i === o.over.length - 1 ? 0 : 1, borderBottomColor: t.c.border }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Txt variant="titleSm">{l.name}</Txt>
                          <Txt variant="amountMd" color={t.c.danger}>{`${whole(l.by)} over`}</Txt>
                        </View>
                        <PaceBar line={l} todayPct={todayPct} color={t.c.danger} />
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: t.space.space3 }}>
                          <Txt variant="caption" color={t.c.inkMuted}>{`${compactNaira(Math.round(l.spent))} of ${compactNaira(Math.round(l.planned))}`}</Txt>
                          <Pressable
                            onPress={() => setCover({ categoryId: l.categoryId, name: l.name, need: l.by })}
                            accessibilityRole="button"
                            accessibilityLabel={`Cover ${l.name}`}
                            hitSlop={6}
                            style={{ paddingHorizontal: 14, height: 32, borderRadius: 999, backgroundColor: t.c.hero, justifyContent: "center" }}
                          >
                            <Txt variant="caption" color={t.c.onHero} style={{ fontWeight: "600" }}>Cover it</Txt>
                          </Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {o.fast.length ? (
                <View style={{ gap: t.space.space2, marginTop: t.space.space4 }}>
                  <Txt variant="label" color={t.c.warning} accessibilityRole="header" style={{ paddingHorizontal: 4 }}>Running fast</Txt>
                  <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                    {o.fast.map((l, i) => (
                      <Pressable
                        key={l.categoryId}
                        onPress={() => open(l.categoryId)}
                        accessibilityRole="button"
                        accessibilityLabel={`${l.name}, about ${whole(l.projectedOver)} over by month end at this pace`}
                        style={{ padding: t.space.space4, borderBottomWidth: i === o.fast.length - 1 ? 0 : 1, borderBottomColor: t.c.border }}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Txt variant="titleSm">{l.name}</Txt>
                          <Txt variant="bodySm" color={t.c.inkMuted}>{`${compactNaira(Math.round(l.spent))} of ${compactNaira(Math.round(l.planned))}`}</Txt>
                        </View>
                        <PaceBar line={l} todayPct={todayPct} color={t.c.warning} />
                        <Txt variant="caption" color={t.c.warning} style={{ marginTop: t.space.space2 }}>{`At this pace, ${compactNaira(l.projectedOver)} over by ${lastDay}`}</Txt>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <CoverSheet
        key={cover?.categoryId ?? "none"}
        open={cover !== null}
        view={data}
        target={cover}
        need={cover?.need ?? 0}
        onClose={() => setCover(null)}
        onDone={(message) => {
          setCover(null);
          setToast(message);
          refresh();
        }}
      />
      {toast ? (
        <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + 96 }}>
          <Toast message={toast} onClose={() => setToast(null)} />
        </View>
      ) : null}
    </View>
  );
}

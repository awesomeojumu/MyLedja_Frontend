import { useCallback, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Sheet, SpringPressable, Toast, Txt, cleanAmount, compactNaira, formatMoney, maxWidth, useTheme } from "@/design";
import { fillFrom, monthKeyOf, monthLabel, shiftMonth, spendByMonth, suggestion } from "@/features/budgets/services/plan-amounts";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, type ApiTransaction } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { useActiveWorkspace } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

interface Category {
  id: string;
  name: string;
  kind: string;
  groupId?: string | null;
}
interface Group {
  id: string;
  name: string;
  kind: string;
}
interface Loaded {
  month: string;
  /** Income minus bills, goals and debts set aside: what the spending plan can use. */
  room: number;
  lines: Record<string, number>;
  lastMonthPlan: Record<string, number> | null;
  categories: Category[];
  groups: Group[];
  txns: ApiTransaction[];
}

function whole(n: number): string {
  return `${n < 0 ? "−" : ""}${formatMoney(Math.abs(Math.round(n))).replace(/\.00$/, "")}`;
}

/** Create (or change) the spending plan for a month. Rows are just category and amount; tap a row to set it. */
export function CreateBudgetScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const params = useLocalSearchParams<{ month?: string }>();
  const thisMonth = monthKeyOf(new Date());
  const [month, setMonth] = useState(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : thisMonth);
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [typed, setTyped] = useState("");
  const [monthOpen, setMonthOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (ws: string): Promise<Loaded> => {
      const [view, cats, groups, txRes, history] = await Promise.all([
        session.getMonthBudget(ws, month),
        session.listCategories(ws),
        session.listCategoryGroups(ws).catch(() => ({ data: [] as Group[] })),
        session.listTransactions(ws),
        session.listMonthHistory(ws, 24).catch(() => ({ data: [] as Record<string, unknown>[] })),
      ]);
      const v = view.data as { safeToSpend?: string; spending?: { lines?: { categoryId: string; planned: string }[] } };
      const lines: Record<string, number> = {};
      for (const l of v.spending?.lines ?? []) lines[l.categoryId] = nairaAmount(l.planned);
      // "Copy last month" only when last month really had a plan: reading a month that has none would create one.
      const prev = shiftMonth(month, -1);
      let lastMonthPlan: Record<string, number> | null = null;
      if ((history.data ?? []).some((h) => h.month === prev)) {
        const pv = (await session.getMonthBudget(ws, prev)).data as { spending?: { lines?: { categoryId: string; planned: string }[] } };
        lastMonthPlan = {};
        for (const l of pv.spending?.lines ?? []) lastMonthPlan[l.categoryId] = nairaAmount(l.planned);
      }
      return {
        month,
        room: nairaAmount(v.safeToSpend),
        lines,
        lastMonthPlan,
        categories: ((cats.data ?? []) as Category[]).filter((c) => c.kind === "expense"),
        groups: ((groups.data ?? []) as Group[]).filter((g) => g.kind === "expense"),
        txns: txRes.data?.transactions ?? [],
      };
    },
    [session, month],
  );
  const { data, loading, known, offline, error, refresh } = useLiveQuery<Loaded | null>(load, null, workspaceId ? `create-budget-${month}` : undefined);
  const ready = data && data.month === month ? data : null;
  // The draft starts from what's saved for the month; switching month starts over.
  const plan = draft ?? ready?.lines ?? {};
  const planned = Object.values(plan).reduce((s, v) => s + v, 0);
  const room = ready?.room ?? 0;
  const left = room - planned;
  const spend = ready ? spendByMonth(ready.txns) : new Map<string, Map<string, number>>();

  const groupsInOrder = [...(ready?.groups ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const known2 = new Set(groupsInOrder.map((g) => g.id));
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);
  const sections = [
    ...groupsInOrder.map((g) => ({ key: g.id, title: g.name, items: (ready?.categories ?? []).filter((c) => c.groupId === g.id).sort(byName) })),
    { key: "loose", title: "Not grouped", items: (ready?.categories ?? []).filter((c) => !c.groupId || !known2.has(c.groupId)).sort(byName) },
  ].filter((s) => s.items.length > 0);

  const setAmount = (id: string, amount: number) => setDraft({ ...plan, [id]: amount });
  const openRow = (c: Category) => {
    setEditing(c);
    setTyped(plan[c.id] ? String(plan[c.id]) : "");
  };
  const pickMonth = (m: string) => {
    setMonth(m);
    setDraft(null);
    setMonthOpen(false);
  };

  const save = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const lines = Object.entries(plan)
        .filter(([, v]) => v > 0)
        .map(([categoryId, v]) => ({ categoryId, amount: v.toFixed(2) }));
      await session.setMonthLines(workspaceId, month, lines);
      setDraft(null);
      refresh();
      if (router.canGoBack()) router.back();
      else setToast(`${monthLabel(month, false)} budget saved`);
    } catch {
      setToast("Couldn't save the budget. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const ids = (ready?.categories ?? []).map((c) => c.id);
  const pct = room > 0 ? Math.min(100, (planned / room) * 100) : planned > 0 ? 100 : 0;
  const over = left < 0;
  const sug = editing ? suggestion(spend, editing.id, month) : null;
  const typedValue = Number(cleanAmount(typed) || 0);
  const maxBar = sug ? Math.max(1, ...sug.history.map((h) => h.spent)) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 * 2 }}>
        <View style={{ backgroundColor: t.c.hero, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space5 }}>
          <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", gap: t.space.space4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              <SpringPressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/budget" as never))}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="x" size={18} color={t.c.onHero} />
              </SpringPressable>
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header">Create budget</Txt>
            </View>
            <Pressable
              onPress={() => setMonthOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Planning for ${monthLabel(month)}. Change month`}
              style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 36, borderRadius: 999, backgroundColor: t.c.heroDeco }}
            >
              <Txt variant="label" color={t.c.onHero}>{`For ${monthLabel(month)}`}</Txt>
              <Icon name="chevron-down" size={16} color={t.c.onHeroMuted} />
            </Pressable>
            <View style={{ alignItems: "center", gap: 2 }}>
              <Txt variant="caption" color={t.c.onHeroMuted}>{over ? "Planned more than you have" : left === 0 && planned > 0 ? "Every naira planned" : "Left to plan"}</Txt>
              <Txt variant="amountHero" color={over ? "#F0997B" : t.c.onHero} style={{ fontSize: 32, lineHeight: 38 }}>
                {ready ? whole(over ? -left : left) : "—"}
              </Txt>
            </View>
            <View style={{ gap: 6 }}>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: t.c.heroDeco, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: over ? "#F0997B" : "#85B7EB" }} />
              </View>
              <Txt variant="caption" color={t.c.onHeroMuted} style={{ textAlign: "center" }}>
                {ready ? `${whole(planned)} planned of ${whole(room)} after bills, goals and debts` : " "}
              </Txt>
            </View>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", paddingHorizontal: t.space.space4, paddingTop: t.space.space4, gap: t.space.space2 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {!ready ? (
            loading ? <DefaultLoading /> : null
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: t.space.space2 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    fullWidth
                    variant="secondary"
                    icon="repeat"
                    disabled={!ready.lastMonthPlan}
                    disabledReason={ready.lastMonthPlan ? undefined : "No budget last month"}
                    onPress={() => ready.lastMonthPlan && setDraft({ ...ready.lastMonthPlan })}
                  >
                    Copy last month
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button fullWidth variant="secondary" icon="chart-pie" onPress={() => setDraft(fillFrom(ids, (id) => suggestion(spend, id, month).average))}>
                    3-month average
                  </Button>
                </View>
              </View>

              {sections.length === 0 ? (
                <View style={{ alignItems: "center", gap: t.space.space3, paddingVertical: t.space.space8 }}>
                  <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center" }}>Add spending categories first, then plan how much goes to each.</Txt>
                  <Button size="sm" onPress={() => router.push("/(tabs)/transactions/categories" as never)}>Open categories</Button>
                </View>
              ) : (
                sections.map((s) => {
                  const total = s.items.reduce((sum, c) => sum + (plan[c.id] ?? 0), 0);
                  return (
                    <View key={s.key} style={{ gap: t.space.space2, marginTop: t.space.space4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
                        <Txt variant="label" color={t.c.inkMuted} accessibilityRole="header">{s.title}</Txt>
                        <Txt variant="label" color={t.c.inkMuted}>{whole(total)}</Txt>
                      </View>
                      <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                        {s.items.map((c, i) => {
                          const v = plan[c.id] ?? 0;
                          return (
                            <Pressable
                              key={c.id}
                              onPress={() => openRow(c)}
                              accessibilityRole="button"
                              accessibilityLabel={v ? `${c.name}, ${whole(v)}. Change` : `${c.name}. Add amount`}
                              android_ripple={{ color: t.c.surfaceAlt }}
                              style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 56, paddingHorizontal: t.space.space4, borderBottomWidth: i === s.items.length - 1 ? 0 : 1, borderBottomColor: t.c.border }}
                            >
                              <Txt variant="body" color={v ? t.c.ink : t.c.inkMuted} style={{ flex: 1 }}>{c.name}</Txt>
                              {v ? <Txt variant="amountMd">{whole(v)}</Txt> : <Txt variant="label" color={t.c.primary}>Add amount</Txt>}
                              <Icon name="chevron-right" size={16} color={t.c.inkMuted} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: t.space.space4, paddingTop: t.space.space3, paddingBottom: insets.bottom + t.space.space3, backgroundColor: t.c.surface, borderTopWidth: 1, borderTopColor: t.c.border }}>
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
          <Button fullWidth size="lg" loading={saving} disabled={!ready} onPress={() => void save()}>Save budget</Button>
        </View>
      </View>

      <Sheet
        title={editing?.name ?? ""}
        open={editing !== null}
        onClose={() => setEditing(null)}
        footer={
          <Button
            fullWidth
            onPress={() => {
              if (editing) setAmount(editing.id, typedValue);
              setEditing(null);
            }}
          >
            {typedValue > 0 ? `Plan ${whole(typedValue)}` : "Plan nothing"}
          </Button>
        }
      >
        {sug ? (
          <View style={{ gap: t.space.space4 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: t.space.space3, height: 70 }} accessible accessibilityLabel={`Spent ${sug.history.map((h) => `${monthLabel(h.month, false)} ${whole(h.spent)}`).join(", ")}`}>
              {sug.history.map((h, i) => (
                <View key={h.month} style={{ alignItems: "center", gap: 4 }}>
                  <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 10 }}>{h.spent ? compactNaira(Math.round(h.spent)) : "—"}</Txt>
                  <View style={{ width: 28, height: Math.max(4, (h.spent / maxBar) * 40), borderRadius: 6, backgroundColor: i === 2 ? t.c.chart2 : t.c.surfaceAlt }} />
                  <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 10 }}>{monthLabel(h.month, false).slice(0, 3)}</Txt>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: t.space.space2 }}>
              {[
                { label: "Last month", value: sug.lastMonth },
                { label: "3-month average", value: sug.average },
              ].map((q) => {
                const on = typedValue === Math.round(q.value) && q.value > 0;
                return (
                  <Pressable
                    key={q.label}
                    onPress={() => setTyped(String(Math.round(q.value)))}
                    disabled={q.value <= 0}
                    accessibilityRole="button"
                    accessibilityLabel={`${q.label}, ${whole(q.value)}`}
                    style={{ flex: 1, padding: t.space.space3, borderRadius: t.radius.radiusMd, borderWidth: on ? 1.5 : 1, borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.primarySoft : "transparent", opacity: q.value > 0 ? 1 : 0.5, gap: 2 }}
                  >
                    <Txt variant="caption" color={t.c.inkMuted}>{q.label}</Txt>
                    <Txt variant="amountMd">{q.value > 0 ? whole(q.value) : "—"}</Txt>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 56, paddingHorizontal: t.space.space4, borderRadius: t.radius.radiusMd, borderWidth: 1.5, borderColor: t.c.primary }}>
              <Txt variant="amountLg" color={t.c.inkMuted}>₦</Txt>
              <TextInput
                value={typed}
                onChangeText={(v) => setTyped(cleanAmount(v))}
                placeholder="0"
                placeholderTextColor={t.c.inkMuted}
                keyboardType="decimal-pad"
                accessibilityLabel={`Amount for ${editing?.name ?? "category"}`}
                autoFocus
                style={[t.text("amountLg"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      <Sheet title="Plan which month?" open={monthOpen} onClose={() => setMonthOpen(false)}>
        <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
          {[-1, 0, 1, 2].map((n, i, all) => {
            const m = shiftMonth(thisMonth, n);
            const on = m === month;
            return (
              <Pressable
                key={m}
                onPress={() => pickMonth(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: t.space.space4, borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: t.c.border, backgroundColor: on ? t.c.primarySoft : "transparent" }}
              >
                <Txt variant="body" color={on ? t.c.onPrimarySoft : t.c.ink} style={{ flex: 1, fontWeight: on ? "600" : "400" }}>{monthLabel(m)}</Txt>
                <Txt variant="caption" color={t.c.inkMuted}>{n === 0 ? "This month" : n === -1 ? "Last month" : n === 1 ? "Next month" : ""}</Txt>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      {toast ? (
        <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + 96 }}>
          <Toast message={toast} onClose={() => setToast(null)} />
        </View>
      ) : null}
    </View>
  );
}

import { useCallback, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Sheet, SpringPressable, Toast, Txt, cleanAmount, maxWidth, useTheme } from "@/design";
import { CoverSheet, savePlan, useMonthLines, whole } from "@/features/budgets/components/CoverSheet";
import { pace } from "@/features/budgets/services/month-lines";
import { monthKeyOf, monthLabel } from "@/features/budgets/services/plan-amounts";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, type ApiTransaction } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { useActiveWorkspace } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NO_TXNS: { txns: ApiTransaction[]; accounts: Record<string, string> } = { txns: [], accounts: {} };

function when(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** One category in one month: planned, spent, left and pace, with its entries. Two actions only. */
export function BudgetCategoryScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();
  const params = useLocalSearchParams<{ id?: string; month?: string }>();
  const id = params.id ?? "";
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKeyOf(new Date());
  const lines = useMonthLines(month);
  const loadTx = useCallback(
    async (ws: string) => {
      const [tx, accounts] = await Promise.all([session.listTransactions(ws), session.listAccounts(ws).catch(() => ({ data: [] as { id?: string; name?: string }[] }))]);
      const names: Record<string, string> = {};
      for (const a of (Array.isArray(accounts.data) ? accounts.data : []) as { id?: string; name?: string }[]) if (a.id) names[String(a.id)] = a.name ?? "";
      return { txns: tx.data?.transactions ?? [], accounts: names };
    },
    [session],
  );
  const tx = useLiveQuery(loadTx, NO_TXNS, workspaceId ? "budget-category-txns" : undefined);
  const [amountOpen, setAmountOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [coverOpen, setCoverOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const view = lines.data;
  const line = view?.lines.find((l) => l.categoryId === id) ?? null;
  const p = line && view ? pace(line, view.today, view.daysInMonth) : null;
  const pct = line && line.planned > 0 ? Math.min(100, (line.spent / line.planned) * 100) : line && line.spent > 0 ? 100 : 0;
  const todayPct = view && view.daysInMonth ? Math.min(100, (view.today / view.daysInMonth) * 100) : 0;
  const barColor = !p ? t.c.onHeroMuted : p.over ? "#F0997B" : p.fast ? "#FAC775" : "#5DCAA5";

  const entries = tx.data.txns
    .filter((r) => r.categoryId === id && (!r.status || r.status === "posted") && (r.type === "expense" || r.type === "refund") && r.occurredAt && monthKeyOf(new Date(r.occurredAt)) === month)
    .sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""));
  const shown = showAll ? entries : entries.slice(0, 5);
  const name = line?.name ?? "Category";

  const saveAmount = async () => {
    if (!workspaceId || !view) return;
    setBusy(true);
    try {
      const value = Number(cleanAmount(typed) || 0);
      const plan = view.lines.map((l) => ({ categoryId: l.categoryId, planned: l.categoryId === id ? value : l.planned }));
      if (!plan.some((l) => l.categoryId === id)) plan.push({ categoryId: id, planned: value });
      await savePlan(session, workspaceId, month, plan);
      setAmountOpen(false);
      setToast(value > 0 ? `${name} planned at ${whole(value)}` : `${name} removed from ${monthLabel(month, false)}`);
      lines.refresh();
    } catch {
      setToast("Couldn't change the amount. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const daysText = p && view && view.today > 0 && p.daysLeft > 0
    ? p.over
      ? `${whole(-p.left)} over with ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"} to go`
      : `About ${whole(p.perDay)} a day for the next ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"}`
    : p && p.daysLeft === 0 && view && view.today > 0
      ? p.over ? `Finished ${whole(-p.left)} over` : `Finished ${whole(p.left)} under`
      : " ";

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 }}>
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
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>{name}</Txt>
              <View style={{ paddingHorizontal: 12, height: 28, borderRadius: 999, backgroundColor: t.c.heroDeco, justifyContent: "center" }}>
                <Txt variant="caption" color={t.c.onHeroMuted}>{monthLabel(month, false)}</Txt>
              </View>
            </View>
            {line && p ? (
              <>
                <View style={{ flexDirection: "row" }}>
                  {[
                    { label: "Planned", value: whole(line.planned), color: t.c.onHero },
                    { label: "Spent", value: whole(line.spent), color: t.c.onHero },
                    { label: p.left < 0 ? "Over" : "Left", value: whole(Math.abs(p.left)), color: barColor },
                  ].map((s) => (
                    <View key={s.label} style={{ flex: 1, alignItems: "center", gap: 2 }}>
                      <Txt variant="caption" color={t.c.onHeroMuted}>{s.label}</Txt>
                      <Txt variant="amountMd" color={s.color}>{s.value}</Txt>
                    </View>
                  ))}
                </View>
                <View style={{ height: 10, borderRadius: 999, backgroundColor: t.c.heroDeco }}>
                  <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, backgroundColor: barColor }} />
                  {todayPct > 0 && todayPct < 100 ? <View style={{ position: "absolute", top: -4, bottom: -4, left: `${todayPct}%`, width: 2, backgroundColor: t.c.onHero }} /> : null}
                </View>
                <Txt variant="caption" color={t.c.onHeroMuted} style={{ textAlign: "center" }}>{daysText}</Txt>
              </>
            ) : (
              <Txt variant="bodySm" color={t.c.onHeroMuted} style={{ textAlign: "center" }}>
                {lines.known ? `Nothing planned for ${name} in ${monthLabel(month, false)}.` : " "}
              </Txt>
            )}
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", padding: t.space.space4, gap: t.space.space4 }}>
          <LiveNotice offline={lines.offline} error={lines.error} hasData={lines.known} onRetry={lines.refresh} />
          {lines.loading && !lines.known ? (
            <DefaultLoading />
          ) : (
            <View style={{ flexDirection: "row", gap: t.space.space2 }}>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="secondary" onPress={() => { setTyped(line?.planned ? String(Math.round(line.planned)) : ""); setAmountOpen(true); }}>
                  {line ? "Change amount" : "Add amount"}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button fullWidth variant="secondary" onPress={() => setCoverOpen(true)}>Move money in</Button>
              </View>
            </View>
          )}

          <View style={{ gap: t.space.space2 }}>
            <Txt variant="label" color={t.c.inkMuted} accessibilityRole="header" style={{ paddingHorizontal: 4 }}>
              {`This month · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
            </Txt>
            {entries.length === 0 ? (
              <Txt variant="bodySm" color={t.c.inkMuted} style={{ paddingHorizontal: 4 }}>{tx.known ? "Nothing spent here yet this month." : " "}</Txt>
            ) : (
              <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                {shown.map((r, i) => {
                  const refund = r.type === "refund";
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push(`/(tabs)/transactions/${r.id}` as never)}
                      accessibilityRole="button"
                      android_ripple={{ color: t.c.surfaceAlt }}
                      style={{ flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: t.space.space4, borderBottomWidth: i === shown.length - 1 && (showAll || entries.length <= 5) ? 0 : 1, borderBottomColor: t.c.border }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt variant="body" numberOfLines={1}>{r.description || name}</Txt>
                        <Txt variant="caption" color={t.c.inkMuted}>{[when(new Date(r.occurredAt ?? "")), tx.data.accounts[String(r.accountId)]].filter(Boolean).join(" · ")}</Txt>
                      </View>
                      <Txt variant="amountMd" color={refund ? t.c.positive : t.c.ink}>{`${refund ? "+" : "−"}${whole(nairaAmount(r.amount))}`}</Txt>
                    </Pressable>
                  );
                })}
                {entries.length > 5 && !showAll ? (
                  <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
                    <Txt variant="label" color={t.c.primary}>{`See all ${entries.length}`}</Txt>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Sheet
        title={line ? `Change ${name}` : `Plan ${name}`}
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        footer={<Button fullWidth loading={busy} onPress={() => void saveAmount()}>Save</Button>}
      >
        <View style={{ gap: t.space.space3 }}>
          <Txt variant="bodySm" color={t.c.inkMuted}>{`How much for ${name} in ${monthLabel(month)}?`}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 54, paddingHorizontal: t.space.space4, borderRadius: t.radius.radiusMd, borderWidth: 1.5, borderColor: t.c.primary }}>
            <Txt variant="amountLg" color={t.c.inkMuted}>₦</Txt>
            <TextInput
              value={typed}
              onChangeText={(v) => setTyped(cleanAmount(v))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.c.inkMuted}
              autoFocus
              accessibilityLabel={`Amount for ${name}`}
              style={[t.text("amountLg"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
            />
          </View>
          {line && line.spent > 0 ? <Txt variant="caption" color={t.c.inkMuted}>{`${whole(line.spent)} already spent this month.`}</Txt> : null}
        </View>
      </Sheet>

      <CoverSheet
        key={coverOpen ? "open" : "closed"}
        open={coverOpen}
        view={view}
        target={{ categoryId: id, name }}
        need={p && p.left < 0 ? -p.left : 0}
        onClose={() => setCoverOpen(false)}
        onDone={(message) => {
          setCoverOpen(false);
          setToast(message);
          lines.refresh();
        }}
      />
      {toast ? (
        <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + t.space.space6 }}>
          <Toast message={toast} onClose={() => setToast(null)} />
        </View>
      ) : null}
    </View>
  );
}

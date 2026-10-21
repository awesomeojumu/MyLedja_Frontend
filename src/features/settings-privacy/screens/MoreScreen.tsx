import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Dialog, Icon, Rise, Sheet, Txt, formatMoney, maxWidth, useTheme } from "@/design";
import { useHealthSummary } from "@/features/financial-health";
import { useInbox } from "@/features/notifications";
import { Badge, HealthCard, ListCard, ListRow, MoneyTile, MoreHeader, SectionLabel, Toggle } from "@/features/settings-privacy/components/MoreParts";
import { alertCount, displayName, healthLabel, holdingsValue, savingsTotal, type HoldingRow } from "@/features/settings-privacy/services/more-model";
import type { ApiAccount } from "@/lib/money-map";
import { pendingBadge } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { useActiveWorkspace, useScrollTopOnFocus } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useScheme, useSession, useSignOut } from "@/state";

const EMPTY = { accounts: [] as ApiAccount[], holdings: [] as HoldingRow[] };

function short(n: number): string {
  return formatMoney(Math.round(n)).replace(/\.00$/, "");
}

export function MoreScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, workspaces } = useSession();
  const signOut = useSignOut();
  const { workspace, setActiveWorkspaceId } = useActiveWorkspace();
  const { scheme, setScheme } = useScheme();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [savingHide, setSavingHide] = useState(false);
  const health = useHealthSummary();
  const inbox = useInbox();
  const go = (href: string) => router.push(href as never);

  const load = useCallback(
    async (ws: string) => {
      const [accounts, holdings] = await Promise.all([
        session.listAccounts(ws).then((r) => (Array.isArray(r.data) ? (r.data as ApiAccount[]) : [])).catch(() => [] as ApiAccount[]),
        session.listHoldings(ws).then((r) => (Array.isArray(r.data) ? (r.data as HoldingRow[]) : [])).catch(() => [] as HoldingRow[]),
      ]);
      return { accounts, holdings };
    },
    [session],
  );
  const money = useLiveQuery(load, EMPTY, "more-money");
  const savings = savingsTotal(money.data?.accounts ?? []);
  const invest = holdingsValue(money.data?.holdings ?? []);
  const alerts = alertCount(inbox.data ?? []);
  const unsynced = user ? outboxForUser(user.userId).list(user.userId).filter((row) => pendingBadge(row.syncStatus)).length : 0;

  const score = health.model ? Math.round(health.model.score) : null;
  const tips = health.model?.advice.length ?? 0;
  const healthSub = !health.model
    ? health.known
      ? "Add accounts and a budget to get a score."
      : "Working out your score…"
    : tips > 0
      ? `${tips} ${tips === 1 ? "tip" : "tips"} to improve${health.model.runwayMonths != null ? ` · ${health.model.runwayMonths.toFixed(1)} months of runway` : ""}`
      : score != null && score >= 60
        ? "You're in good shape. Keep it up."
        : "See what's holding your score back.";

  const hideAmounts = user?.hideLockScreenAmounts !== false;
  const setHide = async (next: boolean) => {
    setSavingHide(true);
    try {
      await session.patchSettings(next);
    } finally {
      setSavingHide(false);
    }
  };

  const appearance = scheme === "dark" ? "dark" : scheme === "light" ? "light" : "system";
  const email = user?.email ?? "";
  const initials = displayName(email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const version = Constants.expoConfig?.version ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <MoreHeader
          topInset={insets.top}
          initials={initials || "?"}
          name={displayName(email)}
          email={email}
          workspace={workspace?.name ?? "Personal"}
          canSwitch={workspaces.length > 1}
          onSettings={() => go("/(tabs)/more/settings")}
          onWorkspace={() => (workspaces.length > 1 ? setSwitchOpen(true) : go("/(tabs)/more/settings"))}
        />
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
          <Rise delay={20}>
            <HealthCard score={score} label={score == null ? "" : healthLabel(score)} sub={healthSub} loading={!health.model} onPress={() => go("/(tabs)/more/health-score")} />
          </Rise>
          <View style={{ paddingHorizontal: t.space.space4, paddingTop: t.space.space5, gap: t.space.space5 }}>
            <View style={{ gap: t.space.space2 }}>
              <SectionLabel>Your money</SectionLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space3 }}>
                <MoneyTile
                  icon="piggy-bank"
                  tone={{ fg: t.c.catTeal, bg: t.c.catTealSoft }}
                  title="Savings"
                  value={money.known ? short(savings.total) : "—"}
                  sub={money.known && savings.count === 0 ? "No savings account yet" : undefined}
                  onPress={() => go("/(tabs)/more/savings")}
                />
                <MoneyTile
                  icon="trending-up"
                  tone={{ fg: t.c.catPurple, bg: t.c.catPurpleSoft }}
                  title="Investments"
                  value={money.known ? (invest.count ? short(invest.value) : "None yet") : "—"}
                  sub={invest.gainPct != null ? `${invest.gainPct >= 0 ? "+" : "−"}${Math.abs(invest.gainPct).toFixed(1)}%` : undefined}
                  subColor={invest.gainPct != null && invest.gainPct < 0 ? t.c.danger : t.c.positive}
                  onPress={() => go("/(tabs)/more/investments")}
                />
                <MoneyTile icon="receipt" tone={{ fg: t.c.catGold, bg: t.c.catGoldSoft }} title="Taxes" value="PAYE and business" onPress={() => go("/(tabs)/more/taxes")} />
                <MoneyTile
                  icon="chart-pie"
                  tone={{ fg: t.c.onPrimarySoft, bg: t.c.primarySoft }}
                  title="Reports"
                  value={new Date().toLocaleDateString("en-GB", { month: "long" })}
                  sub="so far"
                  onPress={() => go("/(tabs)/more/reports")}
                />
              </View>
            </View>

            <View style={{ gap: t.space.space2 }}>
              <SectionLabel>Quick settings</SectionLabel>
              <ListCard>
                <ListRow
                  icon="eye-off"
                  label="Hide amounts on lock screen"
                  right={<Toggle value={hideAmounts} disabled={savingHide} onChange={(v) => void setHide(v)} label="Hide amounts on lock screen" />}
                />
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 52, paddingHorizontal: t.space.space4 }}>
                  <Icon name={appearance === "dark" ? "moon" : "sun"} size={18} color={t.c.inkMuted} />
                  <Txt variant="body" style={{ flex: 1 }}>Appearance</Txt>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: "row", padding: 2, borderRadius: t.radius.radiusSm, backgroundColor: t.c.surfaceAlt }}>
                    {(["system", "light", "dark"] as const).map((m) => {
                      const on = appearance === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setScheme(m === "system" ? undefined : m)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          style={{ paddingHorizontal: 10, height: 28, borderRadius: 8, justifyContent: "center", backgroundColor: on ? t.c.surface : "transparent" }}
                        >
                          <Txt variant="caption" color={on ? t.c.ink : t.c.inkMuted} style={{ fontWeight: on ? "600" : "400" }}>
                            {m === "system" ? "System" : m === "light" ? "Light" : "Dark"}
                          </Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ListCard>
            </View>

            <ListCard>
              <ListRow icon="bell" label="Notifications" onPress={() => go("/(tabs)/more/notifications")} right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {alerts > 0 ? <Badge count={alerts} /> : null}
                  <Icon name="chevron-right" size={16} color={t.c.inkMuted} />
                </View>
              } />
              <ListRow icon="shield-check" label="Security and privacy" onPress={() => go("/(tabs)/more/security")} />
              <ListRow icon="settings" label="All settings" onPress={() => go("/(tabs)/more/settings")} />
              <ListRow icon="info" label="Help and support" last onPress={() => go("/(tabs)/more/help")} />
            </ListCard>

            <Pressable
              onPress={() => setSignOutOpen(true)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: t.space.space3 }}
            >
              <Icon name="arrow-right" size={16} color={t.c.danger} />
              <Txt variant="label" color={t.c.danger}>Sign out</Txt>
            </Pressable>
            <Txt variant="caption" color={t.c.inkMuted} style={{ textAlign: "center" }}>
              {`MyLedja${version ? ` ${version}` : ""} · Naira-first. Exact to the kobo.`}
            </Txt>
          </View>
        </View>
      </ScrollView>

      <Sheet title="Switch workspace" open={switchOpen} onClose={() => setSwitchOpen(false)}>
        <View style={{ gap: t.space.space2 }}>
          {workspaces.map((w) => {
            const on = w.id === workspace?.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => {
                  setActiveWorkspaceId(w.id);
                  setSwitchOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, padding: t.space.space3, borderRadius: t.radius.radiusMd, backgroundColor: on ? t.c.primarySoft : t.c.surfaceAlt }}
              >
                <Icon name="briefcase" size={18} color={on ? t.c.onPrimarySoft : t.c.inkMuted} />
                <View style={{ flex: 1 }}>
                  <Txt variant="titleSm" color={on ? t.c.onPrimarySoft : t.c.ink}>{w.name}</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>{`${w.kind === "business" ? "Business" : "Personal"} · ${w.role}`}</Txt>
                </View>
                {on ? <Icon name="check" size={18} color={t.c.onPrimarySoft} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Dialog title="Sign out?" open={signOutOpen} onClose={() => setSignOutOpen(false)} confirmLabel="Sign out" onConfirm={() => void signOut()}>
        <Txt>
          {unsynced > 0
            ? `${unsynced} ${unsynced === 1 ? "entry hasn't" : "entries haven't"} synced yet. To be safe, sign out once you're back online and they've synced.`
            : "You'll need your email and password to sign back in."}
        </Txt>
      </Dialog>
    </View>
  );
}

import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, SpringPressable, Txt, formatMoney, maxWidth, useRollingNumber, useTheme, type IconName } from "@/design";
import type { BudgetSummary, RecentGroup } from "@/features/dashboard/services/home-model";
import { LedgerDay, LedgerRow, ProfileButton } from "@/lib/ui";

const HIDDEN = "₦ ••••••";

function HeroIconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={18} color={t.c.onHero} />
    </SpringPressable>
  );
}

function FlowChip({ label, value, kind, hidden, onPress }: { label: string; value: number | null; kind: "in" | "out"; hidden: boolean; onPress: () => void }) {
  const t = useTheme();
  const tone = kind === "in" ? { fg: t.c.positive, bg: t.c.positiveSoft } : { fg: t.c.catOrange, bg: t.c.catOrangeSoft };
  const amount = value == null ? "—" : hidden ? HIDDEN : formatMoney(value);
  return (
    <View style={{ flex: 1 }}>
      <SpringPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${hidden ? "amount hidden" : amount}`}
        accessibilityHint="Opens cash flow"
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.heroDeco }}
      >
        <View style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
          <Icon name={kind === "in" ? "arrow-down-left" : "arrow-up-right"} size={16} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={t.c.onHeroMuted}>{label}</Txt>
          <Txt variant="amountMd" color={t.c.onHero} numberOfLines={1}>{amount}</Txt>
        </View>
      </SpringPressable>
    </View>
  );
}

export interface HomeHeroProps {
  topInset: number;
  greeting: string;
  /** The signed-in person's name, shown under the greeting. */
  name: string;
  balance: number | null;
  freshness: string | null;
  moneyIn: number | null;
  moneyOut: number | null;
  hidden: boolean;
  onToggleHidden: () => void;
  onSearch: () => void;
  onUpcoming: () => void;
  onCashFlow: () => void;
  /** Desktop and large tablets: balance on the left, actions and money in/out on the right, no floating card. */
  wide?: boolean;
  actions?: QuickAction[];
}

function HeroPill({ action }: { action: QuickAction }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <SpringPressable
        onPress={action.onPress}
        hapticOn="start"
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, paddingHorizontal: 8, borderRadius: 999, backgroundColor: t.c.heroDeco }}
      >
        <Icon name={action.icon} size={16} color={t.c.onHero} />
        <Txt variant="label" color={t.c.onHero} numberOfLines={1}>{action.label}</Txt>
      </SpringPressable>
    </View>
  );
}

/** The navy top of Home: who and where, the balance you can spend, and this month's money in and out. */
export function HomeHero(p: HomeHeroProps) {
  const t = useTheme();
  const negative = (p.balance ?? 0) < 0;
  const rolled = useRollingNumber(Math.abs(p.balance ?? 0), t.reduceMotion);
  const [whole, kobo] = formatMoney(rolled, "NGN", { sign: negative ? "minus" : null }).split(".");
  const balanceText = (
    <Text
      accessibilityLabel={p.balance == null ? "Balance loading" : p.hidden ? "Balance hidden" : `Available balance ${formatMoney(p.balance, "NGN", { sign: negative ? "minus" : null })}`}
      style={[t.text("amountHero"), { color: t.c.onHero, fontSize: p.wide ? 48 : 40, lineHeight: p.wide ? 56 : 48, marginTop: t.space.space3 }]}
    >
      {p.balance == null ? "—" : p.hidden ? HIDDEN : whole}
      {p.balance != null && !p.hidden && kobo ? <Text style={{ fontSize: p.wide ? 26 : 22, color: t.c.onHeroMuted }}>.{kobo}</Text> : null}
    </Text>
  );
  const balancePill = (
    <Pressable
      onPress={p.onToggleHidden}
      accessibilityRole="button"
      accessibilityLabel={p.hidden ? "Show balances" : "Hide balances"}
      hitSlop={8}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 28, borderRadius: 999, backgroundColor: t.c.heroDeco }}
    >
      <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontWeight: "500" }}>Available balance</Txt>
      <Icon name={p.hidden ? "eye" : "eye-off"} size={14} color={t.c.onHeroMuted} />
    </Pressable>
  );
  const freshnessText = p.freshness ? (
    <Txt variant="caption" color={t.c.onHeroMuted} style={{ marginTop: 4 }}>{p.freshness}</Txt>
  ) : null;
  const chips = (
    <View style={{ flexDirection: "row", gap: t.space.space2 }}>
      <FlowChip label="In this month" value={p.moneyIn} kind="in" hidden={p.hidden} onPress={p.onCashFlow} />
      <FlowChip label="Out this month" value={p.moneyOut} kind="out" hidden={p.hidden} onPress={p.onCashFlow} />
    </View>
  );
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: p.topInset + t.space.space4, paddingHorizontal: t.space.space5, paddingBottom: p.wide ? t.space.space8 : 64 }}>
      <View style={{ width: "100%", maxWidth: p.wide ? maxWidth.widthContent : undefined, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
          <ProfileButton size={40} />
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={t.c.onHeroMuted}>{p.greeting}</Txt>
            <Txt variant="titleSm" color={t.c.onHero} accessibilityRole="header" numberOfLines={1}>{p.name}</Txt>
          </View>
          <HeroIconButton icon="search" label="Search" onPress={p.onSearch} />
          <HeroIconButton icon="calendar" label="Upcoming" onPress={p.onUpcoming} />
        </View>

        {p.wide ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: t.space.space8, marginTop: t.space.space8 }}>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              {balancePill}
              {balanceText}
              {freshnessText}
            </View>
            <View style={{ width: 480, maxWidth: "55%", gap: t.space.space3 }}>
              {p.actions ? (
                <View style={{ flexDirection: "row", gap: t.space.space2 }}>
                  {p.actions.map((a) => <HeroPill key={a.label} action={a} />)}
                </View>
              ) : null}
              {chips}
            </View>
          </View>
        ) : (
          <>
            <View style={{ alignItems: "center", marginTop: t.space.space8 }}>
              {balancePill}
              {balanceText}
              {freshnessText}
            </View>
            <View style={{ marginTop: t.space.space6 }}>{chips}</View>
          </>
        )}
      </View>
    </View>
  );
}

export interface QuickAction {
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** The floating card of shortcuts that overlaps the bottom of the hero. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const t = useTheme();
  return (
    <View
      style={{
        marginTop: -40,
        marginHorizontal: t.space.space4,
        flexDirection: "row",
        paddingVertical: t.space.space4,
        paddingHorizontal: t.space.space2,
        borderRadius: t.radius.radiusLg,
        backgroundColor: t.c.surface,
        borderWidth: 1,
        borderColor: t.c.border,
        shadowColor: "#0d111c",
        shadowOpacity: t.scheme === "dark" ? 0 : 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      {actions.map((a) => (
        <View key={a.label} style={{ flex: 1 }}>
          <SpringPressable
            onPress={a.onPress}
            hapticOn="start"
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={{ alignItems: "center", gap: 6 }}
          >
            <View style={{ width: 48, height: 48, borderRadius: t.radius.radiusMd, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name={a.icon} size={22} color={t.c.onPrimarySoft} />
            </View>
            <Txt variant="caption" style={{ fontWeight: "500" }}>{a.label}</Txt>
          </SpringPressable>
        </View>
      ))}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
      {children}
    </View>
  );
}

/** One budget card: what's left, a bar split by the biggest spending lines, and a legend. */
export function BudgetCard({ summary, hidden, onPress }: { summary: BudgetSummary; hidden: boolean; onPress: () => void }) {
  const t = useTheme();
  const over = summary.remaining < 0;
  const segments = [t.c.chart1, t.c.chart2, t.c.chart3];
  const usedPct = summary.planned > 0 ? Math.min(100, (summary.spent / summary.planned) * 100) : 0;
  const splitTotal = summary.split.reduce((sum, s) => sum + s.spent, 0);
  const meta = summary.daysLeft == null ? null : summary.daysLeft === 1 ? "1 day left" : `${summary.daysLeft} days left`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint="Opens budgets" android_ripple={{ color: t.c.surfaceAlt }}>
      <Card>
        <View style={{ padding: t.space.space4, gap: t.space.space3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption" color={t.c.inkMuted}>{meta ? `Budget · ${meta}` : "Budget"}</Txt>
              <Txt variant="amountLg" color={over ? t.c.danger : t.c.ink}>
                {hidden ? HIDDEN : over ? `Over by ${formatMoney(-summary.remaining)}` : `${formatMoney(summary.remaining)} left`}
              </Txt>
              {hidden ? null : (
                <Txt variant="bodySm" color={t.c.inkMuted}>of {formatMoney(summary.planned)}</Txt>
              )}
            </View>
            <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Budget used"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(usedPct) }}
            style={{ flexDirection: "row", height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: t.c.surfaceAlt, gap: 2 }}
          >
            {over ? (
              <View style={{ width: "100%", backgroundColor: t.c.danger }} />
            ) : splitTotal > 0 ? (
              summary.split.map((s, i) => (
                <View key={s.name} style={{ width: `${(usedPct * s.spent) / splitTotal}%`, backgroundColor: segments[i] }} />
              ))
            ) : (
              <View style={{ width: `${usedPct}%`, backgroundColor: t.c.primary }} />
            )}
          </View>
          {summary.split.length > 0 && !hidden ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: t.space.space4, rowGap: 4 }}>
              {summary.split.map((s, i) => (
                <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: segments[i] }} />
                  <Txt variant="caption" color={t.c.inkMuted}>{`${s.name} ${formatMoney(s.spent)}`}</Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

/** Recent activity in one card per day, each headed by the day and its net. */
export function RecentGroups({ groups, hidden, onOpen }: { groups: RecentGroup[]; hidden: boolean; onOpen: (id: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.space4 }}>
      {groups.map((g) => (
        <LedgerDay key={g.label} label={g.label} net={g.net} hidden={hidden}>
          {g.items.map((item, i) => (
            <LedgerRow
              key={item.id}
              item={item}
              hidden={hidden}
              last={i === g.items.length - 1}
              onPress={item.pending ? undefined : () => onOpen(item.id)}
            />
          ))}
        </LedgerDay>
      ))}
    </View>
  );
}

/** A titled dashboard card for wide screens. */
export function DashCard({ title, meta, action, children }: { title: string; meta?: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ padding: t.space.space5, gap: t.space.space4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: t.space.space3 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="titleSm" accessibilityRole="header">{title}</Txt>
            {meta ? <Txt variant="bodySm" color={t.c.inkMuted}>{meta}</Txt> : null}
          </View>
          {action ? (
            <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={8}>
              <Txt variant="label" color={t.c.primary}>{action.label}</Txt>
            </Pressable>
          ) : null}
        </View>
        {children}
      </View>
    </Card>
  );
}

/** "₦6,000.00 spent · 22% less than the week before". */
export function weekLine(total: number, previous: number): string {
  const spent = `${formatMoney(total)} spent`;
  if (previous <= 0) return total > 0 ? `${spent} · nothing the week before` : "Nothing spent in the last 7 days";
  const change = Math.round(((total - previous) / previous) * 100);
  if (change === 0) return `${spent} · same as the week before`;
  return `${spent} · ${Math.abs(change)}% ${change < 0 ? "less" : "more"} than the week before`;
}

export function EmptyChart({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ height: 160, alignItems: "center", justifyContent: "center", borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
      <Txt variant="bodySm" color={t.c.inkMuted}>{text}</Txt>
    </View>
  );
}

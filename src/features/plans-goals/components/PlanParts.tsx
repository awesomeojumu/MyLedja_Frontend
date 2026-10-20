import { useState, type ReactNode } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { Button, Icon, ProgressRing, Sheet, SpringPressable, Txt, formatMoney, maxWidth, useTheme, type IconName } from "@/design";
import type { MonthBill, Outlook, Payday, PlanOverview, Projection } from "@/features/plans-goals/services/plan-overview";

function whole(n: number): string {
  return `${n < 0 ? "−" : ""}${formatMoney(Math.abs(Math.round(n))).replace(/\.00$/, "")}`;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const OUTLOOK: Record<Outlook, { label: string; icon: IconName; color: string }> = {
  short: { label: "Short", icon: "circle-alert", color: "#F0997B" },
  tight: { label: "Tight", icon: "triangle-alert", color: "#FAC775" },
  comfortable: { label: "Comfortable", icon: "circle-check", color: "#5DCAA5" },
};

/** The projected balance from today to month end, with payday marked and the low point before it. */
function BalanceLine({ projection, payday }: { projection: Projection; payday: Payday | null }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const height = 64;
  const pts = projection.points;
  const values = pts.map((p) => p.balance);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const top = 8;
  const base = height - 12;
  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * (width - 8) + 4 : width / 2);
  const y = (v: number) => top + (base - top) * (1 - (v - min) / (max - min || 1));
  const payIndex = payday && payday.daysAway < pts.length ? payday.daysAway : -1;
  const lowIndex = (() => {
    const end = payIndex > 0 ? payIndex : pts.length;
    let best = 0;
    for (let i = 1; i < end; i++) if (pts[i].balance < pts[best].balance) best = i;
    return best;
  })();
  // Steps, not slopes: money moves on a day, it doesn't drift.
  const line = pts.map((p, i) => (i === 0 ? `${x(0)},${y(p.balance)}` : `${x(i)},${y(pts[i - 1].balance)} ${x(i)},${y(p.balance)}`)).join(" ");
  const label = `Projected balance from ${whole(projection.start)} today, lowest ${whole(projection.low)}${payday ? " before payday" : ""}, ${whole(pts[pts.length - 1]?.balance ?? 0)} at month end`;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={label} style={{ height, marginTop: t.space.space3 }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {min < 0 ? <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={t.c.heroDeco} strokeWidth={1} strokeDasharray="2 3" /> : null}
          <Line x1={0} x2={width} y1={base} y2={base} stroke={t.c.heroDeco} strokeWidth={1} />
          {payIndex > 0 ? <Line x1={x(payIndex)} x2={x(payIndex)} y1={0} y2={base} stroke={t.c.onHeroMuted} strokeOpacity={0.5} strokeDasharray="3 3" /> : null}
          <Polyline points={line} fill="none" stroke={t.c.onHeroMuted} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(0)} cy={y(pts[0]?.balance ?? 0)} r={4} fill={t.c.onHero} />
          {pts.length > 1 ? <Circle cx={x(lowIndex)} cy={y(pts[lowIndex].balance)} r={4} fill={OUTLOOK[projection.outlook].color} /> : null}
          <SvgText x={0} y={height - 1} fontSize={9} fill={t.c.onHeroMuted} fontFamily={t.text("caption").fontFamily}>Today</SvgText>
          {payIndex > 0 && payIndex < pts.length - 4 ? (
            <SvgText x={x(payIndex) + 3} y={height - 1} fontSize={9} fill={t.c.onHeroMuted} fontFamily={t.text("caption").fontFamily}>Payday</SvgText>
          ) : null}
          <SvgText x={width} y={height - 1} fontSize={9} fill={t.c.onHeroMuted} textAnchor="end" fontFamily={t.text("caption").fontFamily}>
            {shortDate(pts[pts.length - 1]?.date ?? new Date())}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

export function PlanHeader({
  topInset,
  overview,
  onAdd,
  onSetPayday,
  onAddIncome,
}: {
  topInset: number;
  overview: PlanOverview | null;
  onAdd: () => void;
  onSetPayday: () => void;
  onAddIncome: () => void;
}) {
  const t = useTheme();
  const p = overview?.payday ?? null;
  const proj = overview?.projection;
  const look = proj ? OUTLOOK[proj.outlook] : null;
  const left = !overview ? (
    <Txt variant="caption" color={t.c.onHeroMuted}>Loading your plan…</Txt>
  ) : p ? (
    <View>
      <Txt variant="caption" color={t.c.onHeroMuted}>{p.daysAway === 0 ? "Payday is" : "Payday in"}</Txt>
      <Txt variant="amountHero" color={t.c.onHero} style={{ fontSize: 30, lineHeight: 36 }}>
        {p.daysAway === 0 ? "Today" : p.daysAway === 1 ? "1 day" : `${p.daysAway} days`}
      </Txt>
      <Txt variant="caption" color={t.c.onHeroMuted}>{`${p.name} · ${p.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}</Txt>
    </View>
  ) : (
    <View style={{ gap: 6, alignItems: "flex-start" }}>
      <Txt variant="titleSm" color={t.c.onHero}>{overview.hasIncome ? "When do you get paid?" : "Add your income"}</Txt>
      <Txt variant="caption" color={t.c.onHeroMuted}>{overview.hasIncome ? "Set your payday to see how long your money lasts." : "Tell MyLedja what comes in to plan the month."}</Txt>
      <Pressable
        onPress={overview.needsPayday ? onSetPayday : onAddIncome}
        accessibilityRole="button"
        style={{ marginTop: 2, paddingHorizontal: 14, height: 32, borderRadius: 999, backgroundColor: t.c.onHero, justifyContent: "center" }}
      >
        <Txt variant="label" color={t.c.hero}>{overview.needsPayday ? "Set payday" : "Add income"}</Txt>
      </Pressable>
    </View>
  );
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space4, paddingHorizontal: t.space.space5, paddingBottom: 46 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Plan</Txt>
          <SpringPressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add to your plan"
            style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="plus" size={18} color={t.c.onHero} />
          </SpringPressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: t.space.space3, marginTop: t.space.space4 }}>
          <View style={{ flex: 1 }}>{left}</View>
          {proj && look ? (
            <View style={{ alignItems: "flex-end" }}>
              <Txt variant="caption" color={t.c.onHeroMuted}>{p ? "You'll have" : "By month end"}</Txt>
              <Txt variant="amountLg" color={t.c.onHero}>{whole(p ? proj.beforePayday : proj.points[proj.points.length - 1].balance)}</Txt>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name={look.icon} size={12} color={look.color} />
                <Txt variant="caption" color={look.color}>{look.label}</Txt>
              </View>
            </View>
          ) : null}
        </View>
        {proj && proj.points.length > 1 ? <BalanceLine projection={proj} payday={p} /> : null}
      </View>
    </View>
  );
}

function dateTile(d: Date, tone: { fg: string; bg: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
      <Txt variant="caption" color={tone.fg} style={{ fontSize: 9, lineHeight: 10 }}>{d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</Txt>
      <Txt variant="label" color={tone.fg} style={{ fontWeight: "600" }}>{String(d.getDate())}</Txt>
    </View>
  );
}

/** Floats over the header: only what's due before payday, each a tap from paid. */
export function BeforePaydayCard({ bills, hasPayday, onPay, onAll }: { bills: MonthBill[]; hasPayday: boolean; onPay: (id: string) => void; onAll: () => void }) {
  const t = useTheme();
  const shown = bills.slice(0, 3);
  return (
    <View
      style={{
        marginTop: -30,
        marginHorizontal: t.space.space4,
        padding: t.space.space4,
        gap: t.space.space3,
        borderRadius: t.radius.radiusLg,
        backgroundColor: t.c.surface,
        borderWidth: 1,
        borderColor: t.c.border,
        shadowColor: "#0d111c",
        shadowOpacity: t.scheme === "dark" ? 0 : 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <Txt variant="caption" color={t.c.inkMuted} accessibilityRole="header">{hasPayday ? "Before payday" : "Due this month"}</Txt>
      {shown.length === 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="circle-check" size={18} color={t.c.positive} />
          <Txt variant="bodySm">{hasPayday ? "Nothing due before payday" : "No bills left this month"}</Txt>
        </View>
      ) : (
        shown.map((b) => {
          const tone = b.overdue || b.daysAway <= 3 ? { fg: t.c.danger, bg: t.c.dangerSoft } : { fg: t.c.onPrimarySoft, bg: t.c.primarySoft };
          const when = b.overdue ? `Overdue by ${-b.daysAway} ${b.daysAway === -1 ? "day" : "days"}` : b.daysAway === 0 ? "Due today" : b.daysAway === 1 ? "Due tomorrow" : `Due in ${b.daysAway} days`;
          return (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              {dateTile(b.due, tone)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>{`${b.name} · ${whole(b.amount)}`}</Txt>
                <Txt variant="caption" color={b.overdue || b.daysAway <= 3 ? t.c.danger : t.c.inkMuted}>{when}</Txt>
              </View>
              <Pressable
                onPress={() => onPay(b.id)}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${b.name} paid`}
                style={{ paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: t.c.hero, justifyContent: "center" }}
              >
                <Txt variant="caption" color={t.c.onHero} style={{ fontWeight: "500" }}>Mark paid</Txt>
              </Pressable>
            </View>
          );
        })
      )}
      {bills.length > shown.length ? (
        <Pressable onPress={onAll} accessibilityRole="button" hitSlop={6}>
          <Txt variant="caption" color={t.c.primary} style={{ fontWeight: "600" }}>{`+${bills.length - shown.length} more`}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One summary tile. Tapping it opens that section's full screen. */
export function PlanTile({ title, onPress, children, wide }: { title: string; onPress: () => void; children: ReactNode; wide?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`Opens ${title.toLowerCase()}`}
      style={{ flexGrow: 1, flexBasis: wide ? "100%" : "40%", minWidth: wide ? undefined : 140 }}
    >
      <View style={{ flex: 1, padding: t.space.space3, gap: t.space.space2, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Txt variant="caption" color={t.c.inkMuted} style={{ flex: 1 }}>{title}</Txt>
          <Icon name="chevron-right" size={14} color={t.c.inkMuted} />
        </View>
        {children}
      </View>
    </Pressable>
  );
}

export function TilePrompt({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
      <Icon name="plus" size={14} color={t.c.primary} />
      <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "500" }}>{text}</Txt>
    </View>
  );
}

export function BudgetTileBody({ budget }: { budget: NonNullable<PlanOverview["budget"]> }) {
  const t = useTheme();
  const over = budget.remaining < 0;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
        <ProgressRing value={Math.max(0, budget.spent)} max={budget.planned || 1} size={40} stroke={5} tone={over ? "danger" : "primary"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="amountMd" color={over ? t.c.danger : t.c.ink}>{over ? `${whole(-budget.remaining)} over` : whole(budget.remaining)}</Txt>
          <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>{`left of ${whole(budget.planned)}`}</Txt>
        </View>
      </View>
      <Txt variant="caption" color={over ? t.c.danger : t.c.positive}>
        {[over ? "Over budget" : "On track", budget.daysLeft != null ? `${budget.daysLeft} days left` : ""].filter(Boolean).join(" · ")}
      </Txt>
    </>
  );
}

export function BillsTileBody({ overview }: { overview: PlanOverview }) {
  const t = useTheme();
  return (
    <>
      <Txt variant="amountMd">{whole(overview.billsLeftAmount)}</Txt>
      <Txt variant="caption" color={t.c.inkMuted}>{overview.billsLeft === 0 ? "All paid this month" : `${overview.billsLeft} left this month`}</Txt>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {overview.bills.slice(0, 8).map((b) => (
          <View key={b.id} style={{ flex: 1, height: 5, borderRadius: 999, backgroundColor: b.paid ? t.c.primary : b.overdue ? t.c.danger : t.c.surfaceAlt }} />
        ))}
      </View>
      <Txt variant="caption" color={t.c.inkMuted}>{`${overview.billsPaid} of ${overview.bills.length} paid`}</Txt>
    </>
  );
}

export function GoalsTileBody({ goals }: { goals: PlanOverview["goals"] }) {
  const t = useTheme();
  const g = goals[0];
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
        <ProgressRing value={g.saved} max={g.target || 1} size={40} stroke={5} tone="positive" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>{g.name}</Txt>
          <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>{`${whole(g.saved)} of ${whole(g.target)}`}</Txt>
        </View>
      </View>
      <Txt variant="caption" color={t.c.inkMuted}>{goals.length > 1 ? `+${goals.length - 1} more ${goals.length === 2 ? "goal" : "goals"}` : `${g.share}% saved`}</Txt>
    </>
  );
}

export function DebtsTileBody({ debts }: { debts: PlanOverview["debts"] }) {
  const t = useTheme();
  return (
    <>
      <View>
        <Txt variant="caption" color={t.c.inkMuted}>You owe</Txt>
        <Txt variant="amountMd">{whole(debts.owe)}</Txt>
      </View>
      <View>
        <Txt variant="caption" color={t.c.inkMuted}>Owed to you</Txt>
        <Txt variant="amountMd" color={debts.owed > 0 ? t.c.positive : t.c.ink}>{whole(debts.owed)}</Txt>
      </View>
    </>
  );
}

export function IncomeTileBody({ income }: { income: PlanOverview["income"] }) {
  const t = useTheme();
  const pct = income.expected > 0 ? Math.min(100, (income.received / income.expected) * 100) : 0;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <Txt variant="amountMd">{whole(income.received)}</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>{income.expected > 0 ? `received of ${whole(income.expected)} expected` : "received this month"}</Txt>
      </View>
      {income.expected > 0 ? (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ height: 6, borderRadius: 999, backgroundColor: t.c.surfaceAlt, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: t.c.positive }} />
        </View>
      ) : null}
    </>
  );
}

/** Ask which day of the month pay arrives. */
export function PaydaySheet({ open, name, onClose, onSave, busy }: { open: boolean; name: string; onClose: () => void; onSave: (day: number) => void; busy: boolean }) {
  const t = useTheme();
  const [day, setDay] = useState<number | null>(null);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <Sheet
      title="When do you get paid?"
      open={open}
      onClose={onClose}
      footer={<Button fullWidth loading={busy} disabled={day == null} onPress={() => day != null && onSave(day)}>{day ? `Payday is the ${ordinal(day)}` : "Pick a day"}</Button>}
    >
      <View style={{ gap: t.space.space3 }}>
        <Txt variant="bodySm" color={t.c.inkMuted}>{`The day of the month ${name} usually lands. If it falls on a short month, it moves to the last day.`}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {days.map((d) => {
            const on = d === day;
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Day ${d}`}
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.c.hero : t.c.surfaceAlt }}
              >
                <Txt variant="label" color={on ? t.c.onHero : t.c.ink}>{String(d)}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}

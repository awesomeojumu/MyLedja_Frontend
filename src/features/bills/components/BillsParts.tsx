import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { CategoryIcon, Icon, SpringPressable, Txt, compactNaira, formatMoney, maxWidth, useTheme, type IconName } from "@/design";
import { whenText, type BillOccurrence } from "@/features/bills/services/bill-month";

export function whole(n: number): string {
  return formatMoney(Math.round(n)).replace(/\.00$/, "");
}

export function HeroButton({ icon, label, onPress, size = 32 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={size > 28 ? 17 : 15} color={t.c.onHero} />
    </SpringPressable>
  );
}

export function MonthSwitch({ label, onPrev, onNext, onToday, isCurrent }: { label: string; onPrev: () => void; onNext: () => void; onToday: () => void; isCurrent: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: t.space.space3 }}>
      <HeroButton icon="chevron-left" label="Previous month" onPress={onPrev} size={28} />
      <Pressable
        onPress={onToday}
        disabled={isCurrent}
        accessibilityRole="button"
        accessibilityLabel={isCurrent ? label : `${label}. Go to this month`}
        style={{ paddingHorizontal: 14, height: 28, borderRadius: 999, backgroundColor: t.c.heroDeco, justifyContent: "center" }}
      >
        <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontWeight: "500" }}>{label}</Txt>
      </Pressable>
      <HeroButton icon="chevron-right" label="Next month" onPress={onNext} size={28} />
    </View>
  );
}

/** "Left to pay in October", paid vs total and a thin bar. */
export function LeftToPay({ month, left, paid, total, align = "left" }: { month: string; left: number; paid: number; total: number; align?: "left" | "split" }) {
  const t = useTheme();
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: t.space.space3 }}>
        <View>
          <Txt variant="caption" color={t.c.onHeroMuted}>{`Left to pay in ${month}`}</Txt>
          <Txt variant="amountHero" color={t.c.onHero} style={{ fontSize: align === "split" ? 24 : 28, lineHeight: align === "split" ? 30 : 34 }}>{whole(left)}</Txt>
        </View>
        <Txt variant="caption" color={t.c.onHeroMuted}>{total > 0 ? `${compactNaira(Math.round(paid))} of ${compactNaira(Math.round(total))} paid` : "No bills this month"}</Txt>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={{ height: 6, borderRadius: 999, backgroundColor: t.c.heroDeco, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: "#5DCAA5" }} />
      </View>
    </View>
  );
}

/** The next seven days, a dot on days with a bill. Tapping a day jumps to it. */
export function WeekStrip({ days, onPick }: { days: { date: Date; bills: BillOccurrence[] }[]; onPick: (date: Date) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {days.map(({ date, bills }) => {
        const has = bills.length > 0;
        const label = `${date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${has ? `, ${bills.length} ${bills.length === 1 ? "bill" : "bills"}` : ""}`;
        return (
          <Pressable
            key={date.toDateString()}
            onPress={() => onPick(date)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{ flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 10, backgroundColor: has ? t.c.heroDeco : "transparent", gap: 2 }}
          >
            <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 11 }}>{date.toLocaleDateString("en-GB", { weekday: "short" })}</Txt>
            <Txt variant="label" color={t.c.onHero}>{String(date.getDate())}</Txt>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: has ? "#FAC775" : "transparent" }} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, danger }: { children: ReactNode; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: danger ? t.c.danger : t.c.border, overflow: "hidden" }}>
      {children}
    </View>
  );
}

/** One bill: service icon, name, a due chip, amount, and Mark paid when it's unpaid. */
export function BillRow({ o, last, selected, onPress, onPay }: { o: BillOccurrence; last?: boolean; selected?: boolean; onPress?: () => void; onPay?: () => void }) {
  const t = useTheme();
  const soon = o.status === "due" && o.daysAway <= 3;
  const chip =
    o.status === "overdue"
      ? { fg: t.c.danger, bg: "transparent" }
      : soon
        ? { fg: t.c.warning, bg: t.c.warningSoft }
        : { fg: t.c.inkMuted, bg: t.c.surfaceAlt };
  const date = o.due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: o.daysAway > 9 || o.daysAway < -20 ? "short" : undefined });
  const chipText = o.status === "overdue" ? whenText(o) : o.status === "paid" ? `Paid · ${date}` : `${date} · ${o.cadence === "monthly" && !soon ? "monthly" : o.cadence === "yearly" && !soon ? "yearly" : whenText(o)}`;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, minHeight: 60, paddingHorizontal: t.space.space3, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border, backgroundColor: selected ? t.c.primarySoft : "transparent" }}>
      <CategoryIcon category={o.name} icon={o.status === "paid" ? "circle-check" : undefined} tone={o.status === "paid" ? "green" : undefined} size="sm" round />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>{o.name}</Txt>
        <View style={{ alignSelf: "flex-start", paddingHorizontal: chip.bg === "transparent" ? 0 : 7, paddingVertical: 1, borderRadius: 999, backgroundColor: chip.bg }}>
          <Txt variant="caption" color={chip.fg} style={{ fontSize: 11 }}>{chipText}</Txt>
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Txt variant="amountMd" color={o.status === "paid" ? t.c.inkMuted : t.c.ink}>{whole(o.amount)}</Txt>
        {onPay && o.status !== "paid" ? (
          <Pressable onPress={onPay} accessibilityRole="button" accessibilityLabel={`Mark ${o.name} paid`} hitSlop={8}>
            <Txt variant="caption" color={t.c.primary} style={{ fontWeight: "600", fontSize: 11 }}>Mark paid</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${o.name}, ${whole(o.amount)}, ${whenText(o)}`} android_ripple={{ color: t.c.surfaceAlt }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The month with each day's bills: amount due, green with a tick when paid, red when overdue, navy when selected,
 * outlined for today. With `names`, cells list the bills (desktop) instead of a compact amount.
 */
export function BillsMonthGrid({
  year,
  month,
  occurrences,
  selected,
  today,
  onSelect,
  names,
}: {
  year: number;
  month: number;
  occurrences: BillOccurrence[];
  selected: string;
  today: Date;
  onSelect: (key: string) => void;
  names?: boolean;
}) {
  const t = useTheme();
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const keyOf = (d: number) => `${year}-${month + 1}-${d}`;
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {(names ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : WEEK).map((d, i) => (
          <Txt key={i} variant="caption" color={t.c.inkMuted} style={{ flex: 1, textAlign: "center", fontSize: 11 }}>{d}</Txt>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={{ flexDirection: "row", gap: 4 }}>
          {week.map((d, i) => {
            if (d == null) return <View key={`p${w}-${i}`} style={{ flex: 1 }} />;
            const list = occurrences.filter((o) => o.due.getDate() === d);
            const overdue = list.some((o) => o.status === "overdue");
            const allPaid = list.length > 0 && list.every((o) => o.status === "paid");
            const sel = keyOf(d) === selected;
            const bg = sel ? t.c.hero : overdue ? t.c.dangerSoft : allPaid ? t.c.positiveSoft : list.length ? t.c.primarySoft : names ? t.c.surface : "transparent";
            const fg = sel ? t.c.onHero : overdue ? t.c.danger : allPaid ? t.c.positive : list.length ? t.c.onPrimarySoft : t.c.ink;
            const unpaid = list.filter((o) => o.status !== "paid").reduce((s, o) => s + o.amount, 0);
            const paid = list.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);
            const spoken = `${d}${isToday(d) ? ", today" : ""}${list.length ? `, ${list.map((o) => `${o.name} ${o.status}`).join(", ")}` : ""}`;
            return (
              <Pressable
                key={d}
                onPress={() => onSelect(keyOf(d))}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={spoken}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: names ? 64 : 44,
                  borderRadius: t.radius.radiusSm,
                  backgroundColor: bg,
                  borderWidth: isToday(d) && !sel ? 1.5 : names ? 1 : 0,
                  borderColor: isToday(d) && !sel ? t.c.primary : t.c.border,
                  alignItems: names ? "flex-start" : "center",
                  justifyContent: names ? "flex-start" : "center",
                  padding: names ? 5 : 0,
                  gap: 2,
                }}
              >
                <Txt variant="caption" color={fg} style={{ fontWeight: list.length || sel ? "600" : "400" }}>{String(d)}</Txt>
                {names
                  ? list.slice(0, 2).map((o) => (
                      <Txt key={o.key} variant="caption" color={fg} numberOfLines={1} style={{ fontSize: 10, lineHeight: 12, width: "100%" }}>
                        {`${o.status === "paid" ? "✓ " : ""}${o.name} ${compactNaira(Math.round(o.amount))}`}
                      </Txt>
                    ))
                  : list.length
                    ? (
                      <Txt variant="caption" color={fg} style={{ fontSize: 10, lineHeight: 12 }}>
                        {allPaid ? `✓ ${compactNaira(Math.round(paid)).replace("₦", "")}` : compactNaira(Math.round(unpaid)).replace("₦", "")}
                      </Txt>
                    )
                    : null}
                {names && list.length > 2 ? <Txt variant="caption" color={fg} style={{ fontSize: 10 }}>{`+${list.length - 2} more`}</Txt> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function NavyHeader({ topInset, children, wide }: { topInset: number; children: ReactNode; wide?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space4 }}>
      <View style={{ width: "100%", maxWidth: wide ? maxWidth.widthContent : maxWidth.widthReading, alignSelf: "center", gap: t.space.space4 }}>{children}</View>
    </View>
  );
}

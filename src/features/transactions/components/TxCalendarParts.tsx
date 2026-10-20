import { useRef } from "react";
import { Pressable, View } from "react-native";
import { Txt, compactNaira, formatMoney, maxWidth, useTheme } from "@/design";
import { RoundButton } from "@/features/transactions/components/TxFeedParts";
import type { CalendarDay, CalendarMonth } from "@/features/transactions/services/tx-feed";

const WEEK_MONDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_SUNDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Opacity of the primary colour per heat level; works in light and dark because primary flips with the theme. */
const HEAT = [0, 0.14, 0.3, 0.52, 0.78];

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 11 }}>{label}</Txt>
      <Txt variant="amountMd" color={t.c.onHero} numberOfLines={1}>{value}</Txt>
    </View>
  );
}

export function CalendarHeader({
  topInset,
  month,
  isCurrentMonth,
  cal,
  biggestLabel,
  onBack,
  onList,
  onPrev,
  onNext,
  onThisMonth,
}: {
  topInset: number;
  month: string;
  isCurrentMonth: boolean;
  cal: CalendarMonth | null;
  biggestLabel: string;
  onBack: () => void;
  onList: () => void;
  onPrev: () => void;
  onNext: () => void;
  onThisMonth: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space5 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          <RoundButton icon="chevron-left" label="Back" onPress={onBack} />
          <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Calendar</Txt>
          <RoundButton icon="list-filter" label="Show as a list" onPress={onList} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: t.space.space3, marginTop: t.space.space3 }}>
          <RoundButton icon="chevron-left" label="Previous month" onPress={onPrev} size={28} />
          <Pressable
            onPress={onThisMonth}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel={isCurrentMonth ? month : `${month}. Go to this month`}
            style={{ paddingHorizontal: 14, height: 28, borderRadius: 999, backgroundColor: t.c.heroDeco, justifyContent: "center" }}
          >
            <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontWeight: "500" }}>{month}</Txt>
          </Pressable>
          <RoundButton icon="chevron-right" label="Next month" onPress={onNext} disabled={isCurrentMonth} size={28} />
        </View>
        <View style={{ flexDirection: "row", marginTop: t.space.space4 }}>
          <Stat label="Spent" value={cal ? formatMoney(Math.round(cal.spent)).replace(/\.00$/, "") : "—"} />
          <Stat label={isCurrentMonth ? "Active so far" : "Active days"} value={cal ? `${cal.activeDays} of ${cal.daysSoFar} days` : "—"} />
          <Stat label="Biggest day" value={cal ? biggestLabel : "—"} />
        </View>
      </View>
    </View>
  );
}

function DayCell({ day, selected, onPress }: { day: CalendarDay; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const heat = HEAT[day.level];
  const strong = day.level >= 3;
  const fg = selected ? t.c.onHero : day.future ? t.c.inkMuted : strong ? t.c.onPrimary : t.c.ink;
  const sub = day.today ? "Today" : day.spent > 0 ? compactNaira(Math.round(day.spent)) : day.income > 0 ? "+in" : "";
  const spoken = [
    String(day.day),
    day.today ? "today" : "",
    day.spent > 0 ? `spent ${formatMoney(day.spent)}` : "",
    day.income > 0 ? `received ${formatMoney(day.income)}` : "",
    day.count === 0 && !day.future ? "nothing recorded" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={spoken}
      style={{ flex: 1, height: 48, borderRadius: t.radius.radiusMd, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
    >
      {selected ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.hero }} />
      ) : heat > 0 ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.primary, opacity: heat }} />
      ) : null}
      {day.today && !selected ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: t.radius.radiusMd, borderWidth: 1.5, borderColor: t.c.primary }} />
      ) : null}
      <Txt variant="label" color={fg} style={{ fontWeight: selected || day.today || strong ? "600" : "400" }}>{String(day.day)}</Txt>
      {sub ? (
        <Txt
          variant="caption"
          color={selected ? t.c.onHeroMuted : day.spent === 0 && day.income > 0 ? t.c.positive : fg}
          style={{ fontSize: 10, lineHeight: 12 }}
          numberOfLines={1}
        >
          {sub}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** The month as a spending heatmap. Swipe sideways to change month. */
export function CalendarGrid({
  cal,
  weekStartsOn,
  selected,
  onSelect,
  onSwipePrev,
  onSwipeNext,
}: {
  cal: CalendarMonth;
  weekStartsOn: "monday" | "sunday";
  selected: string;
  onSelect: (key: string) => void;
  onSwipePrev: () => void;
  onSwipeNext: () => void;
}) {
  const t = useTheme();
  const start = useRef<{ x: number; y: number } | null>(null);
  const cells: (CalendarDay | null)[] = [...Array.from({ length: cal.lead }, () => null), ...cal.days];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <View
      style={{ gap: 4 }}
      onTouchStart={(e) => {
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      }}
      onTouchEnd={(e) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = e.nativeEvent.pageX - from.x;
        const dy = e.nativeEvent.pageY - from.y;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (dx > 0) onSwipePrev();
        else onSwipeNext();
      }}
    >
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 2 }}>
        {(weekStartsOn === "monday" ? WEEK_MONDAY : WEEK_SUNDAY).map((d) => (
          <Txt key={d} variant="caption" color={t.c.inkMuted} style={{ flex: 1, textAlign: "center", fontSize: 11 }}>{d}</Txt>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={{ flexDirection: "row", gap: 4 }}>
          {week.map((day, i) =>
            day ? (
              <DayCell key={day.key} day={day} selected={day.key === selected} onPress={() => onSelect(day.key)} />
            ) : (
              <View key={`pad-${w}-${i}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 }}>
        <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 11 }}>Less</Txt>
        {HEAT.slice(1).map((o) => (
          <View key={o} style={{ width: 12, height: 12, borderRadius: 4, overflow: "hidden", backgroundColor: t.c.surfaceAlt }}>
            <View style={{ flex: 1, backgroundColor: t.c.primary, opacity: o }} />
          </View>
        ))}
        <Txt variant="caption" color={t.c.inkMuted} style={{ fontSize: 11 }}>More</Txt>
      </View>
    </View>
  );
}

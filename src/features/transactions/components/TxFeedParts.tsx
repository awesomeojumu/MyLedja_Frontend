import { Pressable, TextInput, View } from "react-native";
import { Icon, SpringPressable, Txt, formatMoney, maxWidth, useTheme, type IconName } from "@/design";
import type { FeedCounts, FeedFilter, MonthSummary } from "@/features/transactions/services/tx-feed";

export function RoundButton({ icon, label, onPress, disabled, size = 36 }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; size?: number }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}
    >
      <Icon name={icon} size={size > 32 ? 18 : 16} color={t.c.onHero} />
    </SpringPressable>
  );
}

const SPLIT_COLORS = ["#5DCAA5", "#F0997B", "#FAC775"];

function compact(n: number): string {
  return formatMoney(Math.round(n)).replace(/\.00$/, "");
}

/** The navy top of Transactions: the month, what went out, and where it went. Kept short so the list starts high. */
export function TxHeader({
  topInset,
  month,
  isCurrentMonth,
  summary,
  onPrev,
  onNext,
  onThisMonth,
  onCalendar,
  onSelect,
}: {
  topInset: number;
  month: string;
  isCurrentMonth: boolean;
  summary: MonthSummary | null;
  onPrev: () => void;
  onNext: () => void;
  onThisMonth: () => void;
  onCalendar: () => void;
  onSelect: () => void;
}) {
  const t = useTheme();
  const [whole, kobo] = formatMoney(summary?.spent ?? 0).split(".");
  const netText = summary ? `${summary.net < 0 ? "−" : summary.net > 0 ? "+" : ""}${compact(Math.abs(summary.net))}` : "—";
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: 48 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Transactions</Txt>
          <RoundButton icon="calendar" label="Calendar" onPress={onCalendar} />
          <RoundButton icon="list-filter" label="Select and edit several" onPress={onSelect} />
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

        <View style={{ alignItems: "center", marginTop: t.space.space3 }}>
          <Txt variant="caption" color={t.c.onHeroMuted}>Spent</Txt>
          <Txt
            variant="amountHero"
            color={t.c.onHero}
            style={{ fontSize: 30, lineHeight: 36 }}
            accessibilityLabel={summary ? `Spent ${formatMoney(summary.spent)}` : "Spent loading"}
          >
            {summary ? whole : "—"}
            {summary ? <Txt variant="amountLg" color={t.c.onHeroMuted} style={{ fontSize: 17 }}>.{kobo}</Txt> : null}
          </Txt>
          <Txt variant="caption" color={t.c.onHeroMuted} style={{ marginTop: 2 }}>
            {summary ? `In ${compact(summary.income)}  ·  Net ${netText}  ·  Daily avg ${compact(summary.dailyAverage)}` : " "}
          </Txt>
        </View>

        {summary && summary.split.length > 0 ? (
          <View style={{ marginTop: t.space.space3, gap: 6 }}>
            <View style={{ flexDirection: "row", height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: t.c.heroDeco, gap: 2 }}>
              {summary.split.map((s, i) => (
                <View key={s.name} style={{ width: `${s.share}%`, backgroundColor: SPLIT_COLORS[i] }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: t.space.space3, rowGap: 2 }}>
              {summary.split.map((s, i) => (
                <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: SPLIT_COLORS[i] }} />
                  <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 11 }}>{`${s.name} ${s.share}%`}</Txt>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const FILTERS: { id: Exclude<FeedFilter, "uncategorised">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expense", label: "Spent" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfers" },
];

/** Search and the type filter in one card that overlaps the bottom of the header. */
export function TxSearchCard({
  query,
  onQuery,
  filter,
  onFilter,
  counts,
  onMoreFilters,
  overlap = true,
}: {
  query: string;
  onQuery: (text: string) => void;
  filter: FeedFilter;
  onFilter: (filter: FeedFilter) => void;
  counts: FeedCounts;
  onMoreFilters: () => void;
  /** Phones: tuck under the header. Desktop: sit in the toolbar. */
  overlap?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        marginTop: overlap ? -36 : 0,
        marginHorizontal: overlap ? t.space.space3 : 0,
        padding: t.space.space2,
        gap: t.space.space2,
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
      <View style={{ flexDirection: "row", gap: t.space.space2 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 38, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
          <Icon name="search" size={16} color={t.c.inkMuted} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder="Search name, amount, account"
            placeholderTextColor={t.c.inkMuted}
            accessibilityLabel="Find a record"
            returnKeyType="search"
            autoCorrect={false}
            style={[t.text("bodySm"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
          />
          {query ? (
            <Pressable onPress={() => onQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Icon name="x" size={16} color={t.c.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onMoreFilters}
          accessibilityRole="button"
          accessibilityLabel="More filters"
          style={{ width: 38, height: 38, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="list-filter" size={18} color={t.c.ink} />
        </Pressable>
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4 }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const n = counts[f.id];
          return (
            <Pressable
              key={f.id}
              onPress={() => onFilter(f.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${f.label}, ${n}`}
              style={{ flex: 1, height: 30, borderRadius: t.radius.radiusSm, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.c.primarySoft : "transparent" }}
            >
              <Txt variant="caption" color={on ? t.c.onPrimarySoft : t.c.inkMuted} style={{ fontWeight: on ? "600" : "500" }} numberOfLines={1}>
                {n > 0 ? `${f.label} ${n}` : f.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "1 transaction needs a category · Review", or a way back once you're reviewing them. */
export function ReviewBanner({ count, reviewing, onPress }: { count: number; reviewing: boolean; onPress: () => void }) {
  const t = useTheme();
  const text = reviewing
    ? `Showing ${count} ${count === 1 ? "transaction" : "transactions"} without a category`
    : `${count} ${count === 1 ? "transaction needs" : "transactions need"} a category`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: t.radius.radiusMd, backgroundColor: t.c.primarySoft }}
    >
      <Icon name="info" size={16} color={t.c.onPrimarySoft} />
      <Txt variant="caption" color={t.c.onPrimarySoft} style={{ flex: 1 }}>{text}</Txt>
      <Txt variant="caption" color={t.c.onPrimarySoft} style={{ fontWeight: "600" }}>{reviewing ? "Show all" : "Review"}</Txt>
    </Pressable>
  );
}

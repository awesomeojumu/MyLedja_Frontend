import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Button, CategoryIcon, Icon, StatusBadge, Txt, formatMoney, maxWidth, useTheme } from "@/design";
import { RoundButton } from "@/features/transactions/components/TxFeedParts";
import type { MonthSummary, TableRow, TableSort } from "@/features/transactions/services/tx-feed";

const SPLIT_COLORS = ["#5DCAA5", "#F0997B", "#FAC775"];

function whole(n: number): string {
  return formatMoney(Math.round(n)).replace(/\.00$/, "");
}

function HeroStat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Txt variant="caption" color={t.c.onHeroMuted}>{label}</Txt>
      <Txt variant={big ? "amountHero" : "amountLg"} color={t.c.onHero} style={big ? { fontSize: 30, lineHeight: 36 } : undefined}>{value}</Txt>
    </View>
  );
}

/** Desktop: one navy strip with the month, its totals and where the money went. */
export function TxWideHeader({
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
  const net = summary ? `${summary.net < 0 ? "−" : summary.net > 0 ? "+" : ""}${whole(Math.abs(summary.net))}` : "—";
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space5, paddingHorizontal: t.space.space6, paddingBottom: t.space.space6 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", gap: t.space.space5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
          <Txt variant="titleLg" color={t.c.onHero} accessibilityRole="header">Transactions</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2, marginLeft: t.space.space4 }}>
            <RoundButton icon="chevron-left" label="Previous month" onPress={onPrev} size={32} />
            <Pressable
              onPress={onThisMonth}
              disabled={isCurrentMonth}
              accessibilityRole="button"
              accessibilityLabel={isCurrentMonth ? month : `${month}. Go to this month`}
              style={{ paddingHorizontal: 16, height: 32, borderRadius: 999, backgroundColor: t.c.heroDeco, justifyContent: "center" }}
            >
              <Txt variant="label" color={t.c.onHero}>{month}</Txt>
            </Pressable>
            <RoundButton icon="chevron-right" label="Next month" onPress={onNext} disabled={isCurrentMonth} size={32} />
          </View>
          <View style={{ flex: 1 }} />
          <RoundButton icon="calendar" label="Calendar" onPress={onCalendar} />
          <RoundButton icon="list-filter" label="Select and edit several" onPress={onSelect} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: t.space.space8 }}>
          <HeroStat label="Spent" value={summary ? formatMoney(summary.spent) : "—"} big />
          <HeroStat label="In" value={summary ? whole(summary.income) : "—"} />
          <HeroStat label="Net" value={net} />
          <HeroStat label="Daily average" value={summary ? whole(summary.dailyAverage) : "—"} />
          <View style={{ flex: 1, minWidth: 220, maxWidth: 420, marginLeft: "auto", gap: 6, paddingBottom: 4 }}>
            {summary && summary.split.length > 0 ? (
              <>
                <View style={{ flexDirection: "row", height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: t.c.heroDeco, gap: 2 }}>
                  {summary.split.map((s, i) => (
                    <View key={s.name} style={{ width: `${s.share}%`, backgroundColor: SPLIT_COLORS[i] }} />
                  ))}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: t.space.space4, rowGap: 2 }}>
                  {summary.split.map((s, i) => (
                    <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: SPLIT_COLORS[i] }} />
                      <Txt variant="caption" color={t.c.onHeroMuted}>{`${s.name} ${s.share}% · ${whole(s.value)}`}</Txt>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Txt variant="caption" color={t.c.onHeroMuted}>No spending yet this month</Txt>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Column shares of the table width (flex weights), so the columns fit whatever room the details panel leaves. */
const COLS = { when: 1, title: 2.2, category: 1.5, account: 1.1, amount: 1.3 };
/** Header and body cells share this, so titles always sit over their column. */
const cellStyle = (flex: number, right?: boolean) => ({ flex, minWidth: 0, paddingHorizontal: 12, overflow: "hidden" as const, alignItems: right ? ("flex-end" as const) : ("flex-start" as const) });

function HeadCell({ label, flex, align, sortKey, sort, onSort }: { label: string; flex: number; align?: "right"; sortKey?: TableSort["key"]; sort: TableSort; onSort: (key: TableSort["key"]) => void }) {
  const t = useTheme();
  const on = sortKey != null && sort.key === sortKey;
  const text = <Txt variant="caption" color={on ? t.c.ink : t.c.inkMuted} style={{ fontWeight: "600" }}>{label}</Txt>;
  return (
    <View style={[cellStyle(flex, align === "right"), { justifyContent: "center" }]}>
      {sortKey ? (
        <Pressable
          onPress={() => onSort(sortKey)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${label}${on ? (sort.dir === "asc" ? ", ascending" : ", descending") : ""}`}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          {text}
          <Icon name={on ? (sort.dir === "asc" ? "chevron-up" : "chevron-down") : "arrow-up-down"} size={13} color={on ? t.c.ink : t.c.inkMuted} />
        </Pressable>
      ) : (
        text
      )}
    </View>
  );
}

function TableLine({ row, selected, showDay, onPress, onAddCategory }: { row: TableRow; selected: boolean; showDay: boolean; onPress: () => void; onAddCategory: () => void }) {
  const t = useTheme();
  const [hovered, setHovered] = useState(false);
  const sign = row.kind === "income" ? "+" : row.kind === "expense" ? "−" : "";
  const color = row.kind === "income" ? t.c.positive : row.kind === "transfer" ? t.c.transfer : t.c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${row.title}, ${row.kind}, ${formatMoney(row.amount)}, ${row.day}`}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 52,
        borderBottomWidth: 1,
        borderBottomColor: t.c.border,
        backgroundColor: selected ? t.c.primarySoft : hovered ? t.c.surfaceAlt : "transparent",
      }}
    >
      {selected ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: t.c.primary }} /> : null}
      <View style={cellStyle(COLS.when)}>
        <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>{showDay ? row.day.replace(/^Yesterday · /, "") : row.time}</Txt>
      </View>
      <View style={[cellStyle(COLS.title), { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        {row.needsCategory ? (
          <View style={{ width: 32, height: 32, borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: t.c.borderStrong, alignItems: "center", justifyContent: "center" }}>
            <Txt variant="caption" color={t.c.inkMuted}>?</Txt>
          </View>
        ) : (
          <CategoryIcon category={row.kind === "transfer" ? "Transfer" : row.category || row.title} size="sm" round />
        )}
        <Txt variant="bodySm" style={{ fontWeight: "500", flexShrink: 1 }} numberOfLines={1}>{row.title}</Txt>
        {row.pending ? <StatusBadge status="pending" /> : null}
      </View>
      <View style={cellStyle(COLS.category)}>
        {row.needsCategory ? (
          <Pressable
            onPress={onAddCategory}
            accessibilityRole="button"
            accessibilityLabel={`Add a category to ${row.title}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: t.c.primarySoft }}
          >
            <Icon name="plus" size={12} color={t.c.onPrimarySoft} />
            <Txt variant="caption" color={t.c.onPrimarySoft} style={{ fontWeight: "500" }}>Add category</Txt>
          </Pressable>
        ) : (
          <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>{row.category ?? "—"}</Txt>
        )}
      </View>
      <View style={cellStyle(COLS.account)}>
        <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>{row.account || "—"}</Txt>
      </View>
      <View style={cellStyle(COLS.amount, true)}>
        <Txt variant="amountMd" color={color} numberOfLines={1}>{`${sign}${formatMoney(row.amount)}`}</Txt>
      </View>
    </Pressable>
  );
}

/** Desktop table. Sorted by date it shows a band per day with that day's net; otherwise each row shows its day. */
export function TxTable({
  rows,
  sort,
  onSort,
  selectedId,
  checkedIds,
  onSelect,
  onAddCategory,
  footer,
}: {
  rows: TableRow[];
  sort: TableSort;
  onSort: (key: TableSort["key"]) => void;
  selectedId: string | null;
  /** Select mode: every checked row is highlighted instead of the single selected one. */
  checkedIds?: Set<string>;
  onSelect: (id: string) => void;
  onAddCategory: (id: string) => void;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const byDate = sort.key === "date";
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", height: 40, backgroundColor: t.c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: t.c.border }}>
        <HeadCell label={byDate ? "Time" : "Date"} flex={COLS.when} sortKey="date" sort={sort} onSort={onSort} />
        <HeadCell label="Description" flex={COLS.title} sortKey="title" sort={sort} onSort={onSort} />
        <HeadCell label="Category" flex={COLS.category} sort={sort} onSort={onSort} />
        <HeadCell label="Account" flex={COLS.account} sort={sort} onSort={onSort} />
        <HeadCell label="Amount" flex={COLS.amount} align="right" sortKey="amount" sort={sort} onSort={onSort} />
      </View>
      {rows.map((row) => (
        <View key={row.id}>
          {byDate && row.dayNet !== undefined ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: t.c.border }}>
              <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600" }} accessibilityRole="header">{row.day}</Txt>
              {row.dayNet !== 0 ? (
                <Txt variant="caption" color={t.c.inkMuted}>{`${row.dayNet > 0 ? "+" : "−"}${formatMoney(Math.abs(row.dayNet))}`}</Txt>
              ) : null}
            </View>
          ) : null}
          <TableLine
            row={row}
            selected={checkedIds ? checkedIds.has(row.id) : row.id === selectedId}
            showDay={!byDate}
            onPress={() => onSelect(row.id)}
            onAddCategory={() => onAddCategory(row.id)}
          />
        </View>
      ))}
      {footer}
    </View>
  );
}

function Fact({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border }}>
      <Txt variant="bodySm" color={t.c.inkMuted}>{label}</Txt>
      {typeof value === "string" ? <Txt variant="bodySm" style={{ fontWeight: "500", textAlign: "right", flexShrink: 1 }}>{value}</Txt> : value}
    </View>
  );
}

/** The side panel for the selected row: the essentials and the common actions, without leaving the table. */
export function TxDetailPanel({
  row,
  when,
  onClose,
  onEdit,
  onSplit,
  onRefund,
  onHistory,
  onVoid,
  onAddCategory,
}: {
  row: TableRow;
  when: string;
  onClose: () => void;
  onEdit: () => void;
  onSplit: () => void;
  onRefund?: () => void;
  onHistory: () => void;
  onVoid: () => void;
  onAddCategory: () => void;
}) {
  const t = useTheme();
  const sign = row.kind === "income" ? "+" : row.kind === "expense" ? "−" : "";
  const color = row.kind === "income" ? t.c.positive : row.kind === "transfer" ? t.c.transfer : t.c.ink;
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, padding: t.space.space5, gap: t.space.space4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Txt variant="label" color={t.c.inkMuted} style={{ flex: 1 }}>Details</Txt>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close details" hitSlop={8}>
          <Icon name="x" size={18} color={t.c.inkMuted} />
        </Pressable>
      </View>
      <View style={{ alignItems: "center", gap: 6 }}>
        <CategoryIcon category={row.kind === "transfer" ? "Transfer" : row.category || row.title} size="lg" round />
        <Txt variant="titleMd" style={{ textAlign: "center" }} accessibilityRole="header">{row.title}</Txt>
        <Txt variant="amountHero" color={color} style={{ fontSize: 28, lineHeight: 34 }}>{`${sign}${formatMoney(row.amount)}`}</Txt>
        {row.pending ? <StatusBadge status="pending" /> : null}
      </View>
      <View style={{ paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
        <Fact
          label="Category"
          value={
            row.needsCategory ? (
              <Pressable onPress={onAddCategory} accessibilityRole="button" hitSlop={6}>
                <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "600" }}>Add category</Txt>
              </Pressable>
            ) : (
              row.category ?? "—"
            )
          }
        />
        <Fact label={row.kind === "income" ? "Paid into" : row.kind === "transfer" ? "From" : "Paid from"} value={row.account || "—"} />
        <Fact label="When" value={when} />
        <Fact label="Status" value={row.pending ? "Waiting to sync" : "Posted"} last />
      </View>
      <View style={{ gap: t.space.space2 }}>
        <Button fullWidth icon="pencil" onPress={onEdit}>Edit</Button>
        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" fullWidth onPress={onSplit}>Split</Button>
          </View>
          {onRefund ? (
            <View style={{ flex: 1 }}>
              <Button variant="secondary" fullWidth onPress={onRefund}>Refund</Button>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button variant="secondary" fullWidth onPress={onHistory}>History</Button>
          </View>
        </View>
        <Button variant="tertiary" fullWidth onPress={onVoid}>Void transaction</Button>
      </View>
    </View>
  );
}

/** Shown in the panel's place when nothing is selected, so the layout doesn't jump. */
export function TxPanelHint() {
  const t = useTheme();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, borderWidth: 1, borderStyle: "dashed", borderColor: t.c.border, padding: t.space.space6, alignItems: "center", gap: t.space.space2 }}>
      <Icon name="receipt" size={24} color={t.c.inkMuted} />
      <Txt variant="bodySm" color={t.c.inkMuted} style={{ textAlign: "center" }}>Select a transaction to see its details and actions here.</Txt>
    </View>
  );
}

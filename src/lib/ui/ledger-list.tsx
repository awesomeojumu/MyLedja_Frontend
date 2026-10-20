import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { CategoryIcon, Icon, StatusBadge, Txt, formatMoney, useTheme } from "@/design";
import type { RowKind } from "@/lib/money-map";

const HIDDEN = "₦ ••••••";

export interface LedgerItem {
  id: string;
  title: string;
  /** Category name; drives the icon. Empty means the row still needs a category. */
  category?: string;
  account: string;
  amount: number;
  kind: RowKind;
  time: string;
  pending?: boolean;
  /** Show the "+ Add category" chip instead of the category and account line. */
  needsCategory?: boolean;
}

/** One transaction row, shared by Home and Transactions so both read the same way. */
export function LedgerRow({
  item,
  hidden = false,
  last = false,
  compact = false,
  onPress,
  onAddCategory,
  onLongPress,
  selected,
}: {
  item: LedgerItem;
  hidden?: boolean;
  last?: boolean;
  compact?: boolean;
  onPress?: () => void;
  onAddCategory?: () => void;
  onLongPress?: () => void;
  /** Set while selecting several rows: shows a check circle instead of the icon. Undefined outside select mode. */
  selected?: boolean;
}) {
  const t = useTheme();
  const sign = item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "";
  const color = item.kind === "income" ? t.c.positive : item.kind === "transfer" ? t.c.transfer : t.c.ink;
  const sub = [item.category, item.account, item.time].filter(Boolean).join(" · ");
  const selecting = selected !== undefined;
  const icon = selecting ? (
    <View
      style={{
        width: compact ? 36 : 40,
        height: compact ? 36 : 40,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          borderWidth: selected ? 0 : 1.5,
          borderColor: t.c.borderStrong,
          backgroundColor: selected ? t.c.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <Icon name="check" size={14} color={t.c.onPrimary} /> : null}
      </View>
    </View>
  ) : item.needsCategory ? (
    <View
      style={{
        width: compact ? 36 : 40,
        height: compact ? 36 : 40,
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.c.borderStrong,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt variant="label" color={t.c.inkMuted}>?</Txt>
    </View>
  ) : (
    <CategoryIcon category={item.kind === "transfer" ? "Transfer" : item.category || item.title} size={compact ? "sm" : "md"} round />
  );
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 10 : 12,
        minHeight: compact ? 56 : 64,
        paddingVertical: compact ? 8 : 12,
        paddingHorizontal: compact ? 12 : 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.c.border,
        backgroundColor: selected ? t.c.primarySoft : "transparent",
      }}
    >
      {icon}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>{item.title}</Txt>
        {item.needsCategory && !selecting ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              onPress={onAddCategory}
              accessibilityRole="button"
              accessibilityLabel={`Add a category to ${item.title}`}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, height: 20, borderRadius: 999, backgroundColor: t.c.primarySoft }}
            >
              <Icon name="plus" size={12} color={t.c.onPrimarySoft} />
              <Txt variant="caption" color={t.c.onPrimarySoft} style={{ fontWeight: "500" }}>Add category</Txt>
            </Pressable>
            {item.time ? <Txt variant="caption" color={t.c.inkMuted}>{item.time}</Txt> : null}
          </View>
        ) : sub ? (
          <Txt variant={compact ? "caption" : "bodySm"} color={t.c.inkMuted} numberOfLines={1}>{sub}</Txt>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Txt variant="amountMd" color={hidden ? t.c.inkMuted : color}>{hidden ? HIDDEN : `${sign}${formatMoney(item.amount)}`}</Txt>
        {item.pending ? <StatusBadge status="pending" /> : null}
      </View>
    </View>
  );
  const spoken = `${item.title}, ${item.kind}${hidden ? ", amount hidden" : `, ${formatMoney(item.amount)}`}`;
  return onPress ? (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={spoken}
      accessibilityHint={selecting ? undefined : onLongPress ? "Opens the details. Long press to select several" : "Opens the details"}
      android_ripple={{ color: t.c.surfaceAlt }}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={spoken}>{body}</View>
  );
}

/** A day's heading (with its net) above a rounded card of rows. */
export function LedgerDay({ label, net, hidden = false, children }: { label: string; net: number; hidden?: boolean; children: ReactNode }) {
  const t = useTheme();
  const total = net === 0 || hidden ? "" : `${net > 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600" }} accessibilityRole="header">{label}</Txt>
        {total ? <Txt variant="caption" color={t.c.inkMuted}>{total}</Txt> : null}
      </View>
      <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}

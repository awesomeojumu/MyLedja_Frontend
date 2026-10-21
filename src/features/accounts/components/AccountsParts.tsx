import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Button, Icon, SpringPressable, Txt, formatMoney, maxWidth, toneColors, useTheme, type CategoryTone, type IconName } from "@/design";
import { LedgerRow, type LedgerItem, ProfileButton } from "@/lib/ui";
import {
  initials,
  subLine,
  visibleSplit,
  type AccountGroup,
  type AccountSort,
  type AccountView,
  type GroupMode,
  type Totals,
} from "@/features/accounts/services/accounts-view";

/** Light fills that read on the navy hero in both themes. */
const PART_COLORS: Record<Totals["parts"][number]["key"], string> = {
  cash: "#85B7EB",
  savings: "#5DCAA5",
  receivable: "#FAC775",
  liability: "#F0997B",
};
const TILE_TONES: CategoryTone[] = ["orange", "sky", "purple", "teal", "pink", "gold", "green"];

function whole(n: number): string {
  return formatMoney(Math.round(n)).replace(/\.00$/, "");
}

function signed(n: number): string {
  return `${n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`;
}

function HeroButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={18} color={t.c.onHero} />
    </SpringPressable>
  );
}

function HeroPill({ action }: { action: QuickAction }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.c.heroDeco }}
    >
      <Icon name={action.icon} size={16} color={t.c.onHero} />
      <Txt variant="label" color={t.c.onHero}>{action.label}</Txt>
    </SpringPressable>
  );
}

function CompositionBar({ totals, height = 6 }: { totals: Totals; height?: number }) {
  const t = useTheme();
  const sum = totals.parts.reduce((s, p) => s + p.value, 0);
  if (sum <= 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", height, borderRadius: 999, overflow: "hidden", gap: 2, backgroundColor: t.c.heroDeco }}>
        {totals.parts.map((p) => (
          <View key={p.key} style={{ width: `${(p.value / sum) * 100}%`, backgroundColor: PART_COLORS[p.key] }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: t.space.space3, rowGap: 2 }}>
        {totals.parts.map((p) => (
          <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: PART_COLORS[p.key] }} />
            <Txt variant="caption" color={t.c.onHeroMuted} style={{ fontSize: 11 }}>{p.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export interface QuickAction {
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** Navy top of Accounts: net worth, what you have and owe, and how it's split. */
export function AccountsHeader({
  topInset,
  count,
  many,
  totals,
  wide,
  actions,
  onArchived,
  onAdd,
  addLabel,
}: {
  topInset: number;
  count: number;
  many: boolean;
  totals: Totals | null;
  wide: boolean;
  actions: QuickAction[];
  onArchived: () => void;
  onAdd: () => void;
  addLabel: string;
}) {
  const t = useTheme();
  const [w, k] = formatMoney(Math.abs(totals?.netWorth ?? 0)).split(".");
  const sign = (totals?.netWorth ?? 0) < 0 ? "−" : "";
  const net = (
    <Txt variant="amountHero" color={t.c.onHero} style={{ fontSize: wide ? 40 : many ? 28 : 32, lineHeight: wide ? 48 : 38 }}>
      {totals ? `${sign}${w}` : "—"}
      {totals ? <Txt variant="amountLg" color={t.c.onHeroMuted} style={{ fontSize: wide ? 22 : 17 }}>.{k}</Txt> : null}
    </Txt>
  );
  const haveOwe = totals ? (
    <Txt variant="caption" color={t.c.onHero}>
      <Txt variant="caption" color={t.c.onHeroMuted}>You have </Txt>
      {whole(totals.have)}
      <Txt variant="caption" color={t.c.onHeroMuted}>{"  ·  "}You owe </Txt>
      <Txt variant="caption" color={totals.owe > 0 ? "#F5C4B3" : t.c.onHero}>{whole(totals.owe)}</Txt>
    </Txt>
  ) : null;
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space3, paddingHorizontal: wide ? t.space.space6 : t.space.space4, paddingBottom: wide ? t.space.space6 : many ? 52 : 56 }}>
      <View style={{ width: "100%", maxWidth: wide ? maxWidth.widthContent : maxWidth.widthReading, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          <Txt variant={wide ? "titleLg" : "titleMd"} color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>
            {many ? `Accounts · ${count}` : "Accounts"}
          </Txt>
          {wide ? actions.map((a) => <HeroPill key={a.label} action={a} />) : null}
          <HeroButton icon="archive" label="Archived accounts" onPress={onArchived} />
          <HeroButton icon="plus" label={addLabel} onPress={onAdd} />
          <ProfileButton />
        </View>
        {wide ? (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: t.space.space8, marginTop: t.space.space5 }}>
            <View style={{ gap: 2 }}>
              <Txt variant="caption" color={t.c.onHeroMuted}>Net worth</Txt>
              {net}
              {haveOwe}
            </View>
            <View style={{ flex: 1, maxWidth: 420, marginLeft: "auto", paddingBottom: 4 }}>
              {totals ? <CompositionBar totals={totals} height={8} /> : null}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: "center", marginTop: t.space.space4 }}>
            <Txt variant="caption" color={t.c.onHeroMuted}>Net worth</Txt>
            {net}
            {haveOwe}
            {totals && !many ? (
              <View style={{ alignSelf: "stretch", marginTop: t.space.space3 }}>
                <CompositionBar totals={totals} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const floating = (t: ReturnType<typeof useTheme>) => ({
  marginTop: -40,
  marginHorizontal: t.space.space3,
  borderRadius: t.radius.radiusLg,
  backgroundColor: t.c.surface,
  borderWidth: 1,
  borderColor: t.c.border,
  shadowColor: "#0d111c",
  shadowOpacity: t.scheme === "dark" ? 0 : 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
});

/** Floating shortcuts under the header (phones, up to ten accounts). */
export function AccountsActions({ actions }: { actions: QuickAction[] }) {
  const t = useTheme();
  return (
    <View style={[floating(t), { flexDirection: "row", paddingVertical: t.space.space3, paddingHorizontal: t.space.space1 }]}>
      {actions.map((a) => (
        <View key={a.label} style={{ flex: 1 }}>
          <SpringPressable onPress={a.onPress} hapticOn="start" accessibilityRole="button" accessibilityLabel={a.label} style={{ alignItems: "center", gap: 5 }}>
            <View style={{ width: 44, height: 44, borderRadius: t.radius.radiusMd, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Icon name={a.icon} size={20} color={t.c.onPrimarySoft} />
            </View>
            <Txt variant="caption" style={{ fontWeight: "500" }} numberOfLines={1}>{a.label}</Txt>
          </SpringPressable>
        </View>
      ))}
    </View>
  );
}

function Segment<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: 10, height: 28, borderRadius: t.radius.radiusSm, justifyContent: "center", backgroundColor: on ? t.c.primarySoft : "transparent" }}
          >
            <Txt variant="caption" color={on ? t.c.onPrimarySoft : t.c.inkMuted} style={{ fontWeight: on ? "600" : "500" }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** With many accounts: find, group by type or bank, and sort. */
export function AccountsSearchCard({
  query,
  onQuery,
  mode,
  onMode,
  sort,
  onSort,
  overlap = true,
}: {
  query: string;
  onQuery: (q: string) => void;
  mode: GroupMode;
  onMode: (m: GroupMode) => void;
  sort: AccountSort;
  onSort: (s: AccountSort) => void;
  overlap?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[floating(t), { padding: t.space.space2, gap: t.space.space2 }, overlap ? null : { marginTop: 0, marginHorizontal: 0 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 38, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
        <Icon name="search" size={16} color={t.c.inkMuted} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Find an account"
          placeholderTextColor={t.c.inkMuted}
          accessibilityLabel="Find an account"
          autoCorrect={false}
          style={[t.text("bodySm"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
        />
        {query ? (
          <Pressable onPress={() => onQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
            <Icon name="x" size={16} color={t.c.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Segment value={mode} onChange={onMode} options={[{ id: "type", label: "By type" }, { id: "bank", label: "By bank" }]} />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => onSort(sort === "balance" ? "name" : "balance")}
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${sort === "balance" ? "largest balance" : "name"}. Change sort`}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 28 }}
        >
          <Icon name="arrow-up-down" size={14} color={t.c.inkMuted} />
          <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "500" }}>{sort === "balance" ? "Largest" : "A–Z"}</Txt>
        </Pressable>
      </View>
    </View>
  );
}

/** Only when a bank's balance disagrees with ours. One issue links straight to the fix; several open a short list. */
export function AttentionBanner({ issues, onFix }: { issues: AccountView[]; onFix: (id: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;
  const off = (v: AccountView) => `${v.name} is ${formatMoney(Math.abs(v.mismatch ?? 0))} off your bank's balance`;
  const single = issues.length === 1;
  return (
    <View style={{ borderRadius: t.radius.radiusMd, backgroundColor: t.c.warningSoft, overflow: "hidden" }}>
      <Pressable
        onPress={() => (single ? onFix(issues[0].id) : setOpen((v) => !v))}
        accessibilityRole="button"
        accessibilityState={single ? undefined : { expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}
      >
        <Icon name="triangle-alert" size={16} color={t.c.warning} />
        <Txt variant="caption" color={t.c.warning} style={{ flex: 1 }}>{single ? off(issues[0]) : `${issues.length} accounts need attention`}</Txt>
        <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>{single ? "Fix" : open ? "Hide" : "Review"}</Txt>
      </Pressable>
      {!single && open
        ? issues.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => onFix(v.id)}
              accessibilityRole="button"
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.c.border }}
            >
              <Txt variant="caption" color={t.c.warning} style={{ flex: 1 }}>{off(v)}</Txt>
              <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>Fix</Txt>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const KIND_ICON: Record<string, IconName> = {
  cash: "banknote",
  savings: "piggy-bank",
  receivable: "hand-heart",
  liability: "credit-card",
};

export function AccountTile({ view, size = 38 }: { view: AccountView; size?: number }) {
  const t = useTheme();
  const icon = KIND_ICON[view.kind] ?? (view.kind === "wallet" && !view.institution ? "smartphone" : null);
  const label = view.institution || view.name;
  const tone: CategoryTone =
    view.kind === "cash" ? "green" : view.kind === "savings" ? "teal" : view.group === "liability" ? "slate" : TILE_TONES[(label.charCodeAt(0) || 0) % TILE_TONES.length];
  const { fg, bg } = toneColors(t, tone);
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: t.radius.radiusMd, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      {icon ? <Icon name={icon} size={size * 0.47} color={fg} /> : <Txt variant="label" color={fg} style={{ fontWeight: "700", fontSize: size * 0.32 }}>{initials(label)}</Txt>}
    </View>
  );
}

function changeText(v: AccountView): { text: string; good: boolean } | null {
  if (v.change == null) return null;
  if (v.change === 0) return { text: "No change this month", good: false };
  return { text: `${v.change > 0 ? "+" : "−"}${whole(Math.abs(v.change))} this month`, good: v.change > 0 };
}

export function AccountLine({
  view,
  last,
  compact,
  selected,
  onPress,
  onLongPress,
}: {
  view: AccountView;
  last: boolean;
  compact: boolean;
  selected?: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useTheme();
  const change = changeText(view);
  const dim = view.empty && !view.pinned;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityState={selected != null ? { selected } : undefined}
      accessibilityLabel={`${view.name}, ${signed(view.signed)}${view.pinned ? ", pinned" : ""}`}
      accessibilityHint={view.pinned ? "Long-press to unpin" : "Long-press to pin to the top"}
      android_ripple={{ color: t.c.surfaceAlt }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: compact ? 52 : 60,
        paddingVertical: compact ? 8 : 10,
        paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.c.border,
        backgroundColor: selected ? t.c.primarySoft : "transparent",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <AccountTile view={view} size={compact ? 34 : 38} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500", flexShrink: 1 }}>{view.name}</Txt>
          {view.pinned ? <Icon name="pin" size={12} color={t.c.inkMuted} label="Pinned" /> : null}
        </View>
        <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>{subLine(view)}</Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Txt variant="amountMd" numberOfLines={1}>{signed(view.signed)}</Txt>
        {change && !compact ? (
          <Txt variant="caption" color={change.good ? t.c.positive : t.c.inkMuted} style={{ fontSize: 11 }}>{change.text}</Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** One group: a header you can tap to fold, its total, and up to four accounts before "Show more". */
export function AccountGroupSection({
  group,
  collapsed,
  onToggle,
  showAll,
  onShowAll,
  compact,
  selectedId,
  onOpen,
  onPin,
}: {
  group: AccountGroup;
  collapsed: boolean;
  onToggle: () => void;
  showAll: boolean;
  onShowAll: () => void;
  compact: boolean;
  selectedId?: string | null;
  onOpen: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const t = useTheme();
  const split = showAll ? { shown: group.accounts, hidden: 0, hiddenEmpty: 0 } : visibleSplit(group.accounts);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={`${group.label}, ${group.accounts.length} accounts, ${signed(group.total)}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}
      >
        <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={14} color={t.c.inkMuted} />
        <Txt variant="caption" color={t.c.inkMuted} style={{ flex: 1, fontWeight: "600" }}>{`${group.label} · ${group.accounts.length}`}</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>{signed(group.total)}</Txt>
      </Pressable>
      <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
        {collapsed ? (
          <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={`Show ${group.label}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: "row" }}>
              {group.accounts.slice(0, 3).map((a, i) => (
                <View key={a.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: t.radius.radiusMd, borderWidth: 2, borderColor: t.c.surface }}>
                  <AccountTile view={a} size={24} />
                </View>
              ))}
            </View>
            <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1} style={{ flex: 1 }}>{group.accounts.map((a) => a.name).join(", ")}</Txt>
          </Pressable>
        ) : (
          <>
            {split.shown.map((a, i) => (
              <AccountLine
                key={a.id}
                view={a}
                compact={compact}
                last={i === split.shown.length - 1 && split.hidden === 0}
                selected={selectedId === undefined ? undefined : selectedId === a.id}
                onPress={() => onOpen(a.id)}
                onLongPress={() => onPin(a.id)}
              />
            ))}
            {split.hidden > 0 ? (
              <Pressable onPress={onShowAll} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10 }}>
                <Txt variant="caption" color={t.c.primary} style={{ fontWeight: "600" }}>
                  {`Show ${split.hidden} more${split.hiddenEmpty > 0 ? ` · ${split.hiddenEmpty} ${split.hiddenEmpty === 1 ? "is" : "are"} empty` : ""}`}
                </Txt>
                <Icon name="chevron-down" size={14} color={t.c.primary} />
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const ADD_CHOICES: { label: string; body: string; icon: IconName }[] = [
  { label: "Bank account", body: "Current or savings at a bank", icon: "landmark" },
  { label: "Cash", body: "Money in your wallet or at home", icon: "banknote" },
  { label: "Mobile wallet", body: "OPay, PalmPay, Moniepoint and others", icon: "smartphone" },
];

/** First run: three clear choices instead of a bare button. */
export function AccountsEmpty({ onAdd }: { onAdd: () => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.space3, paddingTop: t.space.space4 }}>
      <View style={{ alignItems: "center", gap: 4, paddingBottom: t.space.space2 }}>
        <Txt variant="titleMd" accessibilityRole="header">Add your first account</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted} style={{ textAlign: "center" }}>Start with where your money is today. You can add more later.</Txt>
      </View>
      {ADD_CHOICES.map((c) => (
        <Pressable
          key={c.label}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add account: ${c.label}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: t.space.space4, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border }}
        >
          <View style={{ width: 40, height: 40, borderRadius: t.radius.radiusMd, backgroundColor: t.c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name={c.icon} size={20} color={t.c.onPrimarySoft} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="titleSm">{c.label}</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>{c.body}</Txt>
          </View>
          <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
        </Pressable>
      ))}
    </View>
  );
}

function PanelStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="caption" color={t.c.inkMuted}>{label}</Txt>
      <Txt variant="amountMd" color={tone ?? t.c.ink} numberOfLines={1}>{value}</Txt>
    </View>
  );
}

/** Desktop side panel for the selected account. */
export function AccountPanel({
  view,
  activity,
  onClose,
  onOpen,
  onTransfer,
  onReconcile,
  onImport,
  onAdjust,
  onPin,
  onOpenTransaction,
}: {
  view: AccountView;
  activity: LedgerItem[];
  onClose: () => void;
  onOpen: () => void;
  onTransfer: () => void;
  onReconcile: () => void;
  onImport: () => void;
  onAdjust: () => void;
  onPin: () => void;
  onOpenTransaction: (id: string) => void;
}) {
  const t = useTheme();
  const change = changeText(view);
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, padding: t.space.space5, gap: t.space.space4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
        <AccountTile view={view} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="titleMd" numberOfLines={1} accessibilityRole="header">{view.name}</Txt>
          <Txt variant="caption" color={t.c.inkMuted} numberOfLines={1}>{subLine(view)}</Txt>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close details" hitSlop={8}>
          <Icon name="x" size={18} color={t.c.inkMuted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: t.space.space3, padding: t.space.space3, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
        <PanelStat label={view.group === "liability" ? "You owe" : "Balance"} value={formatMoney(view.balance)} />
        {change ? <PanelStat label="This month" value={change.text.replace(" this month", "")} tone={change.good ? t.c.positive : undefined} /> : null}
      </View>
      {view.mismatch != null ? (
        <Pressable onPress={onReconcile} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: t.radius.radiusMd, backgroundColor: t.c.warningSoft }}>
          <Icon name="triangle-alert" size={14} color={t.c.warning} />
          <Txt variant="caption" color={t.c.warning} style={{ flex: 1 }}>{`Your bank says ${formatMoney(view.balance + view.mismatch)}`}</Txt>
          <Txt variant="caption" color={t.c.warning} style={{ fontWeight: "600" }}>Reconcile</Txt>
        </Pressable>
      ) : null}
      <View style={{ gap: t.space.space2 }}>
        <Txt variant="label" color={t.c.inkMuted}>Recent activity</Txt>
        {activity.length === 0 ? (
          <Txt variant="bodySm" color={t.c.inkMuted}>Nothing recorded yet.</Txt>
        ) : (
          <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
            {activity.map((item, i) => (
              <LedgerRow key={item.id} item={item} compact last={i === activity.length - 1} onPress={() => onOpenTransaction(item.id)} />
            ))}
          </View>
        )}
      </View>
      <View style={{ gap: t.space.space2 }}>
        <Button fullWidth onPress={onOpen}>Open account</Button>
        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
          <View style={{ flex: 1 }}><Button variant="secondary" fullWidth onPress={onTransfer}>Transfer</Button></View>
          <View style={{ flex: 1 }}><Button variant="secondary" fullWidth onPress={onReconcile}>Reconcile</Button></View>
        </View>
        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
          <View style={{ flex: 1 }}><Button variant="secondary" fullWidth onPress={onImport}>Import</Button></View>
          <View style={{ flex: 1 }}><Button variant="secondary" fullWidth onPress={onAdjust}>Adjust</Button></View>
        </View>
        <Button variant="tertiary" fullWidth icon="pin" onPress={onPin}>{view.pinned ? "Unpin" : "Pin to top"}</Button>
      </View>
    </View>
  );
}

export function PanelHint({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: t.radius.radiusLg, borderWidth: 1, borderStyle: "dashed", borderColor: t.c.border, padding: t.space.space6, alignItems: "center", gap: t.space.space2 }}>
      <Icon name="wallet" size={24} color={t.c.inkMuted} />
      <Txt variant="bodySm" color={t.c.inkMuted} style={{ textAlign: "center" }}>{children}</Txt>
    </View>
  );
}

import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Button, CategoryIcon, Chip, DatePicker, Icon, Sheet, SpringPressable, Txt, cleanAmount, formatMoney, maxWidth, useTheme, type IconName } from "@/design";
import { activeFilterCount, NO_FILTERS, type FeedFilters } from "@/features/transactions/services/bulk-edit";

/** Select mode's header: the navy bar shrinks to the count, the selected total and Select all. */
export function SelectBar({
  topInset,
  count,
  total,
  allSelected,
  onCancel,
  onToggleAll,
}: {
  topInset: number;
  count: number;
  total: number;
  allSelected: boolean;
  onCancel: () => void;
  onToggleAll: () => void;
}) {
  const t = useTheme();
  const sign = total < 0 ? "−" : total > 0 ? "+" : "";
  return (
    <View style={{ backgroundColor: t.c.hero, paddingTop: topInset + t.space.space3, paddingBottom: t.space.space3, paddingHorizontal: t.space.space4 }}>
      <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Stop selecting" hitSlop={10}>
          <Icon name="x" size={20} color={t.c.onHeroMuted} />
        </Pressable>
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          <Txt variant="titleSm" color={t.c.onHero} accessibilityRole="header">{count === 0 ? "Select transactions" : `${count} selected`}</Txt>
          <Txt variant="caption" color={t.c.onHeroMuted}>{count === 0 ? "Tap rows to choose them" : `${sign}${formatMoney(Math.abs(total))}`}</Txt>
        </View>
        <Pressable onPress={onToggleAll} accessibilityRole="button" hitSlop={8} style={{ paddingHorizontal: 12, height: 30, borderRadius: 999, backgroundColor: t.c.heroDeco, justifyContent: "center" }}>
          <Txt variant="caption" color={t.c.onHero} style={{ fontWeight: "500" }}>{allSelected ? "Clear" : "Select all"}</Txt>
        </Pressable>
      </View>
    </View>
  );
}

export type BulkAction = "category" | "account" | "date" | "void";

const ACTIONS: { id: BulkAction; label: string; icon: IconName }[] = [
  { id: "category", label: "Category", icon: "receipt" },
  { id: "account", label: "Account", icon: "landmark" },
  { id: "date", label: "Date", icon: "calendar" },
  { id: "void", label: "Void", icon: "trash-2" },
];

/** The slim navy bar that floats where the tab bar was while rows are selected. */
export function BulkActionBar({ disabled, busy, bottomInset, onAction }: { disabled: boolean; busy: boolean; bottomInset: number; onAction: (action: BulkAction) => void }) {
  const t = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: bottomInset + t.space.space3, alignItems: "center", paddingHorizontal: t.space.space3 }}>
      <View
        style={{
          width: "100%",
          maxWidth: 520,
          flexDirection: "row",
          paddingVertical: t.space.space2,
          borderRadius: t.radius.radiusLg,
          backgroundColor: t.c.hero,
          opacity: disabled ? 0.6 : 1,
          shadowColor: "#0d111c",
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        {ACTIONS.map((a) => {
          const danger = a.id === "void";
          const color = danger ? "#F5C4B3" : t.c.onHero;
          return (
            <View key={a.id} style={{ flex: 1 }}>
              <SpringPressable
                onPress={disabled || busy ? undefined : () => onAction(a.id)}
                disabled={disabled || busy}
                accessibilityRole="button"
                accessibilityLabel={danger ? "Void selected" : `Change ${a.label.toLowerCase()} of selected`}
                accessibilityState={{ disabled: disabled || busy }}
                style={{ alignItems: "center", gap: 2, paddingVertical: 4 }}
              >
                <Icon name={a.icon} size={20} color={color} />
                <Txt variant="caption" color={color} style={{ fontSize: 11 }}>{a.label}</Txt>
              </SpringPressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Desktop select mode: the details panel becomes the actions for everything checked. */
export function BulkPanel({ count, total, busy, onAction, onCancel }: { count: number; total: number; busy: boolean; onAction: (action: BulkAction) => void; onCancel: () => void }) {
  const t = useTheme();
  const sign = total < 0 ? "−" : total > 0 ? "+" : "";
  return (
    <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, padding: t.space.space5, gap: t.space.space4 }}>
      <View style={{ gap: 2 }} accessibilityLiveRegion="polite">
        <Txt variant="titleMd" accessibilityRole="header">{count === 0 ? "Select transactions" : `${count} selected`}</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted}>{count === 0 ? "Click rows in the table to choose them." : `${sign}${formatMoney(Math.abs(total))} in total`}</Txt>
      </View>
      <View style={{ gap: t.space.space2 }}>
        {ACTIONS.map((a) => (
          <Button
            key={a.id}
            variant={a.id === "void" ? "destructive" : "secondary"}
            fullWidth
            icon={a.icon}
            disabled={count === 0 || busy}
            onPress={() => onAction(a.id)}
          >
            {a.id === "void" ? "Void selected" : `Change ${a.label.toLowerCase()}`}
          </Button>
        ))}
      </View>
      <Button variant="tertiary" fullWidth onPress={onCancel}>Done selecting</Button>
    </View>
  );
}

export interface PickOption {
  id: string;
  label: string;
  category?: string;
}

/** Pick one category or account for every selected row. */
export function PickSheet({ title, open, options, onClose, onPick }: { title: string; open: boolean; options: PickOption[]; onClose: () => void; onPick: (id: string) => void }) {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Sheet title={title} open={open} onClose={onClose}>
      <View style={{ gap: t.space.space3 }}>
        {options.length > 8 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surfaceAlt }}>
            <Icon name="search" size={16} color={t.c.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Find"
              placeholderTextColor={t.c.inkMuted}
              accessibilityLabel={`Find ${title.toLowerCase()}`}
              style={[t.text("bodySm"), { flex: 1, color: t.c.ink, paddingVertical: 0 }]}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2 }}>
          {shown.map((o) => (
            <Chip key={o.id} category={o.category} role="radio" onPress={() => onPick(o.id)}>
              {o.label}
            </Chip>
          ))}
          {shown.length === 0 ? <Txt variant="bodySm" color={t.c.inkMuted}>Nothing matches.</Txt> : null}
        </View>
      </View>
    </Sheet>
  );
}

export function DateSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (isoDate: string) => void }) {
  const [value, setValue] = useState<string | undefined>();
  return (
    <Sheet title="Move to date" open={open} onClose={onClose} footer={<Button fullWidth disabled={!value} onPress={() => value && onPick(value)}>Move here</Button>}>
      <DatePicker label="New date" value={value} onChange={setValue} noFuture />
    </Sheet>
  );
}

/**
 * A dropdown that allows several choices. It opens inline (a list under the field) rather than in a second sheet,
 * because it lives inside the filter sheet.
 */
export function MultiSelectDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: PickOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const names = options.filter((o) => value.includes(o.id)).map((o) => o.label);
  const summary = names.length === 0 ? placeholder : names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const shown = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <View style={{ gap: t.space.space2 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="combobox"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${names.length ? names.join(", ") : placeholder}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 44,
          paddingHorizontal: 12,
          borderRadius: t.radius.radiusMd,
          borderWidth: 1,
          borderColor: open ? t.c.primary : t.c.border,
          backgroundColor: t.c.surface,
        }}
      >
        <Txt variant="bodySm" color={names.length ? t.c.ink : t.c.inkMuted} numberOfLines={1} style={{ flex: 1 }}>{summary}</Txt>
        {names.length ? (
          <Pressable onPress={() => onChange([])} accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} hitSlop={8}>
            <Icon name="x" size={16} color={t.c.inkMuted} />
          </Pressable>
        ) : null}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={t.c.inkMuted} />
      </Pressable>
      {open ? (
        <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, backgroundColor: t.c.surface, overflow: "hidden" }}>
          {options.length > 8 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.c.border }}>
              <Icon name="search" size={16} color={t.c.inkMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Find a ${label.toLowerCase()}`}
                placeholderTextColor={t.c.inkMuted}
                accessibilityLabel={`Find a ${label.toLowerCase()}`}
                style={[t.text("bodySm"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {shown.map((o, i) => {
              const on = value.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => toggle(o.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderBottomWidth: i < shown.length - 1 ? 1 : 0,
                    borderBottomColor: t.c.border,
                    backgroundColor: on ? t.c.primarySoft : "transparent",
                  }}
                >
                  {o.category ? <CategoryIcon category={o.category} size="sm" round /> : null}
                  <Txt variant="bodySm" color={on ? t.c.onPrimarySoft : t.c.ink} numberOfLines={1} style={{ flex: 1, fontWeight: on ? "600" : "400" }}>{o.label}</Txt>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: on ? 0 : 1.5,
                      borderColor: t.c.borderStrong,
                      backgroundColor: on ? t.c.primary : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on ? <Icon name="check" size={14} color={t.c.onPrimary} /> : null}
                  </View>
                </Pressable>
              );
            })}
            {shown.length === 0 ? (
              <Txt variant="bodySm" color={t.c.inkMuted} style={{ padding: 12 }}>Nothing matches.</Txt>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function amountOrNull(text: string): number | null {
  const clean = cleanAmount(text);
  return clean ? Number(clean) : null;
}

/** Filters the search card doesn't already cover: category, account and amount. Live result count on the button. */
export function FilterSheet({
  open,
  value,
  categories,
  accounts,
  countFor,
  onClose,
  onApply,
}: {
  open: boolean;
  value: FeedFilters;
  categories: PickOption[];
  accounts: PickOption[];
  countFor: (filters: FeedFilters) => number;
  onClose: () => void;
  onApply: (filters: FeedFilters) => void;
}) {
  const t = useTheme();
  const [draft, setDraft] = useState<FeedFilters>(value);
  const [minText, setMinText] = useState(value.min != null ? String(value.min) : "");
  const [maxText, setMaxText] = useState(value.max != null ? String(value.max) : "");
  const next = { ...draft, min: amountOrNull(minText), max: amountOrNull(maxText) };
  const count = countFor(next);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const label = (text: string) => <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600" }}>{text}</Txt>;
  const field = (text: string, set: (v: string) => void, placeholder: string) => (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border }}>
      <Txt variant="bodySm" color={t.c.inkMuted}>₦</Txt>
      <TextInput
        value={text}
        onChangeText={(v) => set(cleanAmount(v))}
        placeholder={placeholder}
        placeholderTextColor={t.c.inkMuted}
        keyboardType="decimal-pad"
        accessibilityLabel={`${placeholder} amount`}
        style={[t.text("bodySm"), { flex: 1, color: t.c.ink, paddingVertical: 0, minWidth: 0 }]}
      />
    </View>
  );
  return (
    <Sheet
      title="Filters"
      open={open}
      onClose={onClose}
      footer={
        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
          <Button
            variant="secondary"
            onPress={() => {
              setDraft(NO_FILTERS);
              setMinText("");
              setMaxText("");
            }}
          >
            Clear
          </Button>
          <View style={{ flex: 1 }}>
            <Button fullWidth onPress={() => onApply(next)}>{count === 1 ? "Show 1 result" : `Show ${count} results`}</Button>
          </View>
        </View>
      }
    >
      <View style={{ gap: t.space.space4 }}>
        {categories.length > 0 ? (
          <View style={{ gap: t.space.space2 }}>
            {label("Category")}
            <MultiSelectDropdown
              label="Category"
              placeholder="All categories"
              options={categories}
              value={draft.categoryIds}
              onChange={(categoryIds) => setDraft((d) => ({ ...d, categoryIds }))}
            />
          </View>
        ) : null}
        {accounts.length > 1 ? (
          <View style={{ gap: t.space.space2 }}>
            {label("Account")}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2 }}>
              {accounts.map((a) => (
                <Chip key={a.id} selected={draft.accountIds.includes(a.id)} onPress={() => setDraft((d) => ({ ...d, accountIds: toggle(d.accountIds, a.id) }))}>
                  {a.label}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ gap: t.space.space2 }}>
          {label("Amount")}
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
            {field(minText, setMinText, "Min")}
            <Txt color={t.c.inkMuted}>–</Txt>
            {field(maxText, setMaxText, "Max")}
          </View>
        </View>
      </View>
    </Sheet>
  );
}

/** Removable chips for the filters in force, under the search card. */
export function ActiveFilters({
  value,
  categoryNames,
  accountNames,
  onChange,
}: {
  value: FeedFilters;
  categoryNames: Record<string, string>;
  accountNames: Record<string, string>;
  onChange: (next: FeedFilters) => void;
}) {
  const t = useTheme();
  if (activeFilterCount(value) === 0) return null;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...value.categoryIds.map((id) => ({ key: `c-${id}`, label: categoryNames[id] ?? "Category", remove: () => onChange({ ...value, categoryIds: value.categoryIds.filter((x) => x !== id) }) })),
    ...value.accountIds.map((id) => ({ key: `a-${id}`, label: accountNames[id] ?? "Account", remove: () => onChange({ ...value, accountIds: value.accountIds.filter((x) => x !== id) }) })),
  ];
  if (value.min != null || value.max != null) {
    const text = value.min != null && value.max != null ? `${formatMoney(value.min)} – ${formatMoney(value.max)}` : value.min != null ? `Over ${formatMoney(value.min)}` : `Under ${formatMoney(value.max ?? 0)}`;
    chips.push({ key: "amount", label: text.replace(/\.00/g, ""), remove: () => onChange({ ...value, min: null, max: null }) });
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space2, alignItems: "center" }}>
      {chips.map((c) => (
        <Pressable
          key={c.key}
          onPress={c.remove}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${c.label}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 28, paddingLeft: 10, paddingRight: 8, borderRadius: 999, backgroundColor: t.c.primarySoft }}
        >
          <Txt variant="caption" color={t.c.onPrimarySoft} style={{ fontWeight: "500" }}>{c.label}</Txt>
          <Icon name="x" size={12} color={t.c.onPrimarySoft} />
        </Pressable>
      ))}
      <Pressable onPress={() => onChange(NO_FILTERS)} accessibilityRole="button" hitSlop={6}>
        <Txt variant="caption" color={t.c.primary} style={{ fontWeight: "600" }}>Clear all</Txt>
      </Pressable>
    </View>
  );
}

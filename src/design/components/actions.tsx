/* Actions: Button, IconButton, SegmentedControl, Tabs, Chip, ChipGroup, FilterButton. */
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextStyle, View } from 'react-native';
import { useTheme } from "@/design/theme";
import { a11yState } from "@/design/a11y";
import { SpringPressable } from "@/design/motion";
import { IconName } from "@/design/icons";
import { CategoryIcon, Icon } from "@/design/components/foundations";

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName; iconRight?: IconName;
  loading?: boolean; disabled?: boolean; fullWidth?: boolean;
  /** Shown under a disabled button when the reason isn't obvious. */
  disabledReason?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}
/** A pill button. One primary per screen. Labels are verbs. */
export function Button({ variant = 'primary', size = 'md', icon, iconRight, loading = false, disabled, fullWidth, disabledReason, onPress, children }: ButtonProps) {
  const t = useTheme();
  const h = size === 'lg' ? t.size.controlLg : size === 'sm' ? t.size.controlSm : t.size.controlMd;
  const pal = {
    primary: { bg: t.c.primary, fg: t.c.onPrimary, border: 'transparent', hover: t.c.primaryHover },
    secondary: { bg: t.c.surface, fg: t.c.ink, border: t.c.borderStrong, hover: t.c.surfaceAlt },
    tertiary: { bg: 'transparent', fg: t.c.primary, border: 'transparent', hover: t.c.surfaceAlt },
    destructive: { bg: t.c.danger, fg: t.c.surface, border: 'transparent', hover: t.c.danger },
  }[variant];
  const off = disabled || loading;
  const why = disabled && disabledReason ? disabledReason : undefined;
  const button = (
    <SpringPressable
      onPress={off ? undefined : onPress} disabled={off} hapticOn={variant === 'primary' ? 'start' : undefined}
      accessibilityRole="button" {...a11yState({ disabled: !!off, busy: !!loading })} accessibilityHint={why}
      hitSlop={h < 44 ? (44 - h) / 2 : 0}
      hoverStyle={off ? undefined : { backgroundColor: pal.hover }}
      style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start', minHeight: h, paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 24 : 20, borderRadius: t.radius.radiusSm,
        backgroundColor: pal.bg, borderWidth: 1, borderColor: pal.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off && !loading ? 0.5 : 1 }}
    >
      {loading ? <ActivityIndicator size="small" color={pal.fg} /> : icon ? <Icon name={icon} size={18} color={pal.fg} /> : null}
      <Text style={[t.text('titleSm'), { color: pal.fg, fontSize: size === 'sm' ? 13 : 15, fontWeight: '500' }, Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as TextStyle) : null]}>{children}</Text>
      {iconRight && !loading ? <Icon name={iconRight} size={18} color={pal.fg} /> : null}
    </SpringPressable>
  );
  if (!why) return button;
  return (
    <View style={{ gap: 6, alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
      {button}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} importantForAccessibility="no-hide-descendants">
        <Icon name="info" size={14} color={t.c.inkMuted} />
        <Text style={[t.text('caption'), { color: t.c.inkMuted }]}>{why}</Text>
      </View>
    </View>
  );
}

export interface IconButtonProps { icon: IconName; label: string; variant?: 'ghost' | 'filled'; badge?: string | number; onPress?: () => void; color?: string }
export function IconButton({ icon, label, variant = 'ghost', badge, onPress, color }: IconButtonProps) {
  const t = useTheme();
  return (
    <SpringPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hapticOn="select"
      style={{ width: t.size.touchTarget, height: t.size.touchTarget, borderRadius: t.radius.radiusSm, alignItems: 'center', justifyContent: 'center', backgroundColor: variant === 'filled' ? t.c.primarySoft : 'transparent' }}>
      <Icon name={icon} size={20} color={color ?? (variant === 'filled' ? t.c.onPrimarySoft : t.c.ink)} />
      {badge != null ? (
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: t.c.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.c.surface, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
        </View>
      ) : null}
    </SpringPressable>
  );
}

function useControlled<T>(value: T | undefined, def: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [s, set] = useState<T>(def);
  const cur = value !== undefined ? value : s;
  return [cur, (v: T) => { if (value === undefined) set(v); onChange?.(v); }];
}

export interface Option { value: string; label: string }
export interface SegmentedControlProps { label: string; options: Option[]; value?: string; defaultValue?: string; onChange?: (v: string) => void }
export function SegmentedControl({ label, options, value, defaultValue, onChange }: SegmentedControlProps) {
  const t = useTheme();
  const [cur, set] = useControlled(value, defaultValue ?? options[0]?.value, onChange);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, gap: 2, borderRadius: 999, backgroundColor: t.c.surfaceAlt }}>
      {options.map((o) => {
        const on = o.value === cur;
        return (
          <SpringPressable key={o.value} onPress={() => set(o.value)} hapticOn="select" accessibilityRole="radio" {...a11yState({ checked: on })}
            hitSlop={6} style={{ flexGrow: 1, minHeight: 32, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.surface : 'transparent' }}>
            <Text style={[t.text('label'), { color: on ? t.c.ink : t.c.inkMuted, fontWeight: on ? '600' : '500' }, Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as TextStyle) : null]}>{o.label}</Text>
          </SpringPressable>
        );
      })}
    </View>
  );
}

export interface TabsProps { label: string; tabs: (Option & { count?: number })[]; value?: string; defaultValue?: string; onChange?: (v: string) => void }
export function Tabs({ label, tabs, value, defaultValue, onChange }: TabsProps) {
  const t = useTheme();
  const [cur, set] = useControlled(value, defaultValue ?? tabs[0]?.value, onChange);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label}
      style={{ borderBottomWidth: 1, borderBottomColor: t.c.border, flexGrow: 0 }}>
      {tabs.map((o) => {
        const on = o.value === cur;
        return (
          <Pressable key={o.value} onPress={() => set(o.value)} accessibilityRole="tab" {...a11yState({ selected: on })}
            style={({ pressed }) => ({ backgroundColor: pressed ? t.c.surfaceAlt : 'transparent', height: t.size.touchTarget, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: on ? t.c.primary : 'transparent' })}>
            <Text style={[t.text('label'), { fontSize: 14, color: on ? t.c.ink : t.c.inkMuted, fontWeight: on ? '600' : '500' }]}>{o.label}</Text>
            {o.count != null ? <Text style={[t.text('caption'), { color: on ? t.c.ink : t.c.inkMuted, backgroundColor: t.c.surfaceAlt, paddingHorizontal: 6, borderRadius: 999, overflow: 'hidden', fontVariant: ['tabular-nums'] }]}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export interface ChipProps { selected?: boolean; onPress?: () => void; icon?: IconName; category?: string; count?: number; disabled?: boolean; children?: React.ReactNode;
  /** 'radio' inside a single-choice group: no check mark. Default 'toggle' shows a check when on. */
  role?: 'toggle' | 'radio' }
export function Chip({ selected, onPress, icon, category, count, disabled, children, role = 'toggle' }: ChipProps) {
  const t = useTheme();
  return (
    <SpringPressable onPress={onPress} disabled={disabled} hapticOn="select" hitSlop={2}
      accessibilityRole={role === 'radio' ? 'radio' : Platform.OS === 'web' ? 'button' : 'togglebutton'}
      {...(role === 'radio' || Platform.OS !== 'web' ? a11yState({ checked: !!selected, disabled: !!disabled }) : { ...a11yState({ disabled: !!disabled }), 'aria-pressed': !!selected })}
      style={{ opacity: disabled ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingLeft: category ? 6 : 16, paddingRight: category ? 12 : 16, borderRadius: 999,
        borderWidth: selected ? 2 : 1, borderColor: selected ? t.c.primary : t.c.borderStrong, backgroundColor: selected ? t.c.primarySoft : t.c.surface }}>
      {category ? <CategoryIcon category={category} size="sm" round /> : icon ? <Icon name={icon} size={16} color={selected ? t.c.onPrimarySoft : t.c.ink} /> : null}
      <Text style={[t.text('label'), { color: selected ? t.c.onPrimarySoft : t.c.ink, fontWeight: selected ? '600' : '500' }, Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as TextStyle) : null]}>{children ?? category}</Text>
      {count != null ? <Text style={[t.text('caption'), { color: t.c.inkMuted, fontVariant: ['tabular-nums'] }]}>{count}</Text> : null}
      {selected && role !== 'radio' ? <Icon name="check" size={16} color={t.c.onPrimarySoft} /> : null}
    </SpringPressable>
  );
}

export interface ChipGroupProps { label: string; options: { value: string; label?: string; category?: string; icon?: IconName; count?: number }[]; multiple?: boolean; value?: string | string[]; defaultValue?: string | string[]; onChange?: (v: any) => void; scroll?: boolean }
export function ChipGroup({ label, options, multiple, value, defaultValue, onChange, scroll }: ChipGroupProps) {
  const [cur, set] = useControlled<any>(value, defaultValue ?? (multiple ? [] : options[0]?.value), onChange);
  const chips = options.map((o) => {
    const on = multiple ? (cur as string[]).includes(o.value) : cur === o.value;
    return (
      <Chip key={o.value} selected={on} role={multiple ? 'toggle' : 'radio'} category={o.category} icon={o.icon} count={o.count}
        onPress={() => set(multiple ? (on ? (cur as string[]).filter((x) => x !== o.value) : [...(cur as string[]), o.value]) : o.value)}>{o.label}</Chip>
    );
  });
  return scroll
    ? <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label} contentContainerStyle={{ gap: 8 }}>{chips}</ScrollView>
    : <View accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
}

export function FilterButton({ count = 0, label = 'Filters', onPress }: { count?: number; label?: string; onPress?: () => void }) {
  const t = useTheme();
  const on = count > 0;
  return (
    <SpringPressable onPress={onPress} hapticOn="select" hitSlop={2} accessibilityRole="button" accessibilityLabel={label + (on ? `, ${count} on` : '')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: t.radius.radiusSm, borderWidth: 1,
        borderColor: on ? t.c.ink : t.c.borderStrong, backgroundColor: t.c.surface }}>
      <Icon name="list-filter" size={18} color={t.c.ink} />
      <Text style={[t.text('titleSm'), { fontSize: 14, color: t.c.ink }]}>{label}</Text>
      {on ? <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999, backgroundColor: t.c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.c.onPrimary, fontSize: 11, fontWeight: '700' }}>{count}</Text></View> : null}
    </SpringPressable>
  );
}

/* Navigation: BottomNav (phones), NavRail (tablets), Sidebar (desktop and large tablets). */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from "@/design/theme";
import { SpringPressable } from "@/design/motion";
import { IconName } from "@/design/icons";
import { Icon, Logo, Txt } from "@/design/components/foundations";

export type Destination = 'home' | 'transactions' | 'plan' | 'accounts' | 'more';
export const NAV: [Destination, string, IconName][] = [['home', 'Home', 'house'], ['transactions', 'Transactions', 'arrow-left-right'], ['plan', 'Plan', 'target'], ['accounts', 'Accounts', 'wallet'], ['more', 'More', 'ellipsis']];

export interface BottomNavProps { active?: string; onNavigate?: (id: string) => void; onAdd?: () => void; addLabel?: string; items?: [string, string, IconName][] }
/** Floating bar with the raised + in the middle. Sits above the gesture bar / home indicator. */
export function BottomNav({ active = 'home', onNavigate, onAdd, addLabel = 'Add transaction', items }: BottomNavProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const list = items ?? (onAdd ? NAV.slice(0, 4) : NAV);
  const dense = list.length > 4;
  const tab = ([id, label, icon]: [string, string, IconName]) => {
    const on = id === active;
    return (
      <Pressable key={id} onPress={() => onNavigate?.(id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 }}>
        <View style={{ width: dense ? 44 : 56, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.primarySoft : 'transparent' }}>
          <Icon name={icon} size={22} color={on ? t.c.onPrimarySoft : t.c.inkMuted} />
        </View>
        <Text numberOfLines={1} style={[t.text('caption'), { fontSize: dense ? 10 : 11, color: on ? t.c.ink : t.c.inkMuted, fontWeight: on ? '600' : '500' }]}>{label}</Text>
      </Pressable>
    );
  };
  const kids = list.map(tab);
  if (onAdd) kids.splice(Math.floor(list.length / 2), 0, (
    <View key="add" style={{ flex: 1, alignItems: 'center' }}>
      <SpringPressable onPress={onAdd} hapticOn="start" depth={0.9} accessibilityRole="button" accessibilityLabel={addLabel}
        style={{ width: dense ? 52 : 56, height: dense ? 52 : 56, marginTop: -28, borderRadius: 999, backgroundColor: t.c.primary, borderWidth: 4, borderColor: t.c.bg, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Icon name="plus" size={26} color={t.c.onPrimary} strokeWidth={2.5} />
      </SpringPressable>
    </View>
  ));
  return onAdd ? (
    <View style={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'center', height: 68, paddingHorizontal: 8, borderRadius: t.radius.radiusXl, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.borderStrong,
        shadowColor: '#131a2b', shadowOpacity: t.scheme === 'dark' ? 0.5 : 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>{kids}</View>
    </View>
  ) : (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: t.size.navBottom + insets.bottom, paddingBottom: insets.bottom, backgroundColor: t.c.surface, borderTopWidth: 1, borderTopColor: t.c.borderStrong }}>{kids}</View>
  );
}

export interface NavRailProps { active?: string; onNavigate?: (id: string) => void; fab?: { label: string; icon?: IconName; onPress?: () => void } }
/** Tablets (600–1199 wide). Same destinations as BottomNav. */
export function NavRail({ active = 'home', onNavigate, fab }: NavRailProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: t.size.navRail, alignItems: 'center', gap: 12, paddingTop: 16 + insets.top, backgroundColor: t.c.surface, borderRightWidth: 1, borderRightColor: t.c.borderStrong }}>
      {fab ? (
        <SpringPressable onPress={fab.onPress} hapticOn="start" accessibilityRole="button" accessibilityLabel={fab.label}
          style={{ width: 56, height: 56, marginBottom: 12, borderRadius: t.radius.radiusLg, backgroundColor: t.c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={fab.icon ?? 'plus'} size={22} color={t.c.onPrimary} />
        </SpringPressable>
      ) : null}
      {NAV.filter(([id]) => id !== "more").map(([id, label, icon]) => {
        const on = id === active;
        return (
          <Pressable key={id} onPress={() => onNavigate?.(id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ alignItems: 'center', gap: 4, width: '100%' }}>
            <View style={{ width: 56, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.primarySoft : 'transparent' }}>
              <Icon name={icon} size={22} color={on ? t.c.onPrimarySoft : t.c.inkMuted} />
            </View>
            <Txt variant="caption" color={on ? t.c.ink : t.c.inkMuted} style={{ fontWeight: on ? '600' : '500' }}>{label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export const SIDE: [string, string, IconName][] = [...NAV.slice(0, 4), ['reports', 'Reports', 'chart-pie'], ['bills', 'Bills', 'receipt'], ['savings', 'Savings', 'piggy-bank'], ['settings', 'Settings', 'settings']];
export interface SidebarProps { active?: string; workspace?: string; items?: [string, string, IconName][]; onNavigate?: (id: string) => void; onWorkspace?: () => void; footer?: React.ReactNode }
/** Large screens (1200+). */
export function Sidebar({ active = 'home', workspace, items = SIDE, onNavigate, onWorkspace, footer }: SidebarProps) {
  const t = useTheme();
  return (
    <ScrollView style={{ width: t.size.navSidebar, flexGrow: 0, backgroundColor: t.c.surface, borderRightWidth: 1, borderRightColor: t.c.borderStrong }} contentContainerStyle={{ padding: 12, paddingTop: 20, gap: 16 }}>
      <View style={{ paddingHorizontal: 12 }}><Logo size={28} /></View>
      {workspace ? (
        <Pressable onPress={onWorkspace} accessibilityRole="button" accessibilityLabel={`Workspace: ${workspace}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.borderStrong }}>
          <View><Txt variant="caption" color={t.c.inkMuted}>Workspace</Txt><Txt variant="label" style={{ fontWeight: '600' }}>{workspace}</Txt></View>
          <Icon name="chevron-down" size={16} color={t.c.inkMuted} />
        </Pressable>
      ) : null}
      <View style={{ gap: 2 }}>
        {items.map(([id, label, icon]) => {
          const on = id === active;
          return (
            <Pressable key={id} onPress={() => onNavigate?.(id)} accessibilityRole="link" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? t.c.primarySoft : 'transparent' }}>
              <Icon name={icon} size={20} color={on ? t.c.onPrimarySoft : t.c.inkMuted} />
              <Txt variant="label" color={on ? t.c.onPrimarySoft : t.c.ink} style={{ fontSize: 14, fontWeight: on ? '600' : '500' }}>{label}</Txt>
            </Pressable>
          );
        })}
      </View>
      {footer}
    </ScrollView>
  );
}

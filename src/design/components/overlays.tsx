import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { t, type TextKey } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { useSizeClass } from '../size';
import { Button } from './Button';
import type { Option } from './controls';
import { Text } from './Text';

const sp = tokens.spacing;
const r = tokens.radius;
const backdrop = `${tokens.color['brand-dark-900']}73`;

/** Quick detail of one item: a full-screen sheet on phones and tablets, a right-side panel from 1024 (DESIGN.md 4). */
export function Panel({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  const size = useSizeClass();
  const side = size === 'desktop' || size === 'wide';
  return (
    <Modal visible={visible} transparent={side} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        {side ? <Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={{ flex: 1 }} /> : null}
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            width: side ? (size === 'wide' ? 480 : 420) : '100%',
            backgroundColor: theme.card,
            borderLeftWidth: side ? 1 : 0,
            borderColor: theme.border,
            borderTopLeftRadius: side ? r['rounded-xl'] : 0,
            borderBottomLeftRadius: side ? r['rounded-xl'] : 0,
            boxShadow: tokens.elevation['elevation-2'],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], padding: sp['spacing-lg'], borderBottomWidth: 1, borderColor: theme.border }}>
            {side ? null : (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
                <ChevronLeft size={18} color={theme.textSecondary} />
              </Pressable>
            )}
            <Text variant="heading-md" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </Text>
            {side ? <Button kind="link" accessibilityRole="button" label={t('common.close')} onPress={onClose} /> : null}
          </View>
          <ScrollView contentContainerStyle={{ padding: sp['spacing-xl'], gap: sp['spacing-lg'] }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Quick edits: a small sheet on phones, an anchored card elsewhere. */
export function Popover({ visible, onClose, children, testID }: { visible: boolean; onClose: () => void; children: ReactNode; testID?: string }) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  if (!visible) return null;
  const card = (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.card,
        borderRadius: phone ? r['rounded-xl'] : r['rounded-md'],
        borderWidth: 1,
        borderColor: theme.border,
        padding: sp['spacing-md'],
        gap: sp['spacing-sm'],
        boxShadow: tokens.elevation['elevation-2'],
        minWidth: 240,
      }}
    >
      {children}
    </View>
  );
  if (phone) {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: backdrop }}>
          <Pressable accessibilityLabel={t('common.close')} onPress={onClose} style={{ flex: 1 }} />
          {card}
        </View>
      </Modal>
    );
  }
  return <View style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: sp['spacing-xs'] }}>{card}</View>;
}

export type MenuItem = { key: string; label: string; onPress: () => void };

/** The ⋯ menu: an action sheet on phones, a dropdown elsewhere. */
export function Menu({ trigger, items, testID }: { trigger: (open: () => void) => ReactNode; items: MenuItem[]; testID?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: 'relative' }}>
      {trigger(() => setOpen(true))}
      <Popover visible={open} onClose={() => setOpen(false)} testID={testID}>
        <View accessibilityRole="menu">
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
              onPress={() => {
                setOpen(false);
                item.onPress();
              }}
              style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: sp['spacing-sm'], borderRadius: r['rounded-xs'], backgroundColor: pressed ? theme.hover : undefined })}
            >
              <Text>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Popover>
    </View>
  );
}

/** A picker for one value from a list, opened from a field-shaped button. */
export function Select<T extends string>({ label, options, value, onChange, testID }: { label: string; options: Option<T>[]; value: T | null; onChange: (v: T) => void; testID?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: sp['spacing-xs'], position: 'relative' }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label ?? '' }}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.inputBorder, borderRadius: r['rounded-sm'], paddingHorizontal: sp['spacing-md'], backgroundColor: theme.card }}
      >
        <Text>{current?.label ?? ''}</Text>
        <ChevronDown size={16} color={theme.textSecondary} />
      </Pressable>
      <Popover visible={open} onClose={() => setOpen(false)}>
        <View accessibilityRole="list">
          {options.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: o.value === value }}
              accessibilityLabel={o.label}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: sp['spacing-sm'], borderRadius: r['rounded-xs'], backgroundColor: o.value === value ? theme.tagFill : undefined }}
            >
              <Text style={o.value === value ? { color: theme.tagText } : undefined}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </Popover>
    </View>
  );
}

const monthName = (m: number) => t(`date.month.${m}` as TextKey);

/** "27 Oct 2026" from "2026-10-27" (DESIGN.md 2.12). Days are strings, never Date objects in data. */
export function formatDay(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  return t('date.day', { d, month: monthName(mo), y });
}

function iso(y: number, mo: number, d: number) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysIn(y: number, mo: number) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Picks a YYYY-MM-DD day. The week starts on the workspace's first day (0 Sunday, 1 Monday, 6 Saturday). */
export function DatePicker({ label, value, onChange, weekStartsOn = 1, testID }: { label: string; value: string; onChange: (v: string) => void; weekStartsOn?: 0 | 1 | 6; testID?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [vy, vm] = value.split('-').map(Number) as [number, number];
  const [view, setView] = useState({ y: vy, m: vm });
  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const lead = (first - weekStartsOn + 7) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  const shift = (delta: number) => setView(({ y, m }) => ({ y: y + Math.floor((m - 1 + delta) / 12), m: ((((m - 1 + delta) % 12) + 12) % 12) + 1 }));

  return (
    <View style={{ gap: sp['spacing-xs'], position: 'relative' }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDay(value)}`}
        onPress={() => {
          setView({ y: vy, m: vm });
          setOpen(true);
        }}
        style={{ minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: theme.inputBorder, borderRadius: r['rounded-sm'], paddingHorizontal: sp['spacing-md'], backgroundColor: theme.card }}
      >
        <Text style={{ fontVariant: ['tabular-nums'] }}>{formatDay(value)}</Text>
      </Pressable>
      <Popover visible={open} onClose={() => setOpen(false)} testID={testID ? `${testID}-calendar` : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('date.previousMonth')} onPress={() => shift(-1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={16} color={theme.textSecondary} />
          </Pressable>
          <Text variant="button-sm" testID={testID ? `${testID}-month` : undefined}>
            {t('date.monthYear', { month: monthName(view.m), y: view.y })}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('date.nextMonth')} onPress={() => shift(1)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 7 * 40 }}>
          {cells.map((d, i) => {
            if (d === null) return <View key={`e${i}`} style={{ width: 40, height: 40 }} />;
            const day = iso(view.y, view.m, d);
            const selected = day === value;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={formatDay(day)}
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(day);
                  setOpen(false);
                }}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: selected ? theme.primaryFill : undefined }}
              >
                <Text variant="caption" style={{ color: selected ? theme.onPrimaryFill : theme.text }}>
                  {String(d)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Popover>
    </View>
  );
}

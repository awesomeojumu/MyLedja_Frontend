import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, TextInput as RNTextInput, useWindowDimensions, View } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { t, type TextKey } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { useSizeClass } from '../size';
import { Button } from './Button';
import type { Option } from './controls';
import { dateFieldError, todayIso, yesterdayIso } from './fieldKinds';
import { PillTag } from './primitives';
import { Text, typeStyle } from './Text';

const sp = tokens.spacing;
const r = tokens.radius;
const backdrop = `${tokens.color['brand-dark-900']}73`;

/** Quick detail of one item: sheet on phone / tablet portrait; right-side panel on tablet landscape + desktop (DESIGN.md 4 / D10). */
export function Panel({
  visible,
  title,
  onClose,
  children,
  testID,
  width = 440,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
  /** Side-panel width on desktop (PU-18: 440). */
  width?: number;
}) {
  const theme = useTheme();
  const size = useSizeClass();
  const { width: winW, height: winH } = useWindowDimensions();
  const tabletLandscape = size === 'tablet' && winW > winH;
  const side = size === 'desktop' || size === 'wide' || tabletLandscape;
  return (
    <Modal visible={visible} transparent={side} animationType="slide" onRequestClose={onClose} aria-label={title}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        {side ? <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={{ flex: 1 }} /> : null}
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            width: side ? width : '100%',
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
      <Modal visible transparent animationType="slide" onRequestClose={onClose} aria-label={t('common.options')}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: backdrop }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} style={{ flex: 1 }} />
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

/** A picker for one value from a list, opened from a field-shaped button (addendum §1.1 Picker). */
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  error,
  addNewLabel,
  onAddNew,
  searchable,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  testID?: string;
  error?: string | null;
  /** "+ Add new" at the bottom when the thing can be created. */
  addNewLabel?: string;
  onAddNew?: () => void;
  /** Search field in the list (web dropdown / phone sheet). Defaults on when there are 8+ options. */
  searchable?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length >= 8;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  return (
    <View style={{ gap: sp['spacing-xs'], position: 'relative' }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={current ? `${label}, ${current.label}` : label}
        accessibilityState={{ expanded: open }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={!!error}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: error ? theme.error : theme.inputBorder,
          borderRadius: r['rounded-sm'],
          paddingHorizontal: sp['spacing-md'],
          backgroundColor: theme.card,
        }}
      >
        <Text>{current?.label ?? ''}</Text>
        <ChevronDown size={16} color={theme.textSecondary} />
      </Pressable>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" testID={`${testID ?? 'field'}-error`}>
          {error}
        </Text>
      ) : null}
      <Popover visible={open} onClose={close}>
        <View accessibilityRole="list" style={{ gap: sp['spacing-xs'], maxHeight: 320 }}>
          {showSearch ? (
            <RNTextInput
              testID={testID ? `${testID}-search` : 'select-search'}
              accessibilityLabel={t('fields.search')}
              value={query}
              onChangeText={setQuery}
              placeholder={t('fields.search')}
              placeholderTextColor={theme.textHelper}
              style={[
                typeStyle('body-md'),
                {
                  minHeight: 40,
                  borderWidth: 1,
                  borderColor: theme.inputBorder,
                  borderRadius: r['rounded-sm'],
                  paddingHorizontal: sp['spacing-sm'],
                  color: theme.text,
                  backgroundColor: theme.card,
                },
              ]}
            />
          ) : null}
          <ScrollView style={{ maxHeight: 260 }}>
            {filtered.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: o.value === value }}
                aria-checked={o.value === value}
                accessibilityLabel={o.label}
                onPress={() => {
                  onChange(o.value);
                  close();
                }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: sp['spacing-sm'], borderRadius: r['rounded-xs'], backgroundColor: o.value === value ? theme.tagFill : undefined }}
              >
                <Text style={o.value === value ? { color: theme.tagText } : undefined}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {addNewLabel && onAddNew ? (
            <Pressable
              testID={testID ? `${testID}-add-new` : 'select-add-new'}
              accessibilityRole="button"
              accessibilityLabel={addNewLabel}
              onPress={() => {
                close();
                onAddNew();
              }}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: sp['spacing-sm'] }}
            >
              <Text tone="link">{addNewLabel}</Text>
            </Pressable>
          ) : null}
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

/** Picks a YYYY-MM-DD day with Today / Yesterday / Pick chips (addendum §1.1 Date). */
export function DatePicker({
  label,
  value,
  onChange,
  weekStartsOn = 1,
  testID,
  allowFuture = false,
  showError = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  weekStartsOn?: 0 | 1 | 6;
  testID?: string;
  allowFuture?: boolean;
  showError?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const today = todayIso();
  const yesterday = yesterdayIso();
  const error = blurred || showError ? dateFieldError(value, { allowFuture, today }) : null;
  const [vy, vm] = value.split('-').map(Number) as [number, number];
  const [view, setView] = useState({ y: vy, m: vm });
  const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const lead = (first - weekStartsOn + 7) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  const shift = (delta: number) => setView(({ y, m }) => ({ y: y + Math.floor((m - 1 + delta) / 12), m: ((((m - 1 + delta) % 12) + 12) % 12) + 1 }));
  const pick = (day: string) => {
    onChange(day);
    setBlurred(true);
    setOpen(false);
  };

  return (
    <View style={{ gap: sp['spacing-xs'], position: 'relative' }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
        <PillTag testID={testID ? `${testID}-today` : undefined} label={t('date.today')} selected={value === today} onPress={() => pick(today)} />
        <PillTag testID={testID ? `${testID}-yesterday` : undefined} label={t('date.yesterday')} selected={value === yesterday} onPress={() => pick(yesterday)} />
        <PillTag
          testID={testID ? `${testID}-pick` : undefined}
          label={t('date.pick')}
          selected={value !== today && value !== yesterday}
          onPress={() => {
            setView({ y: vy, m: vm });
            setOpen(true);
          }}
        />
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDay(value)}`}
        onPress={() => {
          setView({ y: vy, m: vm });
          setOpen(true);
        }}
        style={{
          minHeight: 48,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: error ? theme.error : theme.inputBorder,
          borderRadius: r['rounded-sm'],
          paddingHorizontal: sp['spacing-md'],
          backgroundColor: theme.card,
        }}
      >
        <Text style={{ fontVariant: ['tabular-nums'] }}>{formatDay(value)}</Text>
      </Pressable>
      {error ? (
        <Text variant="caption" accessibilityRole="alert" testID={`${testID ?? 'date'}-error`}>
          {error}
        </Text>
      ) : null}
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
                onPress={() => pick(day)}
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

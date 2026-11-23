import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput as RNTextInput, type ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme, CurrencyInput } from '../../design';
import { parseAmount, toInputText } from '../../money';
import type { Money, SetupDraft } from './plan';

export type StepProps = {
  draft: SetupDraft;
  update: (patch: Partial<SetupDraft> | ((d: SetupDraft) => Partial<SetupDraft>)) => void;
  goTo: (step: number) => void;
};

export function StepHeading({ title, body }: { title: string; body: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xxl }}>{title}</Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: typography.fonts.regular,
          fontSize: typography.sizes.body,
          marginTop: spacing.xs,
          lineHeight: 22,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={[styles.row, { marginBottom: spacing.sm, marginTop: spacing.md }]}>
      <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, flex: 1 }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

export function Hint({ children, tone = 'muted', style }: { children: React.ReactNode; tone?: 'muted' | 'danger' | 'success'; style?: ViewStyle }) {
  const { colors, typography } = useTheme();
  const color = tone === 'danger' ? colors.statusDanger : tone === 'success' ? colors.statusSuccess : colors.textSecondary;
  return (
    <View style={style}>
      <Text style={{ color, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const { colors, typography, radii } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surfaceSubtle,
          borderColor: selected ? colors.primary : colors.borderSubtle,
          borderRadius: radii.full,
        },
      ]}
    >
      {selected ? <Check size={13} color={colors.primary} style={{ marginRight: 5 }} /> : icon}
      <Text
        style={{
          color: selected ? colors.primary : colors.textPrimary,
          fontFamily: typography.fonts.medium,
          fontSize: typography.sizes.sm,
          marginLeft: icon && !selected ? 5 : 0,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Card({ children, selected, style }: { children: React.ReactNode; selected?: boolean; style?: ViewStyle }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.borderSubtle,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          borderRadius: radii.lg,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A choice card: title, one line, a tick when picked. */
export function OptionCard({ title, body, selected, onPress }: { title: string; body?: string; selected: boolean; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <Card selected={selected}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.body }}>{title}</Text>
            {!!body && (
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.sm, marginTop: 2 }}>
                {body}
              </Text>
            )}
          </View>
          {selected && <Check size={18} color={colors.primary} />}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

/** A small whole-number field (day of month, percentage). */
export function NumberField({
  value,
  onChange,
  min,
  max,
  suffix,
  accessibilityLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
  accessibilityLabel: string;
}) {
  const { colors, typography, radii } = useTheme();
  return (
    <View style={[styles.row, { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 8, backgroundColor: colors.surface }]}>
      <RNTextInput
        accessibilityLabel={accessibilityLabel}
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(text) => {
          const n = Number(text.replace(/\D/g, ''));
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fonts.medium,
          fontSize: typography.sizes.body,
          width: 44,
          paddingVertical: 6,
          textAlign: 'right',
        }}
      />
      {!!suffix && <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, marginLeft: 2 }}>{suffix}</Text>}
    </View>
  );
}

export function IconButton({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label} accessibilityRole="button" style={{ padding: 6 }}>
      {children}
    </TouchableOpacity>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

/** A naira field that keeps what's typed and hands back kobo as a string ('' when empty). */
export function MoneyField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: Money;
  onChange: (m: Money) => void;
  label?: string;
  placeholder?: string;
}) {
  const shown = value ? toInputText(BigInt(value)) : '';
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(value);
  // Follow changes made elsewhere (a suggestion applied, a draft restored).
  if (value !== synced) {
    setSynced(value);
    const parsed = parseAmount(text);
    if (!(parsed.ok && parsed.minor.toString() === value)) setText(shown);
  }
  return (
    <CurrencyInput
      label={label}
      value={text}
      placeholder={placeholder}
      onChangeText={(next) => {
        setText(next);
        const parsed = parseAmount(next);
        const minor = next.trim() === '' ? '' : parsed.ok && parsed.minor >= 0n ? parsed.minor.toString() : value;
        setSynced(minor);
        onChange(minor);
      }}
    />
  );
}

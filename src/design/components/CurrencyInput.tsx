import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export interface CurrencyInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  compact?: boolean;
}

export function CurrencyInput({
  value,
  onChangeText,
  label = 'Amount',
  error,
  placeholder = '0.00',
  compact = false,
}: CurrencyInputProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const handleChange = (raw: string) => {
    // Strip everything except numbers and a single decimal point
    const cleaned = raw.replace(/[^0-9.]/g, '');
    onChangeText(cleaned);
  };

  const showLabel = Boolean(label) && !compact;

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.statusDanger : colors.border,
            borderRadius: compact ? radii.sm : radii.md,
            paddingHorizontal: compact ? spacing.sm : spacing.md,
            paddingVertical: compact ? 4 : spacing.sm,
            minHeight: compact ? 32 : undefined,
          },
        ]}
      >
        <Text
          style={[
            styles.currencySymbol,
            {
              color: colors.primary,
              fontFamily: compact ? typography.fonts.medium : typography.fonts.light,
              fontSize: compact ? 13 : typography.sizes.heroSm,
              marginRight: compact ? 3 : spacing.xs,
            },
          ]}
        >
          ₦
        </Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              fontFamily: compact ? typography.fonts.medium : typography.fonts.light,
              fontSize: compact ? 13 : typography.sizes.heroSm,
            },
          ]}
        />
      </View>

      {error ? (
        <Text
          style={[
            styles.errorText,
            {
              color: colors.statusDanger,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: spacing.xxs,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  currencySymbol: {
    userSelect: 'none',
  },
  input: {
    flex: 1,
    padding: 0,
    outlineStyle: 'none' as any,
  },
  errorText: {},
});

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export interface CurrencyInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

export function CurrencyInput({
  value,
  onChangeText,
  label = 'Amount',
  error,
  placeholder = '0.00',
}: CurrencyInputProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const handleChange = (raw: string) => {
    // Strip everything except numbers and a single decimal point
    const cleaned = raw.replace(/[^0-9.]/g, '');
    onChangeText(cleaned);
  };

  return (
    <View style={styles.container}>
      {label && (
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
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
        ]}
      >
        <Text
          style={[
            styles.currencySymbol,
            {
              color: colors.primary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.heroSm,
              marginRight: spacing.xs,
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
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.heroSm,
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

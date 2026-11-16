import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export interface LedgerTransaction {
  id: string;
  payee: string;
  category: string;
  account: string;
  date: string;
  amountMinor: bigint;
  type: 'expense' | 'income' | 'transfer';
  isCleared?: boolean;
}

export interface TransactionRowProps {
  transaction: LedgerTransaction;
  isSelectionMode: boolean;
  isSelected: boolean;
  privacyMode: boolean;
  onPress: () => void;
  onToggleSelect: () => void;
}

export function TransactionRow({
  transaction,
  isSelectionMode,
  isSelected,
  privacyMode,
  onPress,
  onToggleSelect,
}: TransactionRowProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const sign = isIncome ? '+' : isTransfer ? '' : '-';
  const amountColor = isIncome
    ? colors.statusSuccess
    : isTransfer
    ? colors.primary
    : colors.textPrimary;

  const formattedAmount = privacyMode
    ? '••••'
    : `${sign}${formatNaira(transaction.amountMinor)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={isSelectionMode ? onToggleSelect : onPress}
      style={[
        styles.row,
        {
          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
          borderBottomColor: colors.borderSubtle,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      {/* Checkbox in selection mode */}
      {isSelectionMode && (
        <TouchableOpacity
          onPress={onToggleSelect}
          activeOpacity={0.8}
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
              borderRadius: radii.sm,
              marginRight: spacing.md,
            },
          ]}
        >
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </TouchableOpacity>
      )}

      {/* Main Info */}
      <View style={styles.leftCol}>
        <Text
          numberOfLines={1}
          style={[
            styles.payee,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.body,
            },
          ]}
        >
          {transaction.payee || transaction.category}
        </Text>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.categoryPill,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.borderSubtle,
                borderRadius: radii.xs,
                paddingHorizontal: spacing.xs + 2,
                paddingVertical: spacing.xxs,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                },
              ]}
            >
              {transaction.category}
            </Text>
          </View>

          <Text
            style={[
              styles.accountText,
              {
                color: colors.textTertiary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginLeft: spacing.xs,
              },
            ]}
          >
            • {transaction.account}
          </Text>
        </View>
      </View>

      {/* Amount and Status */}
      <View style={styles.rightCol}>
        <Text
          style={[
            styles.amount,
            {
              color: amountColor,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.body,
            },
          ]}
        >
          {formattedAmount}
        </Text>
        <Text
          style={[
            styles.dateText,
            {
              color: colors.textTertiary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            },
          ]}
        >
          {transaction.date}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  payee: {
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryPill: {
    borderWidth: 1,
  },
  categoryText: {},
  accountText: {},
  rightCol: {
    alignItems: 'flex-end',
  },
  amount: {
    letterSpacing: -0.2,
  },
  dateText: {},
});

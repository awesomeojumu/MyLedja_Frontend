import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Check,
  ShoppingBag,
  Car,
  Zap,
  Tv,
  Heart,
  Coffee,
  Briefcase,
  ArrowLeftRight,
  Tag,
  ArrowDownLeft,
} from 'lucide-react-native';
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

  // Visual Category Badge Icon & Color
  const getCategoryBadge = () => {
    if (isIncome) {
      return { Icon: Briefcase, bg: '#ECFDF5', color: '#10B981' };
    }
    if (isTransfer) {
      return { Icon: ArrowLeftRight, bg: '#EFF6FF', color: '#3B82F6' };
    }
    const cat = (transaction.category || '').toLowerCase();
    const payee = (transaction.payee || '').toLowerCase();

    if (cat.includes('grocer') || cat.includes('food') || cat.includes('supermarket') || payee.includes('shoprite')) {
      return { Icon: ShoppingBag, bg: '#FEF3C7', color: '#D97706' };
    }
    if (cat.includes('transport') || cat.includes('fuel') || cat.includes('ride') || payee.includes('bolt') || payee.includes('uber')) {
      return { Icon: Car, bg: '#F3E8FF', color: '#9333EA' };
    }
    if (cat.includes('util') || cat.includes('bill') || cat.includes('electric') || payee.includes('electric')) {
      return { Icon: Zap, bg: '#FEE2E2', color: '#EF4444' };
    }
    if (cat.includes('entertain') || cat.includes('subscript') || payee.includes('netflix') || payee.includes('dstv')) {
      return { Icon: Tv, bg: '#EDE9FE', color: '#7C3AED' };
    }
    if (cat.includes('health') || cat.includes('med') || cat.includes('pharmacy')) {
      return { Icon: Heart, bg: '#FFE4E6', color: '#E11D48' };
    }
    if (cat.includes('dine') || cat.includes('restaurant') || cat.includes('caf')) {
      return { Icon: Coffee, bg: '#FFEDD5', color: '#EA580C' };
    }
    return { Icon: Tag, bg: colors.surfaceSubtle, color: colors.textSecondary };
  };

  const badge = getCategoryBadge();
  const IconComp = badge.Icon;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={isSelectionMode ? onToggleSelect : onPress}
      style={[
        styles.row,
        {
          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
          borderBottomColor: colors.borderSubtle,
          paddingVertical: spacing.sm + 4,
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
              marginRight: spacing.sm,
            },
          ]}
        >
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </TouchableOpacity>
      )}

      {/* Visual Category / Merchant Icon Badge */}
      <View
        style={[
          styles.iconBadge,
          {
            backgroundColor: badge.bg,
            borderRadius: radii.md,
            marginRight: spacing.sm + 2,
          },
        ]}
      >
        <IconComp size={17} color={badge.color} strokeWidth={2} />
      </View>

      {/* Main Info */}
      <View style={styles.leftCol}>
        <Text
          numberOfLines={1}
          style={[
            styles.payee,
            {
              color: colors.textPrimary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.bodySm + 1,
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
                paddingVertical: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: 11,
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
                fontSize: 11,
                marginLeft: spacing.xs,
              },
            ]}
          >
            • {transaction.account}
          </Text>
        </View>
      </View>

      {/* Amount and Date */}
      <View style={styles.rightCol}>
        <Text
          style={[
            styles.amount,
            {
              color: amountColor,
              fontFamily: typography.fonts.semiBold,
              fontSize: typography.sizes.bodySm + 1,
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
              fontSize: 11,
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
  iconBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 3,
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

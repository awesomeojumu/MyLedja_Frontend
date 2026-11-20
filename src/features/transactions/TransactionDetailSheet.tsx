import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, BottomSheet, Button } from '../../design';
import { formatNaira } from '../../money';
import type { LedgerTransaction } from './TransactionRow';

export interface TransactionDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: LedgerTransaction | null;
  privacyMode: boolean;
  onDelete: (id: string) => void;
}

export function TransactionDetailSheet({
  visible,
  onClose,
  transaction,
  privacyMode,
  onDelete,
}: TransactionDetailSheetProps) {
  const { colors, typography, spacing, radii } = useTheme();

  if (!transaction) return null;

  const isIncome = transaction.type === 'income';
  const formattedAmount = privacyMode
    ? '••••'
    : `${isIncome ? '+' : '-'}${formatNaira(transaction.amountMinor)}`;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Transaction Details"
      subtitle={`ID: ${transaction.id}`}
    >
      <View style={styles.container}>
        {/* Big Amount */}
        <View
          style={[
            styles.amountCard,
            {
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              alignItems: 'center',
            },
          ]}
        >
          <Text
            style={[
              styles.amountText,
              {
                color: isIncome ? colors.statusSuccess : colors.textPrimary,
                fontFamily: typography.fonts.light,
                fontSize: typography.sizes.heroSm,
              },
            ]}
          >
            {formattedAmount}
          </Text>
          <Text
            style={[
              styles.typeLabel,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.xs,
                marginTop: 2,
                textTransform: 'uppercase',
              },
            ]}
          >
            {transaction.type}
          </Text>
        </View>

        {/* Key Attributes */}
        <View style={[styles.detailsGroup, { marginTop: spacing.lg }]}>
          <View style={[styles.detailRow, { paddingVertical: spacing.sm }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }]}>
              Description / Purpose
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }]}>
              {transaction.payee || 'None'}
            </Text>
          </View>

          <View style={[styles.detailRow, { paddingVertical: spacing.sm, borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }]}>
              Category
            </Text>
            <View style={[styles.catBadge, { backgroundColor: colors.primaryLight, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs }]}>
              <Text style={{ color: colors.primary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.xs }}>
                {transaction.category}
              </Text>
            </View>
          </View>

          <View style={[styles.detailRow, { paddingVertical: spacing.sm, borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }]}>
              Account
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }]}>
              {transaction.account}
            </Text>
          </View>

          <View style={[styles.detailRow, { paddingVertical: spacing.sm, borderTopColor: colors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }]}>
              Date
            </Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }]}>
              {transaction.date}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ marginTop: spacing.xl, gap: 8 }}>
          <Button
            label="Delete Transaction"
            onPress={() => {
              onDelete(transaction.id);
              onClose();
            }}
            variant="danger"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  amountCard: {
    borderWidth: 1,
  },
  amountText: {
    letterSpacing: -0.5,
  },
  typeLabel: {
    letterSpacing: 0.5,
  },
  detailsGroup: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {},
  detailValue: {},
  catBadge: {},
});

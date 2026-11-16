import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export interface RecentTransactionItem {
  id: string;
  payee: string;
  category: string;
  date: string;
  amountMinor: bigint;
  type: 'expense' | 'income' | 'transfer';
}

export interface RecentActivityListProps {
  transactions: RecentTransactionItem[];
  privacyMode: boolean;
}

export function RecentActivityList({ transactions, privacyMode }: RecentActivityListProps) {
  const { colors, typography, spacing, radii } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.heading,
          {
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: typography.sizes.sm,
            marginBottom: spacing.xs,
          },
        ]}
      >
        Recent Activity
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.xl,
          },
        ]}
      >
        {transactions.length === 0 ? (
          <View style={[styles.empty, { padding: spacing.xl }]}>
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.bodySm,
                },
              ]}
            >
              No transactions recorded yet. Tap "+ Add Expense" above!
            </Text>
          </View>
        ) : (
          transactions.map((tx, idx) => {
            const isLast = idx === transactions.length - 1;
            const isIncome = tx.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amountColor = isIncome ? colors.statusSuccess : colors.textPrimary;
            const formattedAmount = privacyMode
              ? '••••'
              : `${sign}${formatNaira(tx.amountMinor)}`;

            return (
              <View
                key={tx.id}
                style={[
                  styles.row,
                  {
                    borderBottomColor: colors.borderSubtle,
                    borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <View style={styles.leftCol}>
                  <Text
                    style={[
                      styles.payee,
                      {
                        color: colors.textPrimary,
                        fontFamily: typography.fonts.medium,
                        fontSize: typography.sizes.bodySm,
                      },
                    ]}
                  >
                    {tx.payee || tx.category}
                  </Text>
                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.catBadge,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderRadius: radii.xs,
                          paddingHorizontal: spacing.xs + 2,
                          paddingVertical: spacing.xxs,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catText,
                          {
                            color: colors.textSecondary,
                            fontFamily: typography.fonts.regular,
                            fontSize: typography.sizes.xs,
                          },
                        ]}
                      >
                        {tx.category}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.dateText,
                        {
                          color: colors.textTertiary,
                          fontFamily: typography.fonts.regular,
                          fontSize: typography.sizes.xs,
                          marginLeft: spacing.xs,
                        },
                      ]}
                    >
                      {tx.date}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.amount,
                    {
                      color: amountColor,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.bodySm,
                    },
                  ]}
                >
                  {formattedAmount}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heading: {},
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftCol: {
    flex: 1,
  },
  payee: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  catBadge: {},
  catText: {},
  dateText: {},
  amount: {
    letterSpacing: -0.2,
  },
});

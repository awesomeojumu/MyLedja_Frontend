import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export interface PulseSummaryRowProps {
  incomeMinor: bigint;
  spentMinor: bigint;
  privacyMode: boolean;
}

export function PulseSummaryRow({ incomeMinor, spentMinor, privacyMode }: PulseSummaryRowProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const netCashMinor = incomeMinor - spentMinor;

  const cards = [
    {
      label: 'Income',
      amount: privacyMode ? '••••' : formatNaira(incomeMinor),
      icon: TrendingUp,
      color: colors.primary,
      bg: colors.primaryLight,
    },
    {
      label: 'Spent',
      amount: privacyMode ? '••••' : formatNaira(spentMinor),
      icon: TrendingDown,
      color: colors.textSecondary,
      bg: colors.surfaceSubtle,
    },
    {
      label: 'Net Cash',
      amount: privacyMode ? '••••' : formatNaira(netCashMinor),
      icon: Wallet,
      color: netCashMinor >= 0n ? colors.primary : colors.statusDanger,
      bg: netCashMinor >= 0n ? colors.primaryLight : colors.statusDangerLight,
    },
  ];

  return (
    <View style={[styles.container, { marginTop: spacing.md }]}>
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <View
            key={card.label}
            style={[
              styles.tile,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.lg,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.topLine}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: card.bg,
                    borderRadius: radii.full,
                  },
                ]}
              >
                <IconComponent size={14} color={card.color} />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                {card.label}
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.amount,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {card.amount}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {},
  amount: {
    letterSpacing: -0.2,
  },
});

import React from 'react';
import { thisMonthLabel } from '../../lib/months';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Eye, EyeOff, TrendingUp, TrendingDown, Wallet } from 'lucide-react-native';
import { useTheme, useResponsive } from '../../design';
import { formatNaira } from '../../money';

export interface NetWorthHeroCardProps {
  netWorthMinor: bigint;
  monthlyDeltaMinor: bigint;
  incomeMinor: bigint;
  spentMinor: bigint;
  currentMonth?: string;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
}

export function NetWorthHeroCard({
  netWorthMinor,
  monthlyDeltaMinor,
  incomeMinor,
  spentMinor,
  currentMonth = thisMonthLabel(),
  privacyMode,
  onTogglePrivacy,
}: NetWorthHeroCardProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isPhone, width } = useResponsive();

  const netCashMinor = incomeMinor - spentMinor;

  const formattedNetWorth = privacyMode ? '₦••••••••' : formatNaira(netWorthMinor);
  const formattedDelta = privacyMode
    ? '••••'
    : `${monthlyDeltaMinor >= 0n ? '+' : ''}${formatNaira(monthlyDeltaMinor)} this month`;

  const formattedIncome = privacyMode ? '••••' : formatNaira(incomeMinor);
  const formattedSpent = privacyMode ? '••••' : formatNaira(spentMinor);
  const formattedNetCash = privacyMode ? '••••' : formatNaira(netCashMinor);

  // Very narrow screens (e.g. 320px) stack metrics; standard mobile (360px+) and desktop use 3 columns
  const isNarrowMobile = isPhone && width < 360;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.xl,
          padding: spacing.lg,
        },
      ]}
    >
      {/* 1. Header Row (Title & Privacy Toggle) */}
      <View style={styles.topRow}>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.sm,
            },
          ]}
        >
          Total Net Worth
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={privacyMode ? 'Reveal numbers' : 'Hide numbers'}
          onPress={onTogglePrivacy}
          activeOpacity={0.7}
          style={[
            styles.eyeButton,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
            },
          ]}
        >
          {privacyMode ? (
            <EyeOff size={16} color={colors.textSecondary} />
          ) : (
            <Eye size={16} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Hero Balance Number (Responsive & No Truncating) */}
      <Text
        style={[
          styles.amount,
          {
            color: colors.textPrimary,
            fontFamily: typography.fonts.light,
            fontSize: isPhone ? 28 : typography.sizes.hero,
            marginVertical: spacing.xs,
          },
        ]}
      >
        {formattedNetWorth}
      </Text>

      {/* 3. Monthly Delta Badge */}
      <View style={styles.deltaContainer}>
        <View
          style={[
            styles.deltaBadge,
            {
              backgroundColor: monthlyDeltaMinor >= 0n ? colors.primaryLight : colors.statusDangerLight,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.xxs + 1,
            },
          ]}
        >
          <Text
            style={[
              styles.deltaText,
              {
                color: monthlyDeltaMinor >= 0n ? colors.primary : colors.statusDanger,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              },
            ]}
          >
            {formattedDelta}
          </Text>
        </View>
      </View>

      {/* 4. Elegant Horizontal Divider */}
      <View
        style={[
          styles.divider,
          {
            backgroundColor: colors.borderSubtle,
            marginVertical: spacing.md + 2,
          },
        ]}
      />

      {/* Cash Flow Subtitle */}
      <View style={{ marginBottom: spacing.xs + 2 }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Cash Flow · {currentMonth}
        </Text>
      </View>

      {/* 5. Metrics Row in the same card (Income, Spent, Net Cash) */}
      <View
        style={[
          styles.metricsRow,
          isNarrowMobile && styles.metricsRowStacked,
        ]}
      >
        {/* Metric 1: Income */}
        <View style={styles.metricColumn}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <TrendingUp size={13} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              Income
            </Text>
          </View>

          <Text
            style={[
              styles.metricValue,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: isPhone ? 14 : 16,
                marginTop: spacing.xs,
              },
            ]}
          >
            {formattedIncome}
          </Text>
        </View>

        {!isNarrowMobile && (
          <View style={[styles.columnDivider, { backgroundColor: colors.borderSubtle }]} />
        )}

        {/* Metric 2: Spent */}
        <View style={styles.metricColumn}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                },
              ]}
            >
              <TrendingDown size={13} color={colors.textSecondary} />
            </View>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              Spent
            </Text>
          </View>

          <Text
            style={[
              styles.metricValue,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: isPhone ? 14 : 16,
                marginTop: spacing.xs,
              },
            ]}
          >
            {formattedSpent}
          </Text>
        </View>

        {!isNarrowMobile && (
          <View style={[styles.columnDivider, { backgroundColor: colors.borderSubtle }]} />
        )}

        {/* Metric 3: Net Cash */}
        <View style={styles.metricColumn}>
          <View style={styles.metricHeader}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: netCashMinor >= 0n ? colors.primaryLight : colors.statusDangerLight,
                  borderRadius: radii.full,
                },
              ]}
            >
              <Wallet
                size={13}
                color={netCashMinor >= 0n ? colors.primary : colors.statusDanger}
              />
            </View>
            <Text
              style={[
                styles.metricLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              Net Cash
            </Text>
          </View>

          <Text
            style={[
              styles.metricValue,
              {
                color: netCashMinor >= 0n ? colors.primary : colors.statusDanger,
                fontFamily: typography.fonts.semiBold,
                fontSize: isPhone ? 14 : 16,
                marginTop: spacing.xs,
              },
            ]}
          >
            {formattedNetCash}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitle: {
    letterSpacing: 0.2,
  },
  eyeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    letterSpacing: -0.6,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deltaBadge: {},
  deltaText: {},
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  metricsRowStacked: {
    flexDirection: 'column',
    gap: 12,
  },
  metricColumn: {
    flex: 1,
    paddingHorizontal: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {},
  metricValue: {
    letterSpacing: -0.2,
  },
  columnDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    alignSelf: 'center',
    marginHorizontal: 4,
  },
});

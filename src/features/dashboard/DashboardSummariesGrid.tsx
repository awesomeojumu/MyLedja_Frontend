import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PieChart,
  Calendar,
  Scale,
  Target,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme, useResponsive } from '../../design';
import { formatNaira } from '../../money';

export interface DashboardSummariesGridProps {
  privacyMode: boolean;
  currentMonth?: string;
}

export function DashboardSummariesGrid({
  privacyMode,
  currentMonth = 'November 2026',
}: DashboardSummariesGridProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop, isTablet } = useResponsive();
  const router = useRouter();

  const isWide = isDesktop || isTablet;

  // Mock data matching master design spec
  const budgetLeftMinor = 19960000n; // ₦199,600.00
  const budgetTotalMinor = 52000000n; // ₦520,000.00
  const budgetPercent = 62;

  const upcomingBills = [
    { name: 'DSTV Subscription', amountMinor: 2450000n, daysLeft: 3, isExpense: true },
    { name: 'Freelance Inflow', amountMinor: 35000000n, daysLeft: 7, isExpense: false },
  ];

  const debtsOwedToYouMinor = 8500000n; // ₦85,000.00
  const debtsYouOweMinor = 4000000n;    // ₦40,000.00

  const goals = [
    { name: 'Emergency Fund', currentMinor: 62000000n, targetMinor: 100000000n, percent: 62 },
    { name: 'Annual Rent 2027', currentMinor: 45000000n, targetMinor: 250000000n, percent: 18 },
  ];

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.sectionHeading,
          {
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: typography.sizes.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
          },
        ]}
      >
        Financial Overview · {currentMonth}
      </Text>

      <View style={[styles.grid, isWide && styles.gridWide]}>
        {/* 1. Budget Summary Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/budget' as any)}
          style={[
            styles.card,
            isWide && styles.cardHalf,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md + 2,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight, borderRadius: radii.full }]}>
                <PieChart size={14} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                Budget Progress
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <Text
              style={[
                styles.mainFigure,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.lg,
                },
              ]}
            >
              {privacyMode ? '₦••••••••' : formatNaira(budgetLeftMinor)}{' '}
              <Text style={{ fontSize: typography.sizes.xs, color: colors.textSecondary, fontFamily: typography.fonts.regular }}>
                left of {privacyMode ? '••••' : formatNaira(budgetTotalMinor)}
              </Text>
            </Text>

            {/* Progress Bar */}
            <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, marginTop: spacing.xs }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${budgetPercent}%`,
                    borderRadius: radii.full,
                  },
                ]}
              />
            </View>

            <View style={styles.budgetMiniRows}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }}>
                Food & Dining: 72% used
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }}>
                Transport: 88% used
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2. Upcoming Bills & Plan Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/plan' as any)}
          style={[
            styles.card,
            isWide && styles.cardHalf,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md + 2,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}>
                <Calendar size={14} color={colors.textSecondary} />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                Coming Up (14 Days)
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            {upcomingBills.map((bill) => (
              <View key={bill.name} style={[styles.billItem, { borderBottomColor: colors.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.xs }}>
                    {bill.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: 11, marginTop: 1 }}>
                    Due in {bill.daysLeft} days
                  </Text>
                </View>
                <Text
                  style={{
                    color: bill.isExpense ? colors.textPrimary : colors.statusSuccess,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {privacyMode ? '••••' : `${bill.isExpense ? '−' : '+'}${formatNaira(bill.amountMinor)}`}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* 3. Debts & Loans Summary Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/debts' as any)}
          style={[
            styles.card,
            isWide && styles.cardHalf,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md + 2,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}>
                <Scale size={14} color={colors.textSecondary} />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                Debts & Loans
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={[styles.debtColumns, { marginTop: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }}>
                Owed to You
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                  marginTop: 2,
                }}
              >
                {privacyMode ? '••••' : formatNaira(debtsOwedToYouMinor)}
              </Text>
            </View>

            <View style={[styles.debtDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={{ flex: 1, paddingLeft: spacing.md }}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }}>
                You Owe
              </Text>
              <Text
                style={{
                  color: colors.statusDanger,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                  marginTop: 2,
                }}
              >
                {privacyMode ? '••••' : formatNaira(debtsYouOweMinor)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 4. Savings Goals Summary Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/goals' as any)}
          style={[
            styles.card,
            isWide && styles.cardHalf,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md + 2,
              marginBottom: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight, borderRadius: radii.full }]}>
                <Target size={14} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.sm,
                    marginLeft: spacing.xs,
                  },
                ]}
              >
                Savings Goals
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            {goals.map((goal, idx) => (
              <View key={goal.name} style={{ marginTop: idx > 0 ? spacing.xs + 2 : 0 }}>
                <View style={styles.goalRow}>
                  <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.xs }}>
                    {goal.name}
                  </Text>
                  <Text style={{ color: colors.primary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.xs }}>
                    {goal.percent}%
                  </Text>
                </View>
                <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, marginTop: 4 }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${goal.percent}%`,
                        borderRadius: radii.full,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 8,
  },
  sectionHeading: {},
  grid: {
    flexDirection: 'column',
    width: '100%',
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '100%',
    borderWidth: 1,
  },
  cardHalf: {
    width: '49%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {},
  mainFigure: {
    letterSpacing: -0.3,
  },
  progressBarTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
  },
  budgetMiniRows: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  debtColumns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

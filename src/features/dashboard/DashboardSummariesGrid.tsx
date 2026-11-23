import React, { useMemo } from 'react';
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
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { monthCodeOf, thisMonthLabel } from '../../lib/months';

import { t } from '../../i18n';
export interface DashboardSummariesGridProps {
  privacyMode: boolean;
  currentMonth?: string;
}

export function DashboardSummariesGrid({
  privacyMode,
  currentMonth = thisMonthLabel(),
}: DashboardSummariesGridProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop, isTablet } = useResponsive();
  const router = useRouter();

  const isWide = isDesktop || isTablet;

  const {
    assigns,
    getMonthlyTotals,
    recurring: dbRecurring,
    debts: dbDebts,
    goals: dbGoals,
    allocations,
  } = useDatabaseData();

  const targetMonthCode = monthCodeOf(currentMonth);

  // Live Budget Calculation from Database Assigns
  let budgetTotalMinor = 0n;
  assigns.forEach((amount, key) => {
    if (key.endsWith(`:${targetMonthCode}`)) {
      budgetTotalMinor += amount;
    }
  });
  const monthlyTotals = getMonthlyTotals(targetMonthCode);
  const budgetSpentMinor = monthlyTotals.spent;
  const budgetLeftMinor = budgetTotalMinor > budgetSpentMinor ? budgetTotalMinor - budgetSpentMinor : 0n;
  const budgetPercent =
    budgetTotalMinor > 0n
      ? Math.min(100, Math.round(Number((budgetSpentMinor * 100n) / budgetTotalMinor)))
      : 0;

  // Live Upcoming Bills from Database Recurring
  const upcomingBills = useMemo(() => {
    return dbRecurring.slice(0, 3).map((r) => {
      const isExpense = r.kind !== 'income';
      const minor = BigInt(r.amountMinor || '0');
      return {
        name: r.name,
        amountMinor: minor,
        daysLeft: r.rule?.on ? Math.max(1, r.rule.on - new Date().getDate()) : 7,
        isExpense,
      };
    });
  }, [dbRecurring]);

  // Live Debts Owed from Database Debts
  const { debtsOwedToYouMinor, debtsYouOweMinor } = useMemo(() => {
    let owedToYou = 0n;
    let youOwe = 0n;
    for (const d of dbDebts) {
      if (d.status !== 'open') continue;
      const amt = BigInt(d.scheduleAmountMinor || d.creditMinor || '0');
      if (d.direction === 'owedToMe') owedToYou += amt;
      else youOwe += amt;
    }
    return { debtsOwedToYouMinor: owedToYou, debtsYouOweMinor: youOwe };
  }, [dbDebts]);

  // Live Savings Goals from Database Goals
  const goals = useMemo(() => {
    return dbGoals.slice(0, 3).map((g) => {
      const target = BigInt(g.targetMinor || '1');
      // Saved so far: what's been set aside, less what's been spent from it.
      const saved = allocations
        .filter((a) => a.goalId === g.id)
        .reduce((sum, a) => (a.kind === 'spend' ? sum - BigInt(a.amountMinor) : sum + BigInt(a.amountMinor)), 0n);
      const cur = saved > 0n ? saved : 0n;
      const pct = target > 0n ? Math.min(100, Math.round(Number((cur * 100n) / target))) : 0;
      return {
        name: g.name,
        currentMinor: cur,
        targetMinor: target,
        percent: pct,
      };
    });
  }, [dbGoals, allocations]);

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
        {t('ui.dashboardSummariesGrid.financialOverview')}{' '}{currentMonth}
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
                {t('ui.dashboardSummariesGrid.budgetProgress')}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          {budgetTotalMinor === 0n ? (
            <View style={{ marginTop: spacing.sm, paddingVertical: spacing.xs }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                }}
              >
                {t('ui.dashboardSummariesGrid.noBudgetPlannedForThis')}
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                  marginTop: 4,
                }}
              >
                {t('ui.dashboardSummariesGrid.tapToPlanBudgets')}
              </Text>
            </View>
          ) : (
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
                  {t('ui.dashboardSummariesGrid.leftOf')}{' '}{privacyMode ? '••••' : formatNaira(budgetTotalMinor)}
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
            </View>
          )}
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
                {t('ui.dashboardSummariesGrid.comingUp14Days')}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            {upcomingBills.length === 0 ? (
              <View style={{ paddingVertical: spacing.xs }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {t('ui.dashboardSummariesGrid.noUpcomingBillsScheduled')}
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                    marginTop: 4,
                  }}
                >
                  {t('ui.dashboardSummariesGrid.tapToAddBillsAnd')}
                </Text>
              </View>
            ) : (
              upcomingBills.map((bill) => (
                <View key={bill.name} style={[styles.billItem, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.xs }}>
                      {bill.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: 11, marginTop: 1 }}>
                      {t('ui.dashboardSummariesGrid.dueIn')}{' '}{bill.daysLeft}{' '}{t('ui.dashboardSummariesGrid.days')}
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
              ))
            )}
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
                {t('ui.dashboardSummariesGrid.debtsAndLoans')}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={[styles.debtColumns, { marginTop: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }}>
                {t('ui.dashboardSummariesGrid.owedToYou')}
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
                {t('ui.dashboardSummariesGrid.youOwe')}
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
                {t('ui.dashboardSummariesGrid.savingsGoals')}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            {goals.length === 0 ? (
              <View style={{ paddingVertical: spacing.xs }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  {t('ui.dashboardSummariesGrid.noSavingsGoalsCreatedYet')}
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.medium,
                    fontSize: typography.sizes.xs,
                    marginTop: 4,
                  }}
                >
                  {t('ui.dashboardSummariesGrid.tapToCreateAGoal')}
                </Text>
              </View>
            ) : (
              goals.map((goal, idx) => (
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
              ))
            )}
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

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, ArrowLeftRight, AlertCircle, Sliders, Pencil } from 'lucide-react-native';
import { useTheme, Button } from '../../design';
import { useResponsive } from '../../design/size';
import { formatNaira } from '../../money';

export interface SafeToSpendHeroProps {
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  totalPlannedMinor: bigint;
  totalSpentMinor: bigint;
  expectedIncomeMinor: bigint;
  frameworkName: string;
  overspentCount: number;
  onMoveMoney: () => void;
  onCoverOverspending: () => void;
  onOpenSetup: () => void;
  onOpenCategoryBudgets?: () => void;
  onOpenIncomeBudget?: () => void;
}

export function SafeToSpendHero({
  currentMonth,
  onPrevMonth,
  onNextMonth,
  totalPlannedMinor,
  totalSpentMinor,
  expectedIncomeMinor,
  frameworkName,
  overspentCount,
  onMoveMoney,
  onCoverOverspending,
  onOpenSetup,
  onOpenCategoryBudgets,
  onOpenIncomeBudget,
}: SafeToSpendHeroProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const { isDesktop } = useResponsive();

  const remainingMinor = totalPlannedMinor - totalSpentMinor;
  const isOver = remainingMinor < 0n;

  // DESKTOP: Compact side-by-side dashboard layout
  if (isDesktop) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.lg,
            padding: spacing.md,
            marginBottom: spacing.sm + 2,
          },
        ]}
      >
        {/* Top Row: Month Navigation + Framework & Quick Actions */}
        <View style={styles.topRow}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={onPrevMonth}
              style={[styles.arrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
            >
              <ChevronLeft size={14} color={colors.textPrimary} />
            </TouchableOpacity>

            <Text
              style={[
                styles.monthLabel,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 13,
                  marginHorizontal: 6,
                },
              ]}
            >
              {currentMonth}
            </Text>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={onNextMonth}
              style={[styles.arrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
            >
              <ChevronRight size={14} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Framework Pill + Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={onOpenSetup}
              activeOpacity={0.7}
              style={[
                styles.frameworkPill,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radii.full,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
            >
              <Sliders size={11} color={colors.primary} style={{ marginRight: 3 }} />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontFamily: typography.fonts.semiBold,
                }}
              >
                {frameworkName}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onMoveMoney}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radii.full,
                backgroundColor: colors.surfaceSubtle,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.borderSubtle,
              }}
            >
              <ArrowLeftRight size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: typography.fonts.medium }}>
                Move Money
              </Text>
            </TouchableOpacity>

            {onOpenCategoryBudgets && (
              <TouchableOpacity
                onPress={onOpenCategoryBudgets}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.full,
                  backgroundColor: colors.surfaceSubtle,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Sliders size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontFamily: typography.fonts.medium }}>
                  Category Budgets
                </Text>
              </TouchableOpacity>
            )}

            {overspentCount > 0 && (
              <TouchableOpacity
                onPress={onCoverOverspending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radii.full,
                  backgroundColor: colors.statusDanger,
                }}
              >
                <AlertCircle size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 11, color: '#FFFFFF', fontFamily: typography.fonts.semiBold }}>
                  Cover ({overspentCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Middle Row: Safe to spend Hero number + Inline 3 Metrics */}
        <View style={[styles.mainRow, { marginTop: spacing.xs + 2, paddingTop: spacing.xs + 2 }]}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {isOver ? 'Total Overbudget' : 'Safe to Spend This Month'}
            </Text>
            <Text
              style={[
                styles.amount,
                {
                  color: isOver ? colors.statusDanger : colors.primary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 22,
                  marginTop: 1,
                },
              ]}
            >
              {formatNaira(remainingMinor < 0n ? -remainingMinor : remainingMinor)}
            </Text>
          </View>

          {/* 3 Inline metrics strip */}
          <View style={[styles.metricsStrip, { borderColor: colors.borderSubtle }]}>
            <TouchableOpacity
              activeOpacity={onOpenIncomeBudget ? 0.7 : 1}
              onPress={onOpenIncomeBudget}
              style={styles.metricItem}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Expected</Text>
                {onOpenIncomeBudget && <Pencil size={9} color={colors.primary} />}
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {formatNaira(expectedIncomeMinor)}
              </Text>
            </TouchableOpacity>
            <View style={[styles.metricSep, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Planned</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {formatNaira(totalPlannedMinor)}
              </Text>
            </View>
            <View style={[styles.metricSep, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Spent</Text>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {formatNaira(totalSpentMinor)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // MOBILE: Spacious touch-friendly stacked card
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.xl,
          padding: spacing.lg,
          marginBottom: spacing.md,
        },
      ]}
    >
      {/* Month Navigator Header & Structure Badge */}
      <View style={styles.mobileMonthRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={onPrevMonth}
          style={[styles.mobileArrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
        >
          <ChevronLeft size={18} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={[
              styles.monthLabel,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
              },
            ]}
          >
            {currentMonth}
          </Text>

          <TouchableOpacity
            onPress={onOpenSetup}
            activeOpacity={0.7}
            style={[
              styles.frameworkPill,
              {
                backgroundColor: colors.primaryLight,
                borderRadius: radii.full,
                paddingHorizontal: 10,
                paddingVertical: 3,
                marginTop: 4,
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}
          >
            <Sliders size={12} color={colors.primary} style={{ marginRight: 4 }} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontFamily: typography.fonts.semiBold,
              }}
            >
              {frameworkName}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={onNextMonth}
          style={[styles.mobileArrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
        >
          <ChevronRight size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Safe-to-Spend Balance */}
      <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fonts.medium,
            fontSize: typography.sizes.sm,
          }}
        >
          {isOver ? 'Total Overbudget' : 'Safe to Spend This Month'}
        </Text>
        <Text
          style={[
            styles.amount,
            {
              color: isOver ? colors.statusDanger : colors.primary,
              fontFamily: typography.fonts.semiBold,
              fontSize: 30,
              marginTop: 4,
            },
          ]}
        >
          {formatNaira(remainingMinor < 0n ? -remainingMinor : remainingMinor)}
        </Text>
      </View>

      {/* 3 Metrics Row */}
      <View style={[styles.mobileMetricsRow, { borderColor: colors.borderSubtle }]}>
        <TouchableOpacity
          activeOpacity={onOpenIncomeBudget ? 0.7 : 1}
          onPress={onOpenIncomeBudget}
          style={styles.metric}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Expected</Text>
            {onOpenIncomeBudget && <Pencil size={10} color={colors.primary} />}
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatNaira(expectedIncomeMinor)}
          </Text>
        </TouchableOpacity>
        <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Planned</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatNaira(totalPlannedMinor)}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Spent</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatNaira(totalSpentMinor)}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.mobileActionsRow, { marginTop: spacing.md, gap: 8 }]}>
        <View style={{ flex: 1 }}>
          <Button
            label="Adjust Structure"
            onPress={onOpenSetup}
            variant="secondary"
            size="md"
            icon={<Sliders size={15} color={colors.primary} />}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            label="Move Money"
            onPress={onMoveMoney}
            variant="secondary"
            size="md"
            icon={<ArrowLeftRight size={15} color={colors.textPrimary} />}
          />
        </View>

        {onOpenCategoryBudgets && (
          <View style={{ flex: 1 }}>
            <Button
              label="Budgets"
              onPress={onOpenCategoryBudgets}
              variant="secondary"
              size="md"
              icon={<Sliders size={15} color={colors.primary} />}
            />
          </View>
        )}

        {overspentCount > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              label={`Cover (${overspentCount})`}
              onPress={onCoverOverspending}
              variant="danger"
              size="md"
              icon={<AlertCircle size={15} color="#FFFFFF" />}
            />
          </View>
        )}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {},
  frameworkPill: {},
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  amount: {
    letterSpacing: -0.5,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metricItem: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  metricValue: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  metricSep: {
    width: 1,
    height: 18,
  },
  // Mobile styles
  mobileMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileArrowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  mobileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

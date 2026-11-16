import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, ArrowLeftRight, AlertCircle, Sliders, CheckCircle2 } from 'lucide-react-native';
import { useTheme, Button } from '../../design';
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
}: SafeToSpendHeroProps) {
  const { colors, typography, spacing, radii } = useTheme();

  const remainingMinor = totalPlannedMinor - totalSpentMinor;
  const isOver = remainingMinor < 0n;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.xl,
          padding: spacing.xl,
          marginBottom: spacing.lg,
        },
      ]}
    >
      {/* Month Navigator Header & Structure Badge */}
      <View style={styles.monthRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={onPrevMonth}
          style={[styles.arrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
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

          {/* Interactive Framework Pill */}
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
          style={[styles.arrowBtn, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full }]}
        >
          <ChevronRight size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Big Safe-to-Spend Balance */}
      <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
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
          {isOver ? 'Total Overbudget' : 'Safe to Spend This Month'}
        </Text>
        <Text
          style={[
            styles.amount,
            {
              color: isOver ? colors.statusDanger : colors.primary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: 4,
            },
          ]}
        >
          {formatNaira(remainingMinor < 0n ? -remainingMinor : remainingMinor)}
        </Text>
      </View>

      {/* Progress Breakdown Bar (Expected Income, Planned, Spent) */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
            Expected Income
          </Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }]}>
            {formatNaira(expectedIncomeMinor)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
            Planned Budget
          </Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }]}>
            {formatNaira(totalPlannedMinor)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs }]}>
            Total Spent
          </Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary, fontFamily: typography.fonts.medium, fontSize: typography.sizes.bodySm }]}>
            {formatNaira(totalSpentMinor)}
          </Text>
        </View>
      </View>

      {/* Action Buttons & Overspending Warning */}
      <View style={[styles.actionsRow, { marginTop: spacing.lg, gap: 8 }]}>
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

        {overspentCount > 0 && (
          <View style={{ flex: 1 }}>
            <Button
              label={`Cover Overspent (${overspentCount})`}
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
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {},
  frameworkPill: {},
  subtitle: {},
  amount: {
    letterSpacing: -0.8,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  metricLabel: {
    marginBottom: 2,
  },
  metricValue: {},
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

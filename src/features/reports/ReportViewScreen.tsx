import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Download,
  Calendar,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { ExportMenuSheet } from './ExportMenuSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

export function ReportViewScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Live Database Hook
  const { events: dbEvents, categories: dbCategories, netWorthMinor, getMonthlyTotals } = useDatabaseData();

  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [exportVisible, setExportVisible] = useState(false);

  const reportTitle =
    id === 'spending-category'
      ? 'Monthly Spending by Category'
      : id === 'income-vs-expense'
      ? 'Income vs. Expense Delta'
      : id === 'statutory-deductions'
      ? 'PAYE Tax & Pension Deductions'
      : 'Net Worth Growth Trajectory';

  const defaultRows = [
    { label: 'Housing & Rent Allocation', amountMinor: 25000000n, percent: 38 },
    { label: 'Food, Dining & Groceries', amountMinor: 18500000n, percent: 28 },
    { label: 'Fuel & Transportation', amountMinor: 12000000n, percent: 18 },
    { label: 'Utilities & Power Subscriptions', amountMinor: 6500000n, percent: 10 },
    { label: 'Family Support & Personal', amountMinor: 4000000n, percent: 6 },
  ];

  const rows = React.useMemo(() => {
    if (dbEvents.length > 0) {
      const catTotals: Record<string, bigint> = {};
      let totalSpent = 0n;
      for (const ev of dbEvents) {
        if (ev.type === 'expense') {
          let evAmount = 0n;
          for (const line of ev.lines) {
            if (line.amountMinor > 0n) evAmount += line.amountMinor;
          }
          const cat = dbCategories.find((c) => c.id === ev.lines[0]?.ledgerAccountId);
          const catName = cat?.name || 'General Spending';
          catTotals[catName] = (catTotals[catName] || 0n) + evAmount;
          totalSpent += evAmount;
        }
      }
      const list = Object.entries(catTotals).map(([name, amountMinor]) => ({
        label: name,
        amountMinor,
        percent: totalSpent > 0n ? Math.round((Number(amountMinor) / Number(totalSpent)) * 100) : 0,
      }));
      if (list.length > 0) return list;
    }
    return defaultRows;
  }, [dbEvents, dbCategories]);

  const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0n);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: colors.borderSubtle,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { padding: spacing.xs }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text
            style={[
              styles.screenTitle,
              {
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.lg,
              },
            ]}
          >
            {reportTitle}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            Executive Summary Statement
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setExportVisible(true)}
          style={[
            styles.exportBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 5,
            },
          ]}
        >
          <Download size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            Export
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View
          style={[
            styles.periodTabs,
            {
              backgroundColor: colors.surfaceSubtle,
              borderRadius: radii.full,
              padding: 3,
              marginBottom: spacing.lg,
            },
          ]}
        >
          {(
            [
              { id: 'month', label: 'This Month' },
              { id: 'quarter', label: 'This Quarter' },
              { id: 'year', label: 'Year to Date' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setPeriod(tab.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: period === tab.id ? colors.surface : 'transparent',
                  borderRadius: radii.full,
                  paddingVertical: 6,
                  flex: 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: period === tab.id ? colors.primary : colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Metric Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.lg,
              padding: spacing.lg,
              marginBottom: spacing.xl,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Total Period Volume
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(totalMinor)}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            }}
          >
            Computed across 5 reporting segments
          </Text>
        </View>

        {/* Breakdown Rows */}
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fonts.semiBold,
            fontSize: typography.sizes.md,
            marginBottom: spacing.md,
          }}
        >
          Segment Breakdown
        </Text>

        {rows.map((row) => (
          <View
            key={row.label}
            style={[
              styles.breakdownRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.bodySm,
                }}
              >
                {formatNaira(row.amountMinor)}
              </Text>
            </View>

            {/* Progress bar */}
            <View
              style={[
                styles.barBg,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderRadius: radii.full,
                  marginTop: spacing.sm,
                },
              ]}
            >
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${row.percent}%`,
                    backgroundColor: colors.primary,
                    borderRadius: radii.full,
                  },
                ]}
              />
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 10,
                fontFamily: typography.fonts.regular,
                marginTop: 4,
              }}
            >
              {row.percent}% of total reported volume
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Export Menu Sheet */}
      <ExportMenuSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        reportTitle={reportTitle}
        onExport={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  screenTitle: {},
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  periodTabs: {
    flexDirection: 'row',
  },
  tabBtn: {},
  heroCard: {
    borderWidth: 1,
  },
  breakdownRow: {
    borderWidth: 1,
  },
  barBg: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
});

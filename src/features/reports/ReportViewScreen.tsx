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
  const {
    events: dbEvents,
    categories: dbCategories,
    accounts: dbAccounts,
    payees: dbPayees,
    accountBalances,
    netWorthMinor,
  } = useDatabaseData();

  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [exportVisible, setExportVisible] = useState(false);

  // Determine report details and compute specific metrics
  const reportConfig = React.useMemo(() => {
    switch (id) {
      case 'top-merchants': {
        const title = 'Top Payees & Merchants';
        const subtitle = 'Highest volume counterparties and merchant fees';
        const heroLabel = 'Total Merchant Expenses';
        const segmentHeader = 'Merchant & Vendor Breakdown';

        const payeeMap: Record<string, bigint> = {};
        let totalExpense = 0n;

        for (const ev of dbEvents) {
          if (ev.type === 'expense') {
            let evAmount = 0n;
            for (const line of ev.lines) {
              if (line.amountMinor > 0n) evAmount += line.amountMinor;
            }
            const payee = dbPayees.find((p) => p.id === (ev as any).payeeId);
            const name = payee?.name || ev.payeeName || ev.notes || 'Unspecified Vendor';
            payeeMap[name] = (payeeMap[name] || 0n) + evAmount;
            totalExpense += evAmount;
          }
        }

        const items = Object.entries(payeeMap)
          .sort((a, b) => (b[1] > a[1] ? 1 : -1))
          .map(([name, amountMinor]) => ({
            label: name,
            amountMinor,
            percent: totalExpense > 0n ? Math.round((Number(amountMinor) / Number(totalExpense)) * 100) : 0,
          }));

        return {
          title,
          subtitle,
          heroLabel,
          heroAmountMinor: totalExpense,
          segmentHeader,
          rows: items,
          unitLabel: 'of merchant expenses',
        };
      }

      case 'spending-category': {
        const title = 'Monthly Spending by Category';
        const subtitle = 'Envelope expense distributions and category weights';
        const heroLabel = 'Total Category Spending';
        const segmentHeader = 'Category Envelope Breakdown';

        const catMap: Record<string, bigint> = {};
        let totalExpense = 0n;

        for (const ev of dbEvents) {
          if (ev.type === 'expense') {
            let evAmount = 0n;
            for (const line of ev.lines) {
              if (line.amountMinor > 0n) evAmount += line.amountMinor;
            }
            const cat = dbCategories.find((c) => c.id === ev.lines[0]?.ledgerAccountId);
            const name = cat?.name || 'General Spending';
            catMap[name] = (catMap[name] || 0n) + evAmount;
            totalExpense += evAmount;
          }
        }

        const items = Object.entries(catMap)
          .sort((a, b) => (b[1] > a[1] ? 1 : -1))
          .map(([name, amountMinor]) => ({
            label: name,
            amountMinor,
            percent: totalExpense > 0n ? Math.round((Number(amountMinor) / Number(totalExpense)) * 100) : 0,
          }));

        return {
          title,
          subtitle,
          heroLabel,
          heroAmountMinor: totalExpense,
          segmentHeader,
          rows: items,
          unitLabel: 'of category spending',
        };
      }

      case 'income-vs-expense': {
        const title = 'Income vs. Expense Delta';
        const subtitle = 'Surplus cash flow retention compared against living burn';
        const heroLabel = 'Net Cash Retention Surplus';
        const segmentHeader = 'Cash Flow Inflow & Outflow Delta';

        let totalIncome = 0n;
        let totalExpense = 0n;

        for (const ev of dbEvents) {
          if (ev.status !== 'posted') continue;
          let evAmount = 0n;
          for (const line of ev.lines) {
            if (line.amountMinor > 0n) evAmount += line.amountMinor;
          }
          if (ev.type === 'income') totalIncome += evAmount;
          else if (ev.type === 'expense') totalExpense += evAmount;
        }

        const netSurplus = totalIncome >= totalExpense ? totalIncome - totalExpense : -(totalExpense - totalIncome);
        const baseVolume = totalIncome > 0n ? totalIncome : totalExpense;

        const items = [
          {
            label: 'Total Earned Income',
            amountMinor: totalIncome,
            percent: baseVolume > 0n ? Math.round((Number(totalIncome) / Number(baseVolume)) * 100) : 0,
          },
          {
            label: 'Total Living & Fixed Expenses',
            amountMinor: totalExpense,
            percent: baseVolume > 0n ? Math.round((Number(totalExpense) / Number(baseVolume)) * 100) : 0,
          },
          {
            label: 'Net Retained Savings',
            amountMinor: netSurplus > 0n ? netSurplus : 0n,
            percent: totalIncome > 0n && netSurplus > 0n ? Math.round((Number(netSurplus) / Number(totalIncome)) * 100) : 0,
          },
        ].filter(() => totalIncome > 0n || totalExpense > 0n);

        return {
          title,
          subtitle,
          heroLabel,
          heroAmountMinor: netSurplus,
          segmentHeader,
          rows: items,
          unitLabel: 'of volume',
        };
      }

      case 'statutory-deductions': {
        const title = 'PAYE Tax & Pension Deductions';
        const subtitle = 'Detailed statement of PAYE tax, pension contributions & levies';
        const heroLabel = 'Total Statutory Deductions';
        const segmentHeader = 'Statutory Line Item Breakdown';

        const statutoryMap: Record<string, bigint> = {};
        let totalStatutory = 0n;

        for (const ev of dbEvents) {
          if (ev.type === 'expense') {
            for (const line of ev.lines) {
              const cat = dbCategories.find((c) => c.id === line.ledgerAccountId);
              const catName = cat?.name?.toLowerCase() || '';
              if (
                catName.includes('tax') ||
                catName.includes('pension') ||
                catName.includes('nhf') ||
                catName.includes('tithe') ||
                catName.includes('levy')
              ) {
                const label = cat?.name || 'Statutory Deduction';
                const amt = line.amountMinor > 0n ? line.amountMinor : -line.amountMinor;
                statutoryMap[label] = (statutoryMap[label] || 0n) + amt;
                totalStatutory += amt;
              }
            }
          }
        }

        const items = Object.entries(statutoryMap).map(([name, amountMinor]) => ({
          label: name,
          amountMinor,
          percent: totalStatutory > 0n ? Math.round((Number(amountMinor) / Number(totalStatutory)) * 100) : 0,
        }));

        return {
          title,
          subtitle,
          heroLabel,
          heroAmountMinor: totalStatutory,
          segmentHeader,
          rows: items,
          unitLabel: 'of statutory deductions',
        };
      }

      case 'net-worth':
      default: {
        const title = 'Net Worth Growth Trajectory';
        const subtitle = 'Consolidated balance sheet assets vs. liabilities';
        const heroLabel = 'Current Net Worth';
        const segmentHeader = 'Account & Asset Balances';

        let totalAssets = 0n;
        const items = dbAccounts
          .filter((acc) => !acc.archived)
          .map((acc) => {
            const bal = accountBalances.get(acc.id) ?? 0n;
            if (bal > 0n) totalAssets += bal;
            return {
              label: `${acc.name} (${acc.type})`,
              amountMinor: bal,
              percent: 0,
            };
          })
          .map((item) => ({
            ...item,
            percent: totalAssets > 0n && item.amountMinor > 0n ? Math.round((Number(item.amountMinor) / Number(totalAssets)) * 100) : 0,
          }));

        return {
          title,
          subtitle,
          heroLabel,
          heroAmountMinor: netWorthMinor,
          segmentHeader,
          rows: items,
          unitLabel: 'of total assets',
        };
      }
    }
  }, [id, dbEvents, dbCategories, dbAccounts, dbPayees, accountBalances, netWorthMinor]);

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
            {reportConfig.title}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {reportConfig.subtitle}
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
            {reportConfig.heroLabel}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fonts.light,
              fontSize: typography.sizes.hero,
              marginTop: spacing.xxs,
            }}
          >
            {formatNaira(reportConfig.heroAmountMinor)}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
              marginTop: 2,
            }}
          >
            {reportConfig.rows.length > 0
              ? `Computed across ${reportConfig.rows.length} reporting segments`
              : 'Awaiting transaction data for this reporting period'}
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
          {reportConfig.segmentHeader}
        </Text>

        {reportConfig.rows.length === 0 ? (
          <View
            style={[
              styles.breakdownRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                borderRadius: radii.md,
                padding: spacing.xl,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: typography.fonts.regular,
                fontSize: typography.sizes.bodySm,
              }}
            >
              No transactions recorded in this period.
            </Text>
          </View>
        ) : (
          reportConfig.rows.map((row) => (
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
                {row.percent}% {reportConfig.unitLabel}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Export Menu Sheet */}
      <ExportMenuSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        reportTitle={reportConfig.title}
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

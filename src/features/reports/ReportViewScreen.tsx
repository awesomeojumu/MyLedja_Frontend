import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Landmark,
  Plus,
  Calendar,
  Info,
  CreditCard,
  PiggyBank,
  Receipt,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { ExportMenuSheet } from './ExportMenuSheet';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';

type TimeHorizon = '1M' | '3M' | '6M' | 'YTD' | 'ALL';

export function ReportViewScreen() {
  const { colors, typography, spacing, radii } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Live Database Hook
  const {
    events: dbEvents,
    categories: dbCategories,
    accounts: dbAccounts,
    accountBalances,
    netWorthMinor,
  } = useDatabaseData();

  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('1M');
  const [exportVisible, setExportVisible] = useState(false);
  const [chartWidth, setChartWidth] = useState<number>(340);
  const [activeChartIndex, setActiveChartIndex] = useState<number | null>(null);

  const onChartLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartWidth(w);
  };

  // 1. Balance Sheet Classifications for Net Worth
  const {
    totalAssetsMinor,
    totalLiabilitiesMinor,
    solvencyRatio,
    liquidAccounts,
    investmentAccounts,
    liabilityAccounts,
  } = useMemo(() => {
    let assets = 0n;
    let liabilities = 0n;

    const liquid: Array<{ id: string; name: string; type: string; balanceMinor: bigint }> = [];
    const investments: Array<{ id: string; name: string; type: string; balanceMinor: bigint }> = [];
    const liab: Array<{ id: string; name: string; type: string; balanceMinor: bigint }> = [];

    for (const acc of dbAccounts) {
      if (acc.archived) continue;
      const bal = accountBalances.get(acc.id) ?? 0n;
      const isNegative = bal < 0n;

      if (acc.type === 'other_liability' || acc.type === 'card' || isNegative) {
        const debtAmt = isNegative ? -bal : bal;
        liabilities += debtAmt;
        liab.push({ id: acc.id, name: acc.name, type: acc.type, balanceMinor: debtAmt });
      } else if (acc.type === 'investment' || acc.type === 'pension' || acc.type === 'property') {
        assets += bal;
        investments.push({ id: acc.id, name: acc.name, type: acc.type, balanceMinor: bal });
      } else {
        assets += bal;
        liquid.push({ id: acc.id, name: acc.name, type: acc.type, balanceMinor: bal });
      }
    }

    const ratio = assets > 0n ? Math.min(100, Math.round((Number(liabilities) / Number(assets)) * 100)) : 0;

    return {
      totalAssetsMinor: assets,
      totalLiabilitiesMinor: liabilities,
      solvencyRatio: ratio,
      liquidAccounts: liquid,
      investmentAccounts: investments,
      liabilityAccounts: liab,
    };
  }, [dbAccounts, accountBalances]);

  // 2. Trajectory Points for Net Worth Growth Chart
  const trajectoryPoints = useMemo(() => {
    const labelsByHorizon: Record<TimeHorizon, string[]> = {
      '1M': ['Week 1', 'Week 2', 'Week 3', 'Current'],
      '3M': ['Month 1', 'Month 2', 'Current'],
      '6M': ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Current'],
      'YTD': ['Jan', 'Apr', 'Jul', 'Oct', 'Current'],
      'ALL': ['2024', '2025', '2026'],
    };
    const labels = labelsByHorizon[timeHorizon] || labelsByHorizon['1M'];

    return labels.map((label, idx) => {
      const isCurrent = idx === labels.length - 1;
      const amount = isCurrent ? netWorthMinor : 0n;
      return {
        label,
        amountMinor: amount,
      };
    });
  }, [timeHorizon, netWorthMinor]);

  // 3. Category Expenses & Tier Allocation
  const { categoryRows, totalCategoryExpense, tierBreakdown, topCategoryName } = useMemo(() => {
    const catMap: Record<string, { name: string; amountMinor: bigint; icon?: string }> = {};
    let totalExpense = 0n;

    let needsMinor = 0n;
    let wantsMinor = 0n;
    let savingsMinor = 0n;
    let spiritualMinor = 0n;

    for (const ev of dbEvents) {
      if (ev.status !== 'posted' || ev.type !== 'expense') continue;
      for (const line of ev.lines) {
        if (line.amountMinor > 0n) {
          const amt = line.amountMinor;
          const cat = dbCategories.find((c) => c.id === line.ledgerAccountId);
          const name = cat?.name || 'General Spending';
          if (!catMap[name]) {
            catMap[name] = { name, amountMinor: 0n, icon: cat?.icon ?? undefined };
          }
          catMap[name]!.amountMinor += amt;
          totalExpense += amt;

          const lower = name.toLowerCase();
          if (lower.includes('housing') || lower.includes('food') || lower.includes('transport') || lower.includes('util') || lower.includes('health')) {
            needsMinor += amt;
          } else if (lower.includes('tithe') || lower.includes('spiritual')) {
            spiritualMinor += amt;
          } else if (lower.includes('saving') || lower.includes('invest') || lower.includes('pension')) {
            savingsMinor += amt;
          } else {
            wantsMinor += amt;
          }
        }
      }
    }

    const rows = Object.values(catMap)
      .sort((a, b) => (b.amountMinor > a.amountMinor ? 1 : -1))
      .map((item) => ({
        ...item,
        percent: totalExpense > 0n ? Math.round((Number(item.amountMinor) / Number(totalExpense)) * 100) : 0,
      }));

    return {
      categoryRows: rows,
      totalCategoryExpense: totalExpense,
      topCategoryName: rows[0]?.name || 'None Recorded',
      tierBreakdown: {
        needsMinor,
        wantsMinor,
        savingsMinor,
        spiritualMinor,
      },
    };
  }, [dbEvents, dbCategories]);

  // 4. Cash Flow Delta (Income vs Expense)
  const { totalInflow, totalOutflow, netCashSurplus, retentionRate } = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;

    for (const ev of dbEvents) {
      if (ev.status !== 'posted') continue;
      let evAmt = 0n;
      for (const line of ev.lines) {
        if (line.amountMinor > 0n) evAmt += line.amountMinor;
      }
      if (ev.type === 'income' || ev.type === 'salary_gross') {
        inflow += evAmt;
      } else if (ev.type === 'expense') {
        outflow += evAmt;
      }
    }

    const surplus = inflow >= outflow ? inflow - outflow : -(outflow - inflow);
    const rate = inflow > 0n && surplus > 0n ? Math.round((Number(surplus) / Number(inflow)) * 100) : 0;

    return {
      totalInflow: inflow,
      totalOutflow: outflow,
      netCashSurplus: surplus,
      retentionRate: rate,
    };
  }, [dbEvents]);

  // 5. Statutory Deductions Breakdown
  const { statutoryRows, totalStatutoryDeductions, payeMinor, pensionMinor, nhfMinor } = useMemo(() => {
    const statutoryMap: Record<string, bigint> = {};
    let total = 0n;
    let paye = 0n;
    let pension = 0n;
    let nhf = 0n;

    for (const ev of dbEvents) {
      if (ev.status !== 'posted') continue;
      // 1. Gross salary deductions
      if (ev.type === 'salary_gross') {
        for (const line of ev.lines) {
          const acc = dbAccounts.find((a) => a.id === line.ledgerAccountId);
          const amt = line.amountMinor > 0n ? line.amountMinor : -line.amountMinor;
          if (acc?.type === 'pension') {
            statutoryMap['Pension (8% RSA Contribution)'] = (statutoryMap['Pension (8% RSA Contribution)'] || 0n) + amt;
            pension += amt;
            total += amt;
          } else if (line.ledgerAccountId.includes('tax') || line.ledgerAccountId.includes('taxes')) {
            statutoryMap['PAYE Personal Income Tax'] = (statutoryMap['PAYE Personal Income Tax'] || 0n) + amt;
            paye += amt;
            total += amt;
          }
        }
      }
      // 2. Direct expense transactions categorized to tax, pension, nhf, tithe, levy
      if (ev.type === 'expense') {
        for (const line of ev.lines) {
          const cat = dbCategories.find((c) => c.id === line.ledgerAccountId);
          const name = cat?.name || '';
          const lower = name.toLowerCase();
          if (
            lower.includes('tax') ||
            lower.includes('pension') ||
            lower.includes('nhf') ||
            lower.includes('tithe') ||
            lower.includes('levy')
          ) {
            const amt = line.amountMinor > 0n ? line.amountMinor : -line.amountMinor;
            statutoryMap[name] = (statutoryMap[name] || 0n) + amt;
            total += amt;
            if (lower.includes('tax')) paye += amt;
            else if (lower.includes('pension')) pension += amt;
            else if (lower.includes('nhf')) nhf += amt;
          }
        }
      }
    }

    const rows = Object.entries(statutoryMap).map(([label, amountMinor]) => ({
      label,
      amountMinor,
      percent: total > 0n ? Math.round((Number(amountMinor) / Number(total)) * 100) : 0,
    }));

    return {
      statutoryRows: rows,
      totalStatutoryDeductions: total,
      payeMinor: paye,
      pensionMinor: pension,
      nhfMinor: nhf,
    };
  }, [dbEvents, dbAccounts, dbCategories]);

  // Report configuration metadata
  const reportMeta = useMemo(() => {
    switch (id) {
      case 'spending-category':
        return {
          title: 'Monthly Spending by Category',
          subtitle: 'Visual breakdown of envelope expenses, top spend categories and variances',
        };
      case 'income-vs-expense':
        return {
          title: 'Income vs. Expense Delta',
          subtitle: 'Surplus cash flow retention per month compared against living burn',
        };
      case 'statutory-deductions':
        return {
          title: 'PAYE Tax & Pension Deductions',
          subtitle: 'Detailed statement of Nigerian PAYE, pension contributions and NHF',
        };
      case 'net-worth':
      default:
        return {
          title: 'Net Worth Growth Trajectory',
          subtitle: 'Consolidated balance sheet assets vs. liabilities trend',
        };
    }
  }, [id]);

  // SVG Chart Calculation for Net Worth
  const chartHeight = 150;
  const paddingHoriz = 20;
  const paddingTop = 20;
  const paddingBottom = 26;
  const effectiveWidth = Math.max(chartWidth - paddingHoriz * 2, 100);
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;

  const amounts = trajectoryPoints.map((p) => Number(p.amountMinor));
  const minVal = Math.min(...amounts, 0);
  const maxVal = Math.max(...amounts, 1);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const chartCoords = trajectoryPoints.map((p, idx) => {
    const x = paddingHoriz + (idx / (trajectoryPoints.length - 1 || 1)) * effectiveWidth;
    const y = paddingTop + effectiveHeight - ((Number(p.amountMinor) - minVal) / valRange) * effectiveHeight;
    return { x, y, point: p };
  });

  const linePath = chartCoords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    const prev = chartCoords[idx - 1]!;
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  const firstCoord = chartCoords[0]!;
  const lastCoord = chartCoords[chartCoords.length - 1]!;
  const bottomY = chartHeight - paddingBottom + 4;
  const areaPath = `${linePath} L ${lastCoord.x.toFixed(1)} ${bottomY} L ${firstCoord.x.toFixed(1)} ${bottomY} Z`;

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
            {reportMeta.title}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: typography.fonts.regular,
              fontSize: typography.sizes.xs,
            }}
          >
            {reportMeta.subtitle}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setExportVisible(true)}
          style={[
            styles.exportBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
            },
          ]}
        >
          <Download size={14} color="#FFFFFF" />
          <Text
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fonts.medium,
              fontSize: 12,
              marginLeft: 5,
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
        {/* Time Horizon Segment Switcher */}
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
              { id: '1M', label: '1 Month' },
              { id: '3M', label: '3 Months' },
              { id: '6M', label: '6 Months' },
              { id: 'YTD', label: 'Year to Date' },
              { id: 'ALL', label: 'All Time' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setTimeHorizon(tab.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: timeHorizon === tab.id ? colors.surface : 'transparent',
                  borderRadius: radii.full,
                  paddingVertical: 6,
                  flex: 1,
                  alignItems: 'center',
                },
              ]}
            >
              <Text
                style={{
                  color: timeHorizon === tab.id ? colors.primary : colors.textSecondary,
                  fontFamily: typography.fonts.medium,
                  fontSize: typography.sizes.xs,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* =========================================================================
            REPORT 1: NET WORTH GROWTH TRAJECTORY
        ========================================================================== */}
        {(!id || id === 'net-worth') && (
          <View>
            {/* Primary Net Worth Hero */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.xs,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Current Net Worth
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: 32,
                      marginTop: 4,
                    }}
                  >
                    {formatNaira(netWorthMinor)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.trendBadge,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 4,
                    },
                  ]}
                >
                  <ShieldCheck size={14} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: typography.fonts.semiBold,
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    Audited Balance Sheet
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: colors.textTertiary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                  marginTop: spacing.xs,
                }}
              >
                Consolidated balance of active banking accounts, assets, portfolios, and credit facilities.
              </Text>
            </View>

            {/* 3 Pillar Balance Sheet Metrics */}
            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                  <TrendingUp size={16} color={colors.statusSuccess} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.xs,
                      marginLeft: 6,
                    }}
                  >
                    Total Assets
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.md,
                  }}
                >
                  {formatNaira(totalAssetsMinor)}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: typography.fonts.regular,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {liquidAccounts.length + investmentAccounts.length} active holdings
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                  <TrendingDown size={16} color={totalLiabilitiesMinor > 0n ? colors.statusDanger : colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.xs,
                      marginLeft: 6,
                    }}
                  >
                    Total Liabilities
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.md,
                  }}
                >
                  {formatNaira(totalLiabilitiesMinor)}
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: typography.fonts.regular,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {liabilityAccounts.length} debt accounts
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.lg,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
                  <ShieldCheck size={16} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.xs,
                      marginLeft: 6,
                    }}
                  >
                    Debt Ratio
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.md,
                  }}
                >
                  {solvencyRatio}.0%
                </Text>
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontFamily: typography.fonts.regular,
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  Leverage safety index
                </Text>
              </View>
            </View>

            {/* Interactive Visual Net Worth Growth Trajectory Chart */}
            <View
              onLayout={onChartLayout}
              style={[
                styles.chartCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.bodySm,
                  }}
                >
                  Equity Progression Curve
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.xs,
                  }}
                >
                  Horizon: {timeHorizon}
                </Text>
              </View>

              <Svg width={chartWidth - 32} height={chartHeight}>
                <Defs>
                  <LinearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
                    <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
                  </LinearGradient>
                </Defs>

                {/* Horizontal Baseline Guideline */}
                <SvgLine
                  x1={paddingHoriz}
                  y1={bottomY}
                  x2={chartWidth - 32 - paddingHoriz}
                  y2={bottomY}
                  stroke={colors.borderSubtle}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Area and Line Curve */}
                <Path d={areaPath} fill="url(#nwGrad)" />
                <Path d={linePath} fill="none" stroke={colors.primary} strokeWidth="2.5" />

                {/* Interactive Points */}
                {chartCoords.map((pt, i) => (
                  <Circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={activeChartIndex === i ? 6 : 4}
                    fill={colors.surface}
                    stroke={colors.primary}
                    strokeWidth={activeChartIndex === i ? 3 : 2}
                    onPress={() => setActiveChartIndex(i)}
                  />
                ))}

                {/* Month/Week Axis Labels */}
                {chartCoords.map((pt, i) => (
                  <SvgText
                    key={`lbl-${i}`}
                    x={pt.x}
                    y={chartHeight - 6}
                    fill={colors.textTertiary}
                    fontSize="10"
                    fontFamily={typography.fonts.medium}
                    textAnchor="middle"
                  >
                    {pt.point.label}
                  </SvgText>
                ))}
              </Svg>

              <Text
                style={{
                  color: colors.textTertiary,
                  fontFamily: typography.fonts.regular,
                  fontSize: 11,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                }}
              >
                {netWorthMinor === 0n
                  ? 'Baseline equity flatlined at ₦0.00. Balances update dynamically as accounts sync.'
                  : `Active net worth trajectory tracked across ${trajectoryPoints.length} reporting checkpoints.`}
              </Text>
            </View>

            {/* Asset Allocation by Category Class */}
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fonts.semiBold,
                fontSize: typography.sizes.md,
                marginBottom: spacing.md,
              }}
            >
              Balance Sheet Account Allocation
            </Text>

            {dbAccounts.length === 0 ? (
              <View
                style={[
                  styles.zeroBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    borderRadius: radii.xl,
                    padding: spacing.xl,
                    alignItems: 'center',
                  },
                ]}
              >
                <Landmark size={36} color={colors.textTertiary} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: typography.sizes.body,
                    marginTop: spacing.md,
                  }}
                >
                  No Accounts Linked Yet
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: typography.fonts.regular,
                    fontSize: typography.sizes.bodySm,
                    textAlign: 'center',
                    marginTop: spacing.xs,
                    maxWidth: 360,
                  }}
                >
                  Link your bank accounts, investment portfolios, and loan facilities in the Accounts hub to track genuine balance sheet net worth.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/accounts' as any)}
                  style={[
                    styles.primaryActionBtn,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: 10,
                      marginTop: spacing.lg,
                      flexDirection: 'row',
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontFamily: typography.fonts.medium,
                      fontSize: typography.sizes.bodySm,
                      marginLeft: 6,
                    }}
                  >
                    Add First Account
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* Liquid Accounts */}
                {liquidAccounts.length > 0 && (
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[styles.classHeader, { color: colors.textSecondary }]}>
                      Liquid Cash & Banking ({liquidAccounts.length})
                    </Text>
                    {liquidAccounts.map((acc) => (
                      <View
                        key={acc.id}
                        style={[
                          styles.accountRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.borderSubtle,
                            borderRadius: radii.md,
                            padding: spacing.md,
                            marginBottom: spacing.xs,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                              {acc.name}
                            </Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'capitalize' }}>
                              {acc.type} account
                            </Text>
                          </View>
                          <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
                            {formatNaira(acc.balanceMinor)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Investment Accounts */}
                {investmentAccounts.length > 0 && (
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[styles.classHeader, { color: colors.textSecondary }]}>
                      Investments, Pension & Property ({investmentAccounts.length})
                    </Text>
                    {investmentAccounts.map((acc) => (
                      <View
                        key={acc.id}
                        style={[
                          styles.accountRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.borderSubtle,
                            borderRadius: radii.md,
                            padding: spacing.md,
                            marginBottom: spacing.xs,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                              {acc.name}
                            </Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'capitalize' }}>
                              {acc.type} portfolio
                            </Text>
                          </View>
                          <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>
                            {formatNaira(acc.balanceMinor)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Liabilities */}
                {liabilityAccounts.length > 0 && (
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={[styles.classHeader, { color: colors.textSecondary }]}>
                      Liabilities & Outstanding Debts ({liabilityAccounts.length})
                    </Text>
                    {liabilityAccounts.map((acc) => (
                      <View
                        key={acc.id}
                        style={[
                          styles.accountRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.borderSubtle,
                            borderRadius: radii.md,
                            padding: spacing.md,
                            marginBottom: spacing.xs,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View>
                            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>
                              {acc.name}
                            </Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'capitalize' }}>
                              {acc.type} obligation
                            </Text>
                          </View>
                          <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.semiBold }}>
                            -{formatNaira(acc.balanceMinor)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* =========================================================================
            REPORT 2: MONTHLY SPENDING BY CATEGORY
        ========================================================================== */}
        {id === 'spending-category' && (
          <View>
            {/* Primary Hero */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Category Spending
              </Text>
              <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: 32, marginTop: 4 }}>
                {formatNaira(totalCategoryExpense)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.xs, marginTop: spacing.xs }}>
                Tracked against active monthly envelope allocations and transaction ledgers.
              </Text>
            </View>

            {/* 3 Metric Cards */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>Top Category</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm, marginTop: 2 }}>
                  {topCategoryName}
                </Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>Active Envelopes</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm, marginTop: 2 }}>
                  {categoryRows.length} Envelopes
                </Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>Daily Run-Rate</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm, marginTop: 2 }}>
                  ₦0.00 / day
                </Text>
              </View>
            </View>

            {/* 50/30/20 Rule Distribution Bar */}
            <View
              style={[
                styles.tierCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm, marginBottom: spacing.xs }}>
                50 / 30 / 20 Budget Tier Alignment
              </Text>
              <View style={[styles.tierBarBg, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, height: 10, marginVertical: spacing.sm, overflow: 'hidden', flexDirection: 'row' }]}>
                <View style={{ width: totalCategoryExpense > 0n ? `${Math.round((Number(tierBreakdown.needsMinor) / Number(totalCategoryExpense)) * 100)}%` : '0%', backgroundColor: colors.primary }} />
                <View style={{ width: totalCategoryExpense > 0n ? `${Math.round((Number(tierBreakdown.wantsMinor) / Number(totalCategoryExpense)) * 100)}%` : '0%', backgroundColor: '#6366F1' }} />
                <View style={{ width: totalCategoryExpense > 0n ? `${Math.round((Number(tierBreakdown.savingsMinor) / Number(totalCategoryExpense)) * 100)}%` : '0%', backgroundColor: colors.statusSuccess }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Needs & Living: {formatNaira(tierBreakdown.needsMinor)}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Wants: {formatNaira(tierBreakdown.wantsMinor)}</Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>Reserves: {formatNaira(tierBreakdown.savingsMinor)}</Text>
              </View>
            </View>

            {/* Envelopes Schedule */}
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginBottom: spacing.md }}>
              Category Envelope Breakdown
            </Text>

            {categoryRows.length === 0 ? (
              <View style={[styles.zeroBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.xl, alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }}>
                  No category expenses recorded in this period.
                </Text>
              </View>
            ) : (
              categoryRows.map((cat) => (
                <View
                  key={cat.name}
                  style={[
                    styles.accountRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>{cat.name}</Text>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>{formatNaira(cat.amountMinor)}</Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, marginTop: spacing.sm }]}>
                    <View style={[styles.barFill, { width: `${cat.percent}%`, backgroundColor: colors.primary, borderRadius: radii.full }]} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                    {cat.percent}% of total category burn
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* =========================================================================
            REPORT 3: INCOME VS EXPENSE DELTA
        ========================================================================== */}
        {id === 'income-vs-expense' && (
          <View>
            {/* Primary Hero */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Net Cash Retention Surplus
              </Text>
              <Text style={{ color: netCashSurplus >= 0n ? colors.statusSuccess : colors.statusDanger, fontFamily: typography.fonts.semiBold, fontSize: 32, marginTop: 4 }}>
                {netCashSurplus >= 0n ? `+${formatNaira(netCashSurplus)}` : `-${formatNaira(-netCashSurplus)}`}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.xs, marginTop: spacing.xs }}>
                Operating cash surplus retained after funding living expenses and statutory commitments.
              </Text>
            </View>

            {/* Inflows vs Outflows Side by Side */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ArrowUpRight size={16} color={colors.statusSuccess} />
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginLeft: 6 }}>Total Inflow</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {formatNaira(totalInflow)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>Salary & Inflows</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ArrowDownRight size={16} color={colors.statusDanger} />
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginLeft: 6 }}>Total Outflow</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {formatNaira(totalOutflow)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>Living burn & bills</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <PiggyBank size={16} color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, marginLeft: 6 }}>Retention Rate</Text>
                </View>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {retentionRate}.0%
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>Savings yield</Text>
              </View>
            </View>

            {/* Schedule */}
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginBottom: spacing.md }}>
              Cash Flow Delta Schedule
            </Text>

            <View style={[styles.accountRow, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>Total Earned Inflow</Text>
                <Text style={{ color: colors.statusSuccess, fontFamily: typography.fonts.semiBold }}>+{formatNaira(totalInflow)}</Text>
              </View>
            </View>

            <View style={[styles.accountRow, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>Total Living & Fixed Outflows</Text>
                <Text style={{ color: colors.statusDanger, fontFamily: typography.fonts.semiBold }}>-{formatNaira(totalOutflow)}</Text>
              </View>
            </View>

            <View style={[styles.accountRow, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>Net Retained Surplus</Text>
                <Text style={{ color: netCashSurplus >= 0n ? colors.statusSuccess : colors.statusDanger, fontFamily: typography.fonts.semiBold }}>
                  {netCashSurplus >= 0n ? `+${formatNaira(netCashSurplus)}` : `-${formatNaira(-netCashSurplus)}`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* =========================================================================
            REPORT 4: PAYE TAX & PENSION DEDUCTIONS
        ========================================================================== */}
        {id === 'statutory-deductions' && (
          <View>
            {/* Primary Hero */}
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Statutory Deductions
              </Text>
              <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: 32, marginTop: 4 }}>
                {formatNaira(totalStatutoryDeductions)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: typography.sizes.xs, marginTop: spacing.xs }}>
                Audited statement of Nigerian PAYE personal income tax, pension contributions, and statutory withholdings.
              </Text>
            </View>

            {/* 3 Metric Cards */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>PAYE Income Tax</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {formatNaira(payeMinor)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>State IRS / FIRS</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>Pension (8% RSA)</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {formatNaira(pensionMinor)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>PRA 2014 compliant</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.lg, padding: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.xs }}>NHF & Levies</Text>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginTop: 4 }}>
                  {formatNaira(nhfMinor)}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 2 }}>Housing & estate</Text>
              </View>
            </View>

            {/* Statutory Compliance Explainer Card */}
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.xl,
                  flexDirection: 'row',
                },
              ]}
            >
              <Info size={18} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.bodySm }}>
                  Nigerian Statutory Compliance Note
                </Text>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.xs, marginTop: 2, lineHeight: 18 }}>
                  Under the Nigerian Personal Income Tax Act (PITA) and Pension Reform Act (PRA 2014), the 8% mandatory employee pension and NHF contributions qualify as statutory tax-exempt deductions prior to Consolidated Relief Allowance (CRA) computation.
                </Text>
              </View>
            </View>

            {/* Deductions Schedule */}
            <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold, fontSize: typography.sizes.md, marginBottom: spacing.md }}>
              Statutory Line Item Breakdown
            </Text>

            {statutoryRows.length === 0 ? (
              <View style={[styles.zeroBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderRadius: radii.md, padding: spacing.xl, alignItems: 'center' }]}>
                <Text style={{ color: colors.textSecondary, fontFamily: typography.fonts.regular, fontSize: typography.sizes.bodySm }}>
                  No statutory deductions recorded in this period.
                </Text>
              </View>
            ) : (
              statutoryRows.map((row) => (
                <View
                  key={row.label}
                  style={[
                    styles.accountRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.medium }}>{row.label}</Text>
                    <Text style={{ color: colors.textPrimary, fontFamily: typography.fonts.semiBold }}>{formatNaira(row.amountMinor)}</Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: colors.surfaceSubtle, borderRadius: radii.full, marginTop: spacing.sm }]}>
                    <View style={[styles.barFill, { width: `${row.percent}%`, backgroundColor: colors.primary, borderRadius: radii.full }]} />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                    {row.percent}% of total statutory deductions
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Export Menu Sheet */}
      <ExportMenuSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        reportTitle={reportMeta.title}
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
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
  },
  chartCard: {
    borderWidth: 1,
  },
  tierCard: {
    borderWidth: 1,
  },
  tierBarBg: {},
  classHeader: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: '600',
  },
  accountRow: {
    borderWidth: 1,
  },
  zeroBox: {
    borderWidth: 1,
  },
  primaryActionBtn: {},
  infoCard: {
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

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Plus, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export type TimeRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';
export type AccountFilter =
  | 'all'
  | 'income'
  | 'operating'
  | 'bills'
  | 'emergency'
  | 'savings'
  | 'investment'
  | 'project'
  | 'liability';

interface ChartPoint {
  date: string;
  amountMinor: bigint;
}

export interface NetAssetsHeroProps {
  totalAssetsMinor: bigint;
  totalLiabilitiesMinor: bigint;
  privacyMode: boolean;
  onAddAccount: () => void;
  activeFilter?: AccountFilter;
}

interface FilterTrajectory {
  title: string;
  ranges: Record<
    TimeRange,
    { points: ChartPoint[]; percent: string; isPositive: boolean; deltaMinor: bigint }
  >;
}

const FILTER_TRAJECTORIES: Record<AccountFilter, FilterTrajectory> = {
  all: {
    title: 'Total Net Assets',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 1285000000n },
          { date: '11 Nov', amountMinor: 1287000000n },
          { date: '12 Nov', amountMinor: 1286000000n },
          { date: '13 Nov', amountMinor: 1288000000n },
          { date: '14 Nov', amountMinor: 1283000000n },
          { date: '15 Nov', amountMinor: 1281000000n },
          { date: '16 Nov', amountMinor: 1308300000n },
        ],
        percent: '+1.8%',
        isPositive: true,
        deltaMinor: 23300000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 1245000000n },
          { date: '26 Oct', amountMinor: 1252000000n },
          { date: '03 Nov', amountMinor: 1261000000n },
          { date: '09 Nov', amountMinor: 1275000000n },
          { date: '16 Nov', amountMinor: 1308300000n },
        ],
        percent: '+5.1%',
        isPositive: true,
        deltaMinor: 63300000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 1180000000n },
          { date: 'Sep', amountMinor: 1215000000n },
          { date: 'Oct', amountMinor: 1245000000n },
          { date: 'Nov', amountMinor: 1308300000n },
        ],
        percent: '+10.9%',
        isPositive: true,
        deltaMinor: 128300000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 1020000000n },
          { date: 'Apr', amountMinor: 1095000000n },
          { date: 'Jul', amountMinor: 1150000000n },
          { date: 'Oct', amountMinor: 1245000000n },
          { date: 'Nov', amountMinor: 1308300000n },
        ],
        percent: '+28.3%',
        isPositive: true,
        deltaMinor: 288300000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 750000000n },
          { date: '2025', amountMinor: 1020000000n },
          { date: '2026', amountMinor: 1308300000n },
        ],
        percent: '+74.4%',
        isPositive: true,
        deltaMinor: 558300000n,
      },
    },
  },
  income: {
    title: 'Income Inflows',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 0n },
          { date: '12 Nov', amountMinor: 0n },
          { date: '14 Nov', amountMinor: 0n },
          { date: '16 Nov', amountMinor: 85000000n },
        ],
        percent: '+100%',
        isPositive: true,
        deltaMinor: 85000000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 75000000n },
          { date: '26 Oct', amountMinor: 78000000n },
          { date: '03 Nov', amountMinor: 78000000n },
          { date: '09 Nov', amountMinor: 80000000n },
          { date: '16 Nov', amountMinor: 85000000n },
        ],
        percent: '+13.3%',
        isPositive: true,
        deltaMinor: 10000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 70000000n },
          { date: 'Sep', amountMinor: 75000000n },
          { date: 'Oct', amountMinor: 78000000n },
          { date: 'Nov', amountMinor: 85000000n },
        ],
        percent: '+21.4%',
        isPositive: true,
        deltaMinor: 15000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 60000000n },
          { date: 'Apr', amountMinor: 65000000n },
          { date: 'Jul', amountMinor: 70000000n },
          { date: 'Oct', amountMinor: 78000000n },
          { date: 'Nov', amountMinor: 85000000n },
        ],
        percent: '+41.7%',
        isPositive: true,
        deltaMinor: 25000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 50000000n },
          { date: '2025', amountMinor: 65000000n },
          { date: '2026', amountMinor: 85000000n },
        ],
        percent: '+70.0%',
        isPositive: true,
        deltaMinor: 35000000n,
      },
    },
  },
  operating: {
    title: 'Operating Spending Cash',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 38000000n },
          { date: '12 Nov', amountMinor: 36500000n },
          { date: '14 Nov', amountMinor: 35200000n },
          { date: '16 Nov', amountMinor: 34500000n },
        ],
        percent: '-9.2%',
        isPositive: true,
        deltaMinor: -3500000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 42000000n },
          { date: '26 Oct', amountMinor: 39500000n },
          { date: '03 Nov', amountMinor: 38000000n },
          { date: '09 Nov', amountMinor: 36000000n },
          { date: '16 Nov', amountMinor: 34500000n },
        ],
        percent: '-17.8%',
        isPositive: true,
        deltaMinor: -7500000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 32000000n },
          { date: 'Sep', amountMinor: 35000000n },
          { date: 'Oct', amountMinor: 39500000n },
          { date: 'Nov', amountMinor: 34500000n },
        ],
        percent: '+7.8%',
        isPositive: true,
        deltaMinor: 2500000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 25000000n },
          { date: 'Apr', amountMinor: 28000000n },
          { date: 'Jul', amountMinor: 32000000n },
          { date: 'Oct', amountMinor: 39500000n },
          { date: 'Nov', amountMinor: 34500000n },
        ],
        percent: '+38.0%',
        isPositive: true,
        deltaMinor: 9500000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 20000000n },
          { date: '2025', amountMinor: 28000000n },
          { date: '2026', amountMinor: 34500000n },
        ],
        percent: '+72.5%',
        isPositive: true,
        deltaMinor: 14500000n,
      },
    },
  },
  bills: {
    title: 'Bills & Subscriptions Reserve',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 21000000n },
          { date: '12 Nov', amountMinor: 21000000n },
          { date: '14 Nov', amountMinor: 21000000n },
          { date: '16 Nov', amountMinor: 21000000n },
        ],
        percent: '0.0%',
        isPositive: true,
        deltaMinor: 0n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 19500000n },
          { date: '26 Oct', amountMinor: 20000000n },
          { date: '03 Nov', amountMinor: 20500000n },
          { date: '09 Nov', amountMinor: 21000000n },
          { date: '16 Nov', amountMinor: 21000000n },
        ],
        percent: '+7.7%',
        isPositive: true,
        deltaMinor: 1500000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 18000000n },
          { date: 'Sep', amountMinor: 19000000n },
          { date: 'Oct', amountMinor: 20000000n },
          { date: 'Nov', amountMinor: 21000000n },
        ],
        percent: '+16.7%',
        isPositive: true,
        deltaMinor: 3000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 15000000n },
          { date: 'Apr', amountMinor: 16500000n },
          { date: 'Jul', amountMinor: 18000000n },
          { date: 'Oct', amountMinor: 20000000n },
          { date: 'Nov', amountMinor: 21000000n },
        ],
        percent: '+40.0%',
        isPositive: true,
        deltaMinor: 6000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 12000000n },
          { date: '2025', amountMinor: 16000000n },
          { date: '2026', amountMinor: 21000000n },
        ],
        percent: '+75.0%',
        isPositive: true,
        deltaMinor: 9000000n,
      },
    },
  },
  emergency: {
    title: 'Emergency Fund Reserves',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 45000000n },
          { date: '12 Nov', amountMinor: 45000000n },
          { date: '14 Nov', amountMinor: 45000000n },
          { date: '16 Nov', amountMinor: 45000000n },
        ],
        percent: '0.0%',
        isPositive: true,
        deltaMinor: 0n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 38000000n },
          { date: '26 Oct', amountMinor: 40000000n },
          { date: '03 Nov', amountMinor: 42000000n },
          { date: '09 Nov', amountMinor: 44000000n },
          { date: '16 Nov', amountMinor: 45000000n },
        ],
        percent: '+18.4%',
        isPositive: true,
        deltaMinor: 7000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 30000000n },
          { date: 'Sep', amountMinor: 35000000n },
          { date: 'Oct', amountMinor: 40000000n },
          { date: 'Nov', amountMinor: 45000000n },
        ],
        percent: '+50.0%',
        isPositive: true,
        deltaMinor: 15000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 20000000n },
          { date: 'Apr', amountMinor: 25000000n },
          { date: 'Jul', amountMinor: 30000000n },
          { date: 'Oct', amountMinor: 40000000n },
          { date: 'Nov', amountMinor: 45000000n },
        ],
        percent: '+125.0%',
        isPositive: true,
        deltaMinor: 25000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 15000000n },
          { date: '2025', amountMinor: 25000000n },
          { date: '2026', amountMinor: 45000000n },
        ],
        percent: '+200.0%',
        isPositive: true,
        deltaMinor: 30000000n,
      },
    },
  },
  savings: {
    title: 'Target Savings Pot',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 34000000n },
          { date: '12 Nov', amountMinor: 34500000n },
          { date: '14 Nov', amountMinor: 34800000n },
          { date: '16 Nov', amountMinor: 35000000n },
        ],
        percent: '+2.9%',
        isPositive: true,
        deltaMinor: 1000000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 28500000n },
          { date: '26 Oct', amountMinor: 30000000n },
          { date: '03 Nov', amountMinor: 32000000n },
          { date: '09 Nov', amountMinor: 34000000n },
          { date: '16 Nov', amountMinor: 35000000n },
        ],
        percent: '+22.8%',
        isPositive: true,
        deltaMinor: 6500000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 22000000n },
          { date: 'Sep', amountMinor: 25500000n },
          { date: 'Oct', amountMinor: 30000000n },
          { date: 'Nov', amountMinor: 35000000n },
        ],
        percent: '+59.1%',
        isPositive: true,
        deltaMinor: 13000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 15000000n },
          { date: 'Apr', amountMinor: 18500000n },
          { date: 'Jul', amountMinor: 22000000n },
          { date: 'Oct', amountMinor: 30000000n },
          { date: 'Nov', amountMinor: 35000000n },
        ],
        percent: '+133.3%',
        isPositive: true,
        deltaMinor: 20000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 10000000n },
          { date: '2025', amountMinor: 18000000n },
          { date: '2026', amountMinor: 35000000n },
        ],
        percent: '+250.0%',
        isPositive: true,
        deltaMinor: 25000000n,
      },
    },
  },
  investment: {
    title: 'Investments & Wealth Portfolio',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 1050000000n },
          { date: '16 Nov', amountMinor: 1050000000n },
        ],
        percent: '0.0%',
        isPositive: true,
        deltaMinor: 0n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 1010000000n },
          { date: '26 Oct', amountMinor: 1015000000n },
          { date: '03 Nov', amountMinor: 1030000000n },
          { date: '16 Nov', amountMinor: 1050000000n },
        ],
        percent: '+4.0%',
        isPositive: true,
        deltaMinor: 40000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 975000000n },
          { date: 'Sep', amountMinor: 990000000n },
          { date: 'Oct', amountMinor: 1015000000n },
          { date: 'Nov', amountMinor: 1050000000n },
        ],
        percent: '+7.7%',
        isPositive: true,
        deltaMinor: 75000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 850000000n },
          { date: 'Apr', amountMinor: 900000000n },
          { date: 'Jul', amountMinor: 950000000n },
          { date: 'Oct', amountMinor: 1015000000n },
          { date: 'Nov', amountMinor: 1050000000n },
        ],
        percent: '+23.5%',
        isPositive: true,
        deltaMinor: 200000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 600000000n },
          { date: '2025', amountMinor: 850000000n },
          { date: '2026', amountMinor: 1050000000n },
        ],
        percent: '+75.0%',
        isPositive: true,
        deltaMinor: 450000000n,
      },
    },
  },
  project: {
    title: 'Project Accounts Targets',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 38000000n },
          { date: '12 Nov', amountMinor: 38500000n },
          { date: '14 Nov', amountMinor: 38800000n },
          { date: '16 Nov', amountMinor: 39000000n },
        ],
        percent: '+2.6%',
        isPositive: true,
        deltaMinor: 1000000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 30000000n },
          { date: '26 Oct', amountMinor: 33000000n },
          { date: '03 Nov', amountMinor: 36000000n },
          { date: '09 Nov', amountMinor: 38000000n },
          { date: '16 Nov', amountMinor: 39000000n },
        ],
        percent: '+30.0%',
        isPositive: true,
        deltaMinor: 9000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 20000000n },
          { date: 'Sep', amountMinor: 25000000n },
          { date: 'Oct', amountMinor: 33000000n },
          { date: 'Nov', amountMinor: 39000000n },
        ],
        percent: '+95.0%',
        isPositive: true,
        deltaMinor: 19000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 10000000n },
          { date: 'Apr', amountMinor: 15000000n },
          { date: 'Jul', amountMinor: 20000000n },
          { date: 'Oct', amountMinor: 33000000n },
          { date: 'Nov', amountMinor: 39000000n },
        ],
        percent: '+290.0%',
        isPositive: true,
        deltaMinor: 29000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 5000000n },
          { date: '2025', amountMinor: 15000000n },
          { date: '2026', amountMinor: 39000000n },
        ],
        percent: '+680.0%',
        isPositive: true,
        deltaMinor: 34000000n,
      },
    },
  },
  liability: {
    title: 'Credit & Liabilities Owed',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 1500000n },
          { date: '12 Nov', amountMinor: 1400000n },
          { date: '14 Nov', amountMinor: 1350000n },
          { date: '16 Nov', amountMinor: 1200000n },
        ],
        percent: '-20.0%',
        isPositive: true,
        deltaMinor: -300000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 4500000n },
          { date: '26 Oct', amountMinor: 3800000n },
          { date: '03 Nov', amountMinor: 2500000n },
          { date: '09 Nov', amountMinor: 1800000n },
          { date: '16 Nov', amountMinor: 1200000n },
        ],
        percent: '-73.3%',
        isPositive: true,
        deltaMinor: -3300000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 7500000n },
          { date: 'Sep', amountMinor: 5800000n },
          { date: 'Oct', amountMinor: 4500000n },
          { date: 'Nov', amountMinor: 1200000n },
        ],
        percent: '-84.0%',
        isPositive: true,
        deltaMinor: -6300000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 12000000n },
          { date: 'Apr', amountMinor: 9500000n },
          { date: 'Jul', amountMinor: 8200000n },
          { date: 'Oct', amountMinor: 4500000n },
          { date: 'Nov', amountMinor: 1200000n },
        ],
        percent: '-90.0%',
        isPositive: true,
        deltaMinor: -10800000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 15000000n },
          { date: '2025', amountMinor: 11000000n },
          { date: '2026', amountMinor: 1200000n },
        ],
        percent: '-92.0%',
        isPositive: true,
        deltaMinor: -13800000n,
      },
    },
  },
};

export function NetAssetsHero({
  totalAssetsMinor,
  totalLiabilitiesMinor,
  privacyMode,
  onAddAccount,
  activeFilter = 'all',
}: NetAssetsHeroProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(340);

  const activeCategoryTrajectory =
    FILTER_TRAJECTORIES[activeFilter] ?? FILTER_TRAJECTORIES.all;
  const activeTrend =
    activeCategoryTrajectory.ranges[selectedRange] ??
    activeCategoryTrajectory.ranges['1M'];
  const points = activeTrend.points;

  const currentPoint =
    activePointIndex !== null && points[activePointIndex]
      ? points[activePointIndex]
      : points[points.length - 1]!;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const chartHeight = 125;
  const paddingHoriz = 12;
  const paddingTop = 14;
  const paddingBottom = 20;
  const effectiveWidth = Math.max(containerWidth - paddingHoriz * 2, 80);
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;

  const amounts = points.map((p) => Number(p.amountMinor));
  const minVal = Math.min(...amounts);
  const maxVal = Math.max(...amounts);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const coords = points.map((p, idx) => {
    const x = paddingHoriz + (idx / (points.length - 1 || 1)) * effectiveWidth;
    const y =
      paddingTop +
      effectiveHeight -
      ((Number(p.amountMinor) - minVal) / valRange) * effectiveHeight;
    return { x, y, point: p };
  });

  const linePath = coords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    const prev = coords[idx - 1]!;
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  const firstCoord = coords[0]!;
  const lastCoord = coords[coords.length - 1]!;
  const bottomY = chartHeight - paddingBottom + 4;
  const areaPath = `${linePath} L ${lastCoord.x.toFixed(1)} ${bottomY} L ${firstCoord.x.toFixed(1)} ${bottomY} Z`;

  const activeCoord =
    activePointIndex !== null && coords[activePointIndex]
      ? coords[activePointIndex]
      : coords[coords.length - 1]!;

  const netWorthMinor = totalAssetsMinor - totalLiabilitiesMinor;
  const displayedAmount =
    activeFilter === 'all'
      ? activePointIndex !== null
        ? currentPoint.amountMinor
        : netWorthMinor
      : activePointIndex !== null
      ? currentPoint.amountMinor
      : currentPoint.amountMinor;

  const strokeColor =
    activeFilter === 'liability' ? colors.statusDanger : colors.primary;
  const gradientId = `heroNetWorthGradient_${activeFilter}`;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.xl,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        },
      ]}
    >
      {/* 1. Top Header Row: Label & Add Account button */}
      <View style={styles.topRow}>
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontFamily: typography.fonts.medium,
              fontSize: typography.sizes.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            },
          ]}
        >
          {activeCategoryTrajectory.title}
        </Text>

        <TouchableOpacity
          onPress={onAddAccount}
          activeOpacity={0.8}
          style={[
            styles.addAccountBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: radii.full,
              paddingVertical: 6,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text
            style={[
              styles.addAccountBtnText,
              {
                color: '#FFFFFF',
                fontFamily: typography.fonts.medium,
                fontSize: 12,
                marginLeft: 4,
              },
            ]}
          >
            Add Account
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Single Balance Amount Row with Trend Badge & Timeframes */}
      <View style={styles.amountAndControlsRow}>
        <View style={styles.amountDeltaGroup}>
          <Text
            style={[
              styles.amount,
              {
                color: activeFilter === 'liability' ? colors.statusDanger : colors.textPrimary,
                fontFamily: typography.fonts.light,
                fontSize: typography.sizes.hero,
              },
            ]}
          >
            {privacyMode
              ? '₦••••••••'
              : activeFilter === 'liability'
              ? `−${formatNaira(displayedAmount)}`
              : formatNaira(displayedAmount)}
          </Text>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: activeTrend.isPositive
                  ? colors.statusSuccessLight
                  : colors.statusDangerLight,
                borderRadius: radii.full,
                marginLeft: spacing.xs + 2,
              },
            ]}
          >
            {activeTrend.isPositive ? (
              <TrendingUp size={12} color={colors.statusSuccess} />
            ) : (
              <TrendingDown size={12} color={colors.statusDanger} />
            )}
            <Text
              style={[
                styles.badgeText,
                {
                  color: activeTrend.isPositive ? colors.statusSuccess : colors.statusDanger,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: 11,
                  marginLeft: 2,
                },
              ]}
            >
              {activeTrend.percent}
            </Text>
          </View>
        </View>

        {/* Timeframe Chips */}
        <View style={styles.timeframeRow}>
          {(['1W', '1M', '3M', 'YTD', 'ALL'] as TimeRange[]).map((range) => {
            const isSelected = selectedRange === range;
            return (
              <TouchableOpacity
                key={range}
                onPress={() => {
                  setSelectedRange(range);
                  setActivePointIndex(null);
                }}
                style={[
                  styles.rangeBtn,
                  {
                    backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                    borderRadius: radii.full,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textSecondary,
                    fontFamily: isSelected ? typography.fonts.semiBold : typography.fonts.medium,
                    fontSize: 11,
                  }}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Integrated SVG Trend Curve */}
      <View style={[styles.svgWrapper, { height: chartHeight }]}>
        <Svg width={containerWidth - spacing.lg * 2} height={chartHeight}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Area Fill */}
          <Path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Trend Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Highlight Marker */}
          {activeCoord && (
            <>
              <Line
                x1={activeCoord.x}
                y1={paddingTop - 4}
                x2={activeCoord.x}
                y2={bottomY}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={6}
                fill={activeFilter === 'liability' ? colors.statusDangerLight : colors.primaryLight}
              />
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={3.5}
                fill={strokeColor}
              />
            </>
          )}

          {/* X-Axis Date Labels: 4 clean markers */}
          {(() => {
            const indices = [
              0,
              Math.floor(coords.length * 0.33),
              Math.floor(coords.length * 0.66),
              coords.length - 1,
            ].filter((val, idx, arr) => arr.indexOf(val) === idx);

            return indices.map((idx) => {
              const c = coords[idx];
              if (!c) return null;
              const isFirst = idx === 0;
              const isLast = idx === coords.length - 1;
              const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
              const xPos = isFirst ? c.x + 4 : isLast ? c.x - 4 : c.x;

              return (
                <SvgText
                  key={idx}
                  x={xPos}
                  y={chartHeight - 4}
                  fontSize="10"
                  fill={colors.textTertiary}
                  textAnchor={textAnchor}
                  fontFamily={typography.fonts.medium}
                >
                  {c.point.date}
                </SvgText>
              );
            });
          })()}
        </Svg>

        {/* Touchable Points Row */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.touchablePointsRow}>
            {coords.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setActivePointIndex(idx)}
                style={styles.touchablePointArea}
                activeOpacity={0.8}
              />
            ))}
          </View>
        </View>
      </View>

      {/* 4. Assets vs Liabilities Breakdown */}
      <View
        style={[
          styles.breakdownRow,
          {
            marginTop: spacing.sm,
            paddingTop: spacing.sm,
            borderTopColor: colors.borderSubtle,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={styles.col}>
          <View style={styles.labelRow}>
            <ArrowDownLeft size={14} color={colors.primary} />
            <Text
              style={[
                styles.colLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                  marginLeft: 4,
                },
              ]}
            >
              Assets (What you own)
            </Text>
          </View>
          <Text
            style={[
              styles.colValue,
              {
                color: colors.primary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.md,
                marginTop: 2,
              },
            ]}
          >
            {privacyMode ? '••••' : formatNaira(totalAssetsMinor)}
          </Text>
        </View>

        <View style={styles.col}>
          <View style={styles.labelRow}>
            <ArrowUpRight size={14} color={colors.statusDanger} />
            <Text
              style={[
                styles.colLabel,
                {
                  color: colors.textSecondary,
                  fontFamily: typography.fonts.regular,
                  fontSize: typography.sizes.xs,
                  marginLeft: 4,
                },
              ]}
            >
              Liabilities (What you owe)
            </Text>
          </View>
          <Text
            style={[
              styles.colValue,
              {
                color: colors.statusDanger,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.md,
                marginTop: 2,
              },
            ]}
          >
            {privacyMode ? '••••' : formatNaira(totalLiabilitiesMinor)}
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
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  subtitle: {
    letterSpacing: 0.5,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addAccountBtnText: {},
  amountAndControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  amountDeltaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    letterSpacing: -0.8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {},
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rangeBtn: {},
  svgWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 2,
  },
  touchablePointsRow: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
  },
  touchablePointArea: {
    flex: 1,
    height: '100%',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colLabel: {},
  colValue: {
    letterSpacing: -0.2,
  },
});

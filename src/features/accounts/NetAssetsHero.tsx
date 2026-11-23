import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Plus, ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { balanceHistory } from './balanceHistory';
import { purposeOf } from './purpose';

import { t } from '../../i18n';
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


export interface NetAssetsHeroProps {
  totalAssetsMinor: bigint;
  totalLiabilitiesMinor: bigint;
  privacyMode: boolean;
  onAddAccount: () => void;
  activeFilter?: AccountFilter;
}

const FILTER_TITLES: Record<AccountFilter, string> = {
  all: 'Total Net Assets',
  income: 'Income Inflows',
  operating: 'Operating Spending Cash',
  bills: 'Bills & Subscriptions Reserve',
  emergency: 'Emergency Fund Reserves',
  savings: 'Target Savings Pot',
  investment: 'Investments & Wealth Portfolio',
  project: 'Project Accounts Targets',
  liability: 'Credit & Liabilities Owed',
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

  const { accounts, events } = useDatabaseData();

  // Real history: the accounts in the current filter, balance on each date from the posted events.
  const activeTrend = React.useMemo(() => {
    const ids = accounts
      .filter((a) => !a.archived || a.closedWithBalance)
      .filter((a) => {
        if (activeFilter === 'all') return true;
        const shown = purposeOf(a);
        if (activeFilter === 'liability') return shown === 'credit' || shown === 'loan';
        if (activeFilter === 'investment') return shown === 'investment' || shown === 'property';
        return shown === activeFilter;
      })
      .map((a) => a.id);
    const history = balanceHistory(ids, events, selectedRange);
    if (activeFilter !== 'liability') return history;
    // What you owe, as a positive figure.
    const points = history.points.map((p) => ({ ...p, amountMinor: -p.amountMinor }));
    return { ...history, points, deltaMinor: -history.deltaMinor, isPositive: history.deltaMinor >= 0n };
  }, [accounts, events, activeFilter, selectedRange]);

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

  // The last point is today's balance for the accounts in the filter.
  const displayedAmount = currentPoint.amountMinor;

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
          {FILTER_TITLES[activeFilter] ?? FILTER_TITLES.all}
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
            {t('ui.netAssetsHero.addAccount')}
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
              {t('ui.netAssetsHero.assetsWhatYouOwn')}
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
              {t('ui.netAssetsHero.liabilitiesWhatYouOwe')}
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

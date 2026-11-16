import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';

export type AccountFilter = 'all' | 'liquid' | 'liability' | 'investment';
export type TimeRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';

interface ChartPoint {
  date: string;
  amountMinor: bigint;
}

interface AccountsOverviewChartProps {
  activeFilter: AccountFilter;
  totalNetAssetsMinor: bigint;
  totalAssetsMinor: bigint;
  totalLiabilitiesMinor: bigint;
}

interface FilterTimeframeData {
  title: string;
  ranges: Record<TimeRange, { points: ChartPoint[]; percent: string; isPositive: boolean; deltaMinor: bigint }>;
}

const OVERVIEW_DATA: Record<AccountFilter, FilterTimeframeData> = {
  all: {
    title: 'NET ASSETS TREND',
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
  liquid: {
    title: 'LIQUID CASH & BANK TREND',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 86200000n },
          { date: '12 Nov', amountMinor: 85250000n },
          { date: '14 Nov', amountMinor: 80400000n },
          { date: '16 Nov', amountMinor: 109500000n },
        ],
        percent: '+27.0%',
        isPositive: true,
        deltaMinor: 23300000n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 78500000n },
          { date: '26 Oct', amountMinor: 82000000n },
          { date: '03 Nov', amountMinor: 81000000n },
          { date: '09 Nov', amountMinor: 75000000n },
          { date: '16 Nov', amountMinor: 109500000n },
        ],
        percent: '+39.5%',
        isPositive: true,
        deltaMinor: 31000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 65000000n },
          { date: 'Sep', amountMinor: 72000000n },
          { date: 'Oct', amountMinor: 78500000n },
          { date: 'Nov', amountMinor: 109500000n },
        ],
        percent: '+68.5%',
        isPositive: true,
        deltaMinor: 44500000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 45000000n },
          { date: 'Apr', amountMinor: 55000000n },
          { date: 'Jul', amountMinor: 62000000n },
          { date: 'Oct', amountMinor: 78500000n },
          { date: 'Nov', amountMinor: 109500000n },
        ],
        percent: '+143.3%',
        isPositive: true,
        deltaMinor: 64500000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 30000000n },
          { date: '2025', amountMinor: 52000000n },
          { date: '2026', amountMinor: 109500000n },
        ],
        percent: '+265.0%',
        isPositive: true,
        deltaMinor: 79500000n,
      },
    },
  },
  liability: {
    title: 'LIABILITIES & DEBT TREND',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 1500000n },
          { date: '12 Nov', amountMinor: 1400000n },
          { date: '14 Nov', amountMinor: 1350000n },
          { date: '16 Nov', amountMinor: 1200000n },
        ],
        percent: '-20.0%',
        isPositive: true, // Lower liabilities is positive!
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
  investment: {
    title: 'INVESTMENTS & PROPERTY TREND',
    ranges: {
      '1W': {
        points: [
          { date: '10 Nov', amountMinor: 1200000000n },
          { date: '16 Nov', amountMinor: 1200000000n },
        ],
        percent: '0.0%',
        isPositive: true,
        deltaMinor: 0n,
      },
      '1M': {
        points: [
          { date: '18 Oct', amountMinor: 1160000000n },
          { date: '26 Oct', amountMinor: 1160000000n },
          { date: '03 Nov', amountMinor: 1180000000n },
          { date: '16 Nov', amountMinor: 1200000000n },
        ],
        percent: '+3.4%',
        isPositive: true,
        deltaMinor: 40000000n,
      },
      '3M': {
        points: [
          { date: 'Aug', amountMinor: 1115000000n },
          { date: 'Sep', amountMinor: 1135000000n },
          { date: 'Oct', amountMinor: 1160000000n },
          { date: 'Nov', amountMinor: 1200000000n },
        ],
        percent: '+7.6%',
        isPositive: true,
        deltaMinor: 85000000n,
      },
      'YTD': {
        points: [
          { date: 'Jan', amountMinor: 970000000n },
          { date: 'Apr', amountMinor: 1030000000n },
          { date: 'Jul', amountMinor: 1080000000n },
          { date: 'Oct', amountMinor: 1160000000n },
          { date: 'Nov', amountMinor: 1200000000n },
        ],
        percent: '+23.7%',
        isPositive: true,
        deltaMinor: 230000000n,
      },
      'ALL': {
        points: [
          { date: '2024', amountMinor: 705000000n },
          { date: '2025', amountMinor: 957000000n },
          { date: '2026', amountMinor: 1200000000n },
        ],
        percent: '+70.2%',
        isPositive: true,
        deltaMinor: 495000000n,
      },
    },
  },
};

export function AccountsOverviewChart({
  activeFilter,
  totalNetAssetsMinor,
  totalAssetsMinor,
  totalLiabilitiesMinor,
}: AccountsOverviewChartProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(340);

  const filterCategoryData = OVERVIEW_DATA[activeFilter] ?? OVERVIEW_DATA.all;
  const timeframeData = filterCategoryData.ranges[selectedRange] ?? filterCategoryData.ranges['1M'];
  const points = timeframeData.points;

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

  const chartHeight = 145;
  const paddingHoriz = 16;
  const paddingTop = 20;
  const paddingBottom = 24;
  const effectiveWidth = Math.max(containerWidth - paddingHoriz * 2, 100);
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;

  const amounts = points.map((p) => Number(p.amountMinor));
  const minVal = Math.min(...amounts);
  const maxVal = Math.max(...amounts);
  const valRange = maxVal - minVal === 0 ? 1 : maxVal - minVal;

  const coords = points.map((p, idx) => {
    const x = paddingHoriz + (idx / (points.length - 1 || 1)) * effectiveWidth;
    const y = paddingTop + effectiveHeight - ((Number(p.amountMinor) - minVal) / valRange) * effectiveHeight;
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

  // Dynamic stroke/gradient colors based on category
  const chartStrokeColor = activeFilter === 'liability' ? colors.statusDanger : colors.primary;
  const gradientId = `overviewGradient_${activeFilter}`;

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
      {/* Header with Title and Range Picker */}
      <View style={styles.headerRow}>
        <View>
          <Text
            style={[
              styles.cardTitle,
              {
                color: colors.textSecondary,
                fontFamily: typography.fonts.medium,
                fontSize: typography.sizes.xs,
              },
            ]}
          >
            {filterCategoryData.title}
          </Text>
          <View style={styles.deltaRow}>
            <Text
              style={[
                styles.highlightBalance,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.lg,
                },
              ]}
            >
              {formatNaira(currentPoint.amountMinor)}
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: timeframeData.isPositive
                    ? colors.statusSuccessLight
                    : colors.statusDangerLight,
                  borderRadius: radii.full,
                  marginLeft: spacing.xs + 2,
                },
              ]}
            >
              {timeframeData.isPositive ? (
                <TrendingUp size={12} color={colors.statusSuccess} />
              ) : (
                <TrendingDown size={12} color={colors.statusDanger} />
              )}
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: timeframeData.isPositive ? colors.statusSuccess : colors.statusDanger,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 11,
                    marginLeft: 2,
                  },
                ]}
              >
                {timeframeData.percent}
              </Text>
            </View>
          </View>
          <Text
            style={{
              color: colors.textTertiary,
              fontFamily: typography.fonts.regular,
              fontSize: 11,
              marginTop: 2,
            }}
          >
            {activePointIndex !== null
              ? `As of ${currentPoint.date}`
              : `Net trajectory over ${selectedRange}`}
          </Text>
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
                    paddingVertical: 4,
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

      {/* SVG Chart Area */}
      <View style={[styles.svgWrapper, { height: chartHeight }]}>
        <Svg width={containerWidth - spacing.lg * 2} height={chartHeight}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={chartStrokeColor} stopOpacity={0.24} />
              <Stop offset="100%" stopColor={chartStrokeColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Area Fill */}
          <Path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Trend Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={chartStrokeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Guideline and Marker */}
          {activeCoord && (
            <>
              <Line
                x1={activeCoord.x}
                y1={paddingTop - 6}
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
                fill={chartStrokeColor}
              />
            </>
          )}

          {/* X-Axis Date Labels: Evenly spaced markers */}
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
                  y={chartHeight - 6}
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

        {/* Transparent Touchable Overlays for Points */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  highlightBalance: {
    letterSpacing: -0.2,
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
    marginTop: 6,
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
});

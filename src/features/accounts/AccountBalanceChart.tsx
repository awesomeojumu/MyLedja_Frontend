import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../design';
import { formatNaira } from '../../money';
import { useDatabaseData } from '../../data/workspace/useDatabaseData';
import { balanceHistory } from './balanceHistory';

type TimeRange = '1W' | '1M' | '3M' | 'YTD' | 'ALL';


interface AccountBalanceChartProps {
  accountId: string;
  currentBalanceMinor: bigint;
  accountType?: string;
}


export function AccountBalanceChart({ accountId, currentBalanceMinor, accountType }: AccountBalanceChartProps) {
  const { colors, typography, spacing, radii } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(340);

  const { events } = useDatabaseData();

  // Real history from this account's posted events; the last point is today's balance.
  const activeData = React.useMemo(() => {
    const history = balanceHistory([accountId], events, selectedRange);
    const points = history.points.map((p) => ({ date: p.date, balanceMinor: p.amountMinor }));
    if (points.length > 0) points[points.length - 1] = { ...points[points.length - 1]!, balanceMinor: currentBalanceMinor };
    const delta = currentBalanceMinor - (points[0]?.balanceMinor ?? 0n);
    return { points, netDeltaMinor: delta, percent: history.percent, isPositive: delta >= 0n };
  }, [accountId, events, currentBalanceMinor, selectedRange]);

  const points = activeData.points;

  // Selected point details (or fallback to latest)
  const currentPoint = activePointIndex !== null && points[activePointIndex]
    ? points[activePointIndex]
    : points[points.length - 1]!;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  const chartHeight = 140;
  const paddingHoriz = 16;
  const paddingTop = 20;
  const paddingBottom = 24;
  const effectiveWidth = Math.max(containerWidth - paddingHoriz * 2, 100);
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate min & max balances
  const balances = points.map((p) => Number(p.balanceMinor));
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const balRange = maxBal - minBal === 0 ? 1 : maxBal - minBal;

  // Coordinates
  const coords = points.map((p, idx) => {
    const x = paddingHoriz + (idx / (points.length - 1)) * effectiveWidth;
    const y = paddingTop + effectiveHeight - ((Number(p.balanceMinor) - minBal) / balRange) * effectiveHeight;
    return { x, y, point: p };
  });

  // Build SVG path
  const linePath = coords.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    // Smooth Bezier Curve
    const prev = coords[idx - 1]!;
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  const firstCoord = coords[0]!;
  const lastCoord = coords[coords.length - 1]!;
  const bottomY = chartHeight - paddingBottom + 4;
  const areaPath = `${linePath} L ${lastCoord.x.toFixed(1)} ${bottomY} L ${firstCoord.x.toFixed(1)} ${bottomY} Z`;

  const activeCoord = activePointIndex !== null && coords[activePointIndex]
    ? coords[activePointIndex]
    : coords[coords.length - 1]!;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radii.lg,
          padding: spacing.md,
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
            BALANCE TREND
          </Text>
          <View style={styles.deltaRow}>
            <Text
              style={[
                styles.highlightBalance,
                {
                  color: colors.textPrimary,
                  fontFamily: typography.fonts.semiBold,
                  fontSize: typography.sizes.md,
                },
              ]}
            >
              {formatNaira(currentPoint.balanceMinor)}
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: activeData.isPositive ? colors.statusSuccessLight : colors.statusDangerLight,
                  borderRadius: radii.full,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              {activeData.isPositive ? (
                <TrendingUp size={12} color={colors.statusSuccess} />
              ) : (
                <TrendingDown size={12} color={colors.statusDanger} />
              )}
              <Text
                style={[
                  styles.badgeText,
                  {
                    color: activeData.isPositive ? colors.statusSuccess : colors.statusDanger,
                    fontFamily: typography.fonts.semiBold,
                    fontSize: 11,
                    marginLeft: 2,
                  },
                ]}
              >
                {activeData.percent}
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
            {activePointIndex !== null ? `As of ${currentPoint.date}` : `Net change over ${selectedRange}`}
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
        <Svg width={containerWidth - spacing.md * 2} height={chartHeight}>
          <Defs>
            <LinearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Area Fill */}
          <Path d={areaPath} fill="url(#balanceGradient)" />

          {/* Trend Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Highlight Marker */}
          {activeCoord && (
            <>
              {/* Vertical Dashed Guideline */}
              <Line
                x1={activeCoord.x}
                y1={paddingTop - 6}
                x2={activeCoord.x}
                y2={bottomY}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              {/* Outer Glow Circle */}
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={6}
                fill={colors.primaryLight}
              />
              {/* Inner Solid Circle */}
              <Circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r={3.5}
                fill={colors.primary}
              />
            </>
          )}

          {/* X-Axis Date Labels: 3-4 evenly spaced non-overlapping markers */}
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    marginBottom: 8,
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
    marginTop: 8,
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

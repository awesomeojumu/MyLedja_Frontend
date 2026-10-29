import { Pressable, View } from 'react-native';
import Svg, { Circle, Line as SvgLine, Path } from 'react-native-svg';

import { Card, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { t } from '@/i18n';

const sp = tokens.spacing;
const c = tokens.color;
const HEIGHT = 120;

type Point = { label: string; value: bigint };

/**
 * Two cumulative spending lines with a vertical "today" marker (DESIGN.md page 5).
 * Local to the dashboard so we don't race shared `charts.tsx`.
 */
export function SpendingTrendChart({
  thisMonth,
  lastMonth,
  todayDay,
  onPress,
}: {
  thisMonth: Point[];
  lastMonth: bigint[];
  /** 1-based day of month, or null when the selected month is not current. */
  todayDay: number | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const values = [...thisMonth.map((p) => p.value), ...lastMonth];
  const min = values.reduce((m, v) => (v < m ? v : m), values[0] ?? 0n);
  const max = values.reduce((m, v) => (v > m ? v : m), values[0] ?? 0n);
  const span = max - min === 0n ? 1n : max - min;
  const yOf = (v: bigint) => 4 + (1 - Number(v - min) / Number(span)) * (HEIGHT - 8);

  return (
    <Pressable testID="dashboard-spending-trend" accessibilityRole="link" onPress={onPress}>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{t('dashboard.spendingVsLastMonth')}</Text>
        <View style={{ height: HEIGHT }}>
          <TrendSvg thisMonth={thisMonth} lastMonth={lastMonth} todayDay={todayDay} yOf={yOf} themeStroke={theme.primaryFill} border={theme.border} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
          <Text variant="caption" tone="textSecondary">
            {t('dashboard.thisMonth')}
          </Text>
          <Text variant="caption" tone="textSecondary">
            {t('dashboard.lastMonth')}
          </Text>
          {todayDay != null ? (
            <Text variant="caption" tone="textSecondary" testID="dashboard-spending-today-marker">
              {t('dashboard.todayMarker', { day: todayDay })}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function TrendSvg({
  thisMonth,
  lastMonth,
  todayDay,
  yOf,
  themeStroke,
  border,
}: {
  thisMonth: Point[];
  lastMonth: bigint[];
  todayDay: number | null;
  yOf: (v: bigint) => number;
  themeStroke: string;
  border: string;
}) {
  // Fixed width for SVG math; ChartFrame pattern uses measured width — use a generous default.
  const width = 320;
  const n = Math.max(thisMonth.length, 1);
  const step = n > 1 ? (width - 8) / (n - 1) : 0;
  const at = (v: bigint, i: number) => ({ x: 4 + i * step, y: yOf(v) });
  const pts = thisMonth.map((p, i) => at(p.value, i));
  const cmp = lastMonth.slice(0, n).map((v, i) => at(v, i));
  const path = (ps: { x: number; y: number }[]) => ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const todayIdx = todayDay != null ? Math.min(Math.max(todayDay - 1, 0), n - 1) : null;
  const todayX = todayIdx != null ? 4 + todayIdx * step : null;
  const last = pts.at(-1);

  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} preserveAspectRatio="none">
      <SvgLine x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={border} strokeWidth={1} />
      {cmp.length > 1 ? <Path testID="dashboard-spending-compare" d={path(cmp)} stroke={c['primary-soft']} strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
      {pts.length > 1 ? <Path d={path(pts)} stroke={themeStroke} strokeWidth={2.2} fill="none" /> : null}
      {todayX != null ? <SvgLine testID="dashboard-spending-today-line" x1={todayX} x2={todayX} y1={0} y2={HEIGHT} stroke={c.gold} strokeWidth={1.5} strokeDasharray="3 3" /> : null}
      {last ? <Circle cx={last.x} cy={last.y} r={3} fill={themeStroke} /> : null}
    </Svg>
  );
}

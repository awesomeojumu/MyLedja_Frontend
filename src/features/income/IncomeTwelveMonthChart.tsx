import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line as SvgLine, Path, Rect } from 'react-native-svg';

import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { Switch, Text } from '@/design/components';
import { DONUT_COLOURS } from '@/design/components';
import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import type { TwelveMonthPoint } from './helpers';

const c = tokens.color;
const sp = tokens.spacing;
const HEIGHT = 160;

type Props = {
  points: TwelveMonthPoint[];
  testID?: string;
};

export function IncomeTwelveMonthChart({ points, testID = 'income-chart' }: Props) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const [asTable, setAsTable] = useState(false);
  const [width, setWidth] = useState(0);
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));
  const streamNames = [...new Map(points.flatMap((p) => p.byStream.map((s) => [s.streamId, s.name] as const))).values()].slice(0, 5);

  return (
    <View testID={testID} style={{ gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{t('income.chartTitle')}</Text>
      {asTable ? (
        <View testID={`${testID}-table`} accessibilityRole="list">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp['spacing-xs'] }}>
            <Text variant="caption" tone="textSecondary">
              {t('category.chartMonth')}
            </Text>
            <Text variant="caption" tone="textSecondary">
              {t('income.received')} / {t('income.expected')}
            </Text>
          </View>
          {points.map((p) => (
            <View
              key={p.month}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border }}
            >
              <Text>{p.label}</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>
                {show(p.received)} / {show(p.expected)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('income.chartTitle')}
          onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
          style={{ minHeight: HEIGHT }}
        >
          {width > 0 ? <StackedBars width={width} points={points} streamNames={streamNames} /> : null}
        </View>
      )}
      <Switch label={t('chart.viewAsTable')} value={asTable} onChange={setAsTable} testID={`${testID}-switch`} />
      {streamNames.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          {streamNames.map((name, i) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: DONUT_COLOURS[i % DONUT_COLOURS.length] }} />
              <Text variant="caption" tone="textSecondary">
                {name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StackedBars({ width, points, streamNames }: { width: number; points: TwelveMonthPoint[]; streamNames: string[] }) {
  const theme = useTheme();
  const bars = points.slice(-12);
  const max = bars.reduce((m, p) => {
    const top = p.expected > p.received ? p.expected : p.received;
    return top > m ? top : m;
  }, 0n);
  const scale = (v: bigint) => (max === 0n ? 0 : Number((v > 0n ? v : 0n) * 10_000n / max) / 10_000);
  const gap = 6;
  const barW = Math.max(4, (width - gap * (bars.length - 1)) / Math.max(1, bars.length));

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        <SvgLine x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={theme.border} strokeWidth={1} />
        {bars.map((p, i) => {
          const x = i * (barW + gap);
          let yOff = HEIGHT;
          const ordered = streamNames
            .map((name) => p.byStream.find((s) => s.name === name))
            .filter((s): s is { streamId: string; name: string; amount: bigint } => Boolean(s));
          const tagged = ordered.reduce((s, o) => s + o.amount, 0n);
          const other = p.received > tagged ? p.received - tagged : 0n;
          const segments: { amount: bigint; colour: string }[] = ordered.map((o, si) => ({
            amount: o.amount,
            colour: DONUT_COLOURS[si % DONUT_COLOURS.length] ?? c.primary,
          }));
          if (other > 0n) segments.push({ amount: other, colour: c['primary-soft'] ?? '#ccc' });
          const rects = segments.flatMap((seg, si) => {
            if (seg.amount <= 0n) return [];
            const h = Math.max(2, scale(seg.amount) * (HEIGHT - 8));
            yOff -= h;
            return [<Rect key={`${i}-${si}`} x={x} y={yOff} width={barW} height={h} fill={seg.colour} rx={2} />];
          });
          const expectedY = HEIGHT - scale(p.expected) * (HEIGHT - 8);
          return [
            ...rects,
            p.expected > 0n ? (
              <Path key={`exp-${i}`} d={`M${x},${expectedY} H${x + barW}`} stroke={c.ruby} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
            ) : null,
          ];
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {bars.map((p) => (
          <Text key={p.month} style={{ fontSize: 10, color: c['ink-mute-2'], width: barW + gap, textAlign: 'center' }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

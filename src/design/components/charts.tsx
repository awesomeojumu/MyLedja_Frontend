import { useState, type ReactNode } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line as SvgLine, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import tokens from '../tokens.json';
import { useDesign, useTheme } from '../ThemeProvider';
import { Switch } from './controls';
import { Text } from './Text';

const c = tokens.color;
const sp = tokens.spacing;
const r = tokens.radius;

export type Point = {
  label: string;
  value: bigint;
  /** Planned amount for dual planned-vs-spent bars (Page 7). */
  planned?: bigint;
  over?: boolean;
  /** Optional month key for navigation when a bar is pressed. */
  month?: string;
};

/** DESIGN.md 2.7 donut order; gold may replace the last for the one share that matters. */
export const DONUT_COLOURS = [c.primary, c['primary-deep'], c['primary-soft'], c['primary-bg-subdued-hover']];

type Frame = {
  /** States the finding ("Spending fell 11% from September"); also the screen-reader label. */
  title: string;
  /** Column headings for "View as table". */
  columns: [string, string] | [string, string, string];
  rows: Point[];
  format?: (v: bigint) => string;
  testID?: string;
  children: (width: number) => ReactNode;
};

/** Every chart has "View as table" (DESIGN.md 2.7), which shows the same numbers. */
function ChartFrame({ title, columns, rows, format = formatNaira, testID, children }: Frame) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const [asTable, setAsTable] = useState(false);
  const [width, setWidth] = useState(0);
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : format(v));
  const hasPlanned = columns.length > 2;
  return (
    <View testID={testID} style={{ gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{title}</Text>
      {asTable ? (
        <View accessibilityRole="list" testID={testID && `${testID}-table`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: sp['spacing-xs'], gap: sp['spacing-sm'] }}>
            <Text variant="caption" tone="textSecondary" style={{ flex: 1 }}>
              {columns[0]}
            </Text>
            {hasPlanned ? (
              <Text variant="caption" tone="textSecondary" style={{ minWidth: 72, textAlign: 'right' }}>
                {columns[1]}
              </Text>
            ) : null}
            <Text variant="caption" tone="textSecondary" style={{ minWidth: 72, textAlign: 'right' }}>
              {hasPlanned ? columns[2] : columns[1]}
            </Text>
          </View>
          {rows.map((row) => (
            <View
              key={row.label}
              accessible
              accessibilityLabel={
                hasPlanned
                  ? `${row.label}, planned ${show(row.planned ?? 0n)}, spent ${show(row.value)}`
                  : `${row.label}, ${show(row.value)}`
              }
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: sp['spacing-xs'],
                borderTopWidth: 1,
                borderTopColor: theme.border,
                gap: sp['spacing-sm'],
              }}
            >
              <Text style={{ flex: 1 }}>{row.label}</Text>
              {hasPlanned ? (
                <Text style={{ minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{show(row.planned ?? 0n)}</Text>
              ) : null}
              <Text style={{ minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{show(row.value)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={title}
          onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
          style={{ minHeight: 160 }}
        >
          {width > 0 ? children(width) : null}
        </View>
      )}
      <Switch label={t('chart.viewAsTable')} value={asTable} onChange={setAsTable} testID={testID && `${testID}-switch`} />
    </View>
  );
}

const HEIGHT = 160;
const TICK = 10;

function scale(values: bigint[]): (v: bigint) => number {
  const max = values.reduce((m, v) => (v > m ? v : m), 0n);
  if (max === 0n) return () => 0;
  return (v) => Number((v > 0n ? v : 0n) * 10_000n / max) / 10_000;
}

/** Up to 12 bars; over-plan bars are ruby; at most one gold bar, and only if the view has no other gold mark. */
export function BarChart({
  highlight,
  onBarPress,
  ...props
}: Omit<Frame, 'children'> & { highlight?: number; onBarPress?: (row: Point, index: number) => void }) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const [tip, setTip] = useState<{ index: number; x: number } | null>(null);
  const bars = props.rows.slice(-12);
  const y = scale(bars.flatMap((b) => [b.value, b.planned ?? 0n]));
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : (props.format ?? formatNaira)(v));

  const activate = (b: Point, i: number, x: number) => {
    setTip({ index: i, x });
    onBarPress?.(b, i);
  };

  return (
    <ChartFrame {...props} rows={bars}>
      {(width) => {
        const gap = 6;
        const barW = Math.max(4, (width - gap * (bars.length - 1)) / Math.max(1, bars.length));
        const tipRow = tip ? bars[tip.index] : null;
        return (
          <View>
            {tipRow ? (
              <View
                testID="chart-bar-tooltip"
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: Math.min(Math.max(0, (tip?.x ?? 0) - 60), Math.max(0, width - 120)),
                  top: 0,
                  zIndex: 2,
                  backgroundColor: theme.card,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: r['rounded-sm'],
                  paddingHorizontal: sp['spacing-sm'],
                  paddingVertical: sp['spacing-xxs'],
                  maxWidth: 140,
                }}
              >
                <Text variant="caption">
                  {tipRow.label}
                  {tipRow.planned !== undefined ? ` · ${show(tipRow.planned)} / ${show(tipRow.value)}` : ` · ${show(tipRow.value)}`}
                </Text>
              </View>
            ) : null}
            <Svg width={width} height={HEIGHT}>
              <SvgLine x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={theme.border} strokeWidth={1} />
              {bars.map((b, i) => {
                const spentH = Math.max(b.value > 0n ? 2 : 0, y(b.value) * (HEIGHT - 4));
                const plannedH = b.planned !== undefined ? Math.max(b.planned > 0n ? 2 : 0, y(b.planned) * (HEIGHT - 4)) : 0;
                const fill = b.over ? c.ruby : i === highlight ? c.gold : c['primary-soft'];
                const x = i * (barW + gap);
                return (
                  <BarShape
                    key={b.label}
                    testID={`chart-bar-${i}`}
                    x={x}
                    width={barW}
                    height={spentH}
                    plannedHeight={plannedH}
                    fill={fill}
                    outline={theme.border}
                    onActivate={() => activate(b, i, x + barW / 2)}
                    onHoverIn={Platform.OS === 'web' ? () => setTip({ index: i, x: x + barW / 2 }) : undefined}
                    onHoverOut={Platform.OS === 'web' ? () => setTip((cur) => (cur?.index === i ? null : cur)) : undefined}
                  />
                );
              })}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {bars.map((b) => (
                <Text key={b.label} style={{ fontSize: TICK, color: c['ink-mute-2'], width: barW + gap, textAlign: 'center' }}>
                  {b.label}
                </Text>
              ))}
            </View>
          </View>
        );
      }}
    </ChartFrame>
  );
}

function BarShape({
  x,
  width,
  height,
  plannedHeight,
  fill,
  outline,
  testID,
  onActivate,
  onHoverIn,
  onHoverOut,
}: {
  x: number;
  width: number;
  height: number;
  plannedHeight: number;
  fill: string;
  outline: string;
  testID: string;
  onActivate?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}) {
  const radius = Math.min(r['rounded-xs'], Math.max(height, plannedHeight) / 2, width / 2);
  const top = HEIGHT - height;
  const plannedTop = HEIGHT - plannedHeight;
  const hit = (
    <Rect
      testID={`${testID}-hit`}
      x={x}
      y={0}
      width={width}
      height={HEIGHT}
      fill="transparent"
      onPress={onActivate}
      {...(onHoverIn
        ? ({
            onMouseEnter: onHoverIn,
            onMouseLeave: onHoverOut,
          } as object)
        : {})}
    />
  );
  return (
    <>
      {plannedHeight > 0 ? (
        <Rect
          testID={`${testID}-planned`}
          x={x + 1}
          y={plannedTop}
          width={Math.max(1, width - 2)}
          height={plannedHeight}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={outline}
          strokeWidth={1.5}
        />
      ) : null}
      {height > 0 ? (
        <Path
          testID={testID}
          d={`M${x},${HEIGHT} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + width - radius} Q${x + width},${top} ${x + width},${top + radius} V${HEIGHT} Z`}
          fill={fill}
        />
      ) : null}
      {hit}
    </>
  );
}

/** A 2.2px primary line; the latest point is gold, which is that view's gold mark. */
export function LineChart({ goldLatest = true, ...props }: Omit<Frame, 'children'> & { goldLatest?: boolean }) {
  const theme = useTheme();
  const values = props.rows.map((p) => p.value);
  const min = values.reduce((m, v) => (v < m ? v : m), values[0] ?? 0n);
  const y = scale(values.map((v) => v - min));
  return (
    <ChartFrame {...props}>
      {(width) => {
        const step = props.rows.length > 1 ? (width - 8) / (props.rows.length - 1) : 0;
        const pts = props.rows.map((p, i) => ({ x: 4 + i * step, y: 4 + (1 - y(p.value - min)) * (HEIGHT - 8) }));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const last = pts.at(-1);
        return (
          <Svg width={width} height={HEIGHT}>
            <SvgLine x1={0} x2={width} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={theme.border} strokeWidth={1} />
            {pts.length > 1 ? <Path d={d} stroke={theme.primaryFill} strokeWidth={2.2} fill="none" /> : null}
            {last ? <Circle testID="chart-latest" cx={last.x} cy={last.y} r={4} fill={goldLatest ? c.gold : theme.primaryFill} /> : null}
          </Svg>
        );
      }}
    </ChartFrame>
  );
}

/** At most five segments in the DESIGN.md order; the total sits in the centre and the legend repeats every value. */
export function DonutChart({ goldLast, total, ...props }: Omit<Frame, 'children'> & { goldLast?: boolean; total: bigint }) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const rows = props.rows.slice(0, 5);
  const sum = rows.reduce((s, p) => s + (p.value > 0n ? p.value : 0n), 0n);
  const colour = (i: number) => (goldLast && i === rows.length - 1 ? c.gold : (DONUT_COLOURS[i] ?? c.hairline));
  return (
    <ChartFrame {...props} rows={rows}>
      {(width) => {
        const size = Math.min(width, HEIGHT);
        const radius = size / 2 - 12;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-lg'] }}>
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.border} strokeWidth={16} fill="none" />
                {rows.map((p, i) => {
                  const share = sum === 0n ? 0 : Number((p.value * 10_000n) / sum) / 10_000;
                  const dash = share * circumference;
                  const el = (
                    <Circle
                      key={p.label}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke={colour(i)}
                      strokeWidth={16}
                      fill="none"
                      strokeDasharray={`${dash} ${circumference - dash}`}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += dash;
                  return el;
                })}
              </Svg>
              <Text variant="body-tabular">{privacy ? PRIVACY_MASK : formatNaira(total)}</Text>
            </View>
            <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
              {rows.map((p, i) => (
                <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colour(i) }} />
                  <Text style={{ flex: 1 }}>{p.label}</Text>
                  <Text style={{ fontVariant: ['tabular-nums'] }}>{privacy ? PRIVACY_MASK : formatNaira(p.value)}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      }}
    </ChartFrame>
  );
}

/** Hairline track and primary fill, never gold. */
export function ProgressRing({ value, label, size = 56 }: { value: number; label: string; size?: number }) {
  const theme = useTheme();
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.border} strokeWidth={4} fill="none" />
        <Circle testID="ring-fill" cx={size / 2} cy={size / 2} r={radius} stroke={theme.primaryFill} strokeWidth={4} fill="none" strokeDasharray={`${v * circumference} ${circumference}`} />
      </Svg>
    </View>
  );
}

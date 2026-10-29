import { useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { formatNaira, PRIVACY_MASK } from '@/money';

import type { FlowBand, FlowGroup } from './helpers';
import { selectHaptic } from './haptics';

const c = tokens.color;
const sp = tokens.spacing;
const NODE = 12;
const GAP = 6;
const LABEL = 128;
const TICK = 11;

/** Spending in navy shades (DESIGN.md 2.7); goals, debt payments and investments in primary-deep, apart. */
const SPENDING = [c.primary, c['primary-soft'], c['primary-press'], c['primary-bg-subdued-hover']];
const GREY = c['ink-mute-2'];

export type SankeyNode = { key: string; label: string; amount: bigint; colour: string };

/** Sources on one side: income in primary, money that isn't income (borrowed, collected) in grey. */
export function sourcesOf(bands: FlowBand[]): SankeyNode[] {
  return bands
    .filter((b) => b.side === 'in')
    .map((b) => ({ key: b.key, label: b.label, amount: b.amount, colour: b.kind === 'income' ? c.primary : GREY }));
}

/** Where it went, by group. "Left over" is the page's one gold mark (P22-02). */
export function sinksOf(groups: FlowGroup[]): SankeyNode[] {
  let shade = 0;
  return groups.map((g) => ({
    key: g.key,
    label: g.label,
    amount: g.amount,
    colour:
      g.kind === 'left_over' ? c.gold : g.kind === 'spending' ? SPENDING[shade++ % SPENDING.length]! : g.kind === 'transfers' ? GREY : c['primary-deep'],
  }));
}

type Placed = SankeyNode & { start: number; size: number };

function place(nodes: SankeyNode[], total: bigint, length: number): Placed[] {
  const usable = Math.max(0, length - GAP * Math.max(0, nodes.length - 1));
  let at = 0;
  return nodes.map((n) => {
    const size = total === 0n ? 0 : Math.max(1, (Number((n.amount * 10_000n) / total) / 10_000) * usable);
    const p = { ...n, start: at, size };
    at += size + GAP;
    return p;
  });
}

/**
 * Where money came from and where it went (DESIGN.md page 22): sources, one middle bar, then groups. On a
 * phone it runs top to bottom with the names in a list underneath (P22-04).
 */
export function Sankey({
  sources,
  sinks,
  vertical,
  selected,
  onSelect,
  title,
  testID,
  short,
}: {
  sources: SankeyNode[];
  sinks: SankeyNode[];
  vertical: boolean;
  selected: string | null;
  onSelect: (key: string) => void;
  title: string;
  testID?: string;
  /** Tablet portrait: shorter horizontal diagram (D22-19). */
  short?: boolean;
}) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const show = (v: bigint) => (privacy ? PRIVACY_MASK : formatNaira(v));
  const total = [sources, sinks].map((ns) => ns.reduce((s, n) => s + n.amount, 0n)).reduce((a, b) => (a > b ? a : b), 0n);
  const height = vertical ? 420 : short ? 360 : 480;
  const cross = vertical ? width : height;
  const left = place(sources, total, cross);
  const right = place(sinks, total, cross);
  const middle = place([{ key: 'middle', label: '', amount: total, colour: c.primary }], total, cross)[0]!;
  const flow = vertical ? height : width;
  const pad = vertical ? 0 : LABEL;
  const a = pad;
  const m = flow / 2 - NODE / 2;
  const b = flow - pad - NODE;

  const pick = (key: string) => {
    selectHaptic();
    onSelect(key);
  };

  const ribbon = (from: number, to: number, s0: number, w0: number, s1: number, w1: number) => {
    const mid = (from + to) / 2;
    if (!vertical) return `M${from},${s0} C${mid},${s0} ${mid},${s1} ${to},${s1} L${to},${s1 + w1} C${mid},${s1 + w1} ${mid},${s0 + w0} ${from},${s0 + w0} Z`;
    return `M${s0},${from} C${s0},${mid} ${s1},${mid} ${s1},${to} L${s1 + w1},${to} C${s1 + w1},${mid} ${s0 + w0},${mid} ${s0 + w0},${from} Z`;
  };
  const bar = (n: Placed, at: number, key: string) =>
    vertical ? (
      <Rect key={key} x={n.start} y={at} width={n.size} height={NODE} fill={n.colour} onPress={() => pick(n.key)} />
    ) : (
      <Rect key={key} x={at} y={n.start} width={NODE} height={n.size} fill={n.colour} onPress={() => pick(n.key)} />
    );
  const active = hovered ?? selected;
  const dim = (key: string) => (active && active !== key ? 0.2 : active === key ? 0.9 : 0.55);
  const hoverProps = (key: string) =>
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(key),
          onMouseLeave: () => setHovered(null),
        }
      : {};

  const unit = middle.size / Math.max(1, Number(total));
  const offsets = (nodes: Placed[]) => nodes.map((_, i) => nodes.slice(0, i).reduce((s, n) => s + Number(n.amount) * unit, 0));
  const inAt = offsets(left);
  const outAt = offsets(right);
  return (
    <View testID={testID} style={{ gap: sp['spacing-sm'] }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={title}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
        style={{ minHeight: height }}
      >
        {width > 0 && total > 0n ? (
          <Svg width={width} height={height}>
            {left.map((n, i) => {
              const size = Number(n.amount) * unit;
              const d = ribbon(a + NODE, m, n.start, n.size, middle.start + inAt[i]!, size);
              return (
                <Path
                  key={`in-${n.key}`}
                  testID={`band-${n.key}`}
                  d={d}
                  fill={n.colour}
                  opacity={dim(n.key)}
                  onPress={() => pick(n.key)}
                  {...hoverProps(n.key)}
                />
              );
            })}
            {right.map((n, i) => {
              const size = Number(n.amount) * unit;
              const d = ribbon(m + NODE, b, middle.start + outAt[i]!, size, n.start, n.size);
              return (
                <Path
                  key={`out-${n.key}`}
                  testID={`band-${n.key}`}
                  d={d}
                  fill={n.colour}
                  opacity={dim(n.key)}
                  onPress={() => pick(n.key)}
                  {...hoverProps(n.key)}
                />
              );
            })}
            {left.map((n) => bar(n, a, `bar-in-${n.key}`))}
            {bar(middle, m, 'bar-middle')}
            {right.map((n) => bar(n, b, `bar-out-${n.key}`))}
            {vertical
              ? null
              : [
                  ...left.map((n) => (
                    <SvgText key={`label-in-${n.key}`} x={a - 6} y={n.start + n.size / 2 + TICK / 3} fontSize={TICK} fill={theme.text} textAnchor="end">
                      {`${n.label} ${show(n.amount)}`}
                    </SvgText>
                  )),
                  ...right.map((n) => (
                    <SvgText key={`label-out-${n.key}`} x={b + NODE + 6} y={n.start + n.size / 2 + TICK / 3} fontSize={TICK} fill={theme.text}>
                      {`${n.label} ${show(n.amount)}`}
                    </SvgText>
                  )),
                ]}
          </Svg>
        ) : null}
      </View>
      {vertical ? (
        <View style={{ gap: sp['spacing-xs'] }} testID={testID && `${testID}-legend`}>
          {[...sources, ...sinks].map((n) => (
            <View key={n.key} style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.colour }} />
              <Text style={{ flex: 1 }}>{n.label}</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{show(n.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

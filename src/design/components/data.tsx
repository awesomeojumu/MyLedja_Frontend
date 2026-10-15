/* Data: CategoryBreakdown, BarChart, LineChart, DataTable. Charts give the shape; exact figures sit in text nearby. */
import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import { compactNaira, formatMoney } from '../format';
import { CategoryIcon, Icon, Txt } from './foundations';
import { Amount } from './money';

export interface CategoryBreakdownProps { items: { label: string; value: number; count?: number }[]; total?: number; onSelect?: (item: { label: string; value: number }) => void }
export function CategoryBreakdown({ items, total, onSelect }: CategoryBreakdownProps) {
  const t = useTheme();
  const sum = total ?? items.reduce((a, b) => a + b.value, 0);
  return (
    <View>
      {items.map((it, i) => {
        const pct = sum ? (it.value / sum) * 100 : 0;
        const row = (
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: t.c.border }}>
            <CategoryIcon category={it.label} size="sm" />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Txt style={{ fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{it.label}</Txt><Amount value={it.value} /></View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: t.c.surfaceAlt, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.c.primary, borderRadius: 999 }} /></View>
              <Txt variant="caption" color={t.c.inkMuted}>{pct > 0 && pct < 1 ? '<1' : Math.round(pct)}% of spending{it.count != null ? ` · ${it.count} transactions` : ''}</Txt>
            </View>
          </View>
        );
        return onSelect ? <Pressable key={it.label} onPress={() => onSelect(it)} accessibilityRole="button">{row}</Pressable> : <View key={it.label}>{row}</View>;
      })}
    </View>
  );
}

function niceMax(v: number) {
  if (!v) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m <= s) return s * p;
  return 10 * p;
}
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(320);
  return [w, (e) => setW(e.nativeEvent.layout.width)];
}
function Legend({ series, dashedThird }: { series: string[]; dashedThird?: boolean }) {
  const t = useTheme();
  const cols = [t.c.chart1, t.c.chart2, t.c.chart3];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {series.map((s, i) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 16, height: 0, borderTopWidth: 3, borderColor: cols[i], borderStyle: dashedThird && i === 2 ? 'dashed' : 'solid' }} />
          <Txt variant="caption" color={t.c.inkMuted}>{s}</Txt>
        </View>
      ))}
    </View>
  );
}

export interface BarChartProps { data: { label: string; value: number; compare?: number }[]; title?: string; series?: string[]; highlight?: string; height?: number }
export function BarChart({ data, title, series, highlight, height = 200 }: BarChartProps) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const pl = 44, pb = 24, pt = 8, hasCmp = data.some((d) => d.compare != null);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.compare ?? 0))));
  const bw = (W - pl) / data.length, inner = Math.min(hasCmp ? 18 : 28, bw * 0.6);
  const y = (v: number) => pt + (height - pt - pb) * (1 - v / max);
  return (
    <View style={{ gap: 8 }} onLayout={onLayout}>
      {title ? <Txt variant="titleSm">{title}</Txt> : null}
      {hasCmp && series ? <Legend series={series} /> : null}
      <View accessible accessibilityRole="image" accessibilityLabel={`${title ?? 'Chart'}: ${data.map((d) => `${d.label} ${formatMoney(d.value)}`).join(', ')}`}>
        <Svg width={W} height={height}>
          {[0, max / 2, max].map((v, i) => (
            <React.Fragment key={i}>
              <Line x1={pl} x2={W} y1={y(v)} y2={y(v)} stroke={t.c.border} strokeWidth={1} />
              <SvgText x={pl - 8} y={y(v) + 4} fontSize={11} fill={t.c.inkMuted} textAnchor="end">{compactNaira(v)}</SvgText>
            </React.Fragment>
          ))}
          {data.map((d, i) => {
            const cx = pl + bw * i + bw / 2, x1 = hasCmp ? cx - inner - 2 : cx - inner / 2;
            return (
              <React.Fragment key={d.label}>
                <Rect x={x1} y={y(d.value)} width={inner} height={Math.max(0, y(0) - y(d.value))} rx={4} fill={t.c.chart1} />
                {hasCmp && d.compare != null ? <Rect x={cx + 2} y={y(d.compare)} width={inner} height={Math.max(0, y(0) - y(d.compare))} rx={4} fill={t.c.chart2} /> : null}
                <SvgText x={cx} y={height - 6} fontSize={11} fontWeight={highlight === d.label ? '700' : '400'} fill={highlight === d.label ? t.c.ink : t.c.inkMuted} textAnchor="middle">{d.label}</SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

export interface LineChartProps { labels: string[]; series: { name: string; values: number[] }[]; title?: string; height?: number }
/** Up to three series; the third is always dashed. */
export function LineChart({ labels, series, title, height = 200 }: LineChartProps) {
  const t = useTheme();
  const [W, onLayout] = useWidth();
  const pl = 44, pb = 24, pt = 8, n = labels.length;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const x = (i: number) => pl + 8 + (W - pl - 16) * (n > 1 ? i / (n - 1) : 0.5);
  const y = (v: number) => pt + (height - pt - pb) * (1 - v / max);
  const cols = [t.c.chart1, t.c.chart2, t.c.chart3];
  return (
    <View style={{ gap: 8 }} onLayout={onLayout}>
      {title ? <Txt variant="titleSm">{title}</Txt> : null}
      <Legend series={series.map((s) => s.name)} dashedThird />
      <View accessible accessibilityRole="image" accessibilityLabel={`${title ?? 'Chart'}. ${series.map((s) => `${s.name} ends at ${formatMoney(s.values[s.values.length - 1])}`).join('. ')}`}>
        <Svg width={W} height={height}>
          {[0, max / 2, max].map((v, i) => (
            <React.Fragment key={i}>
              <Line x1={pl} x2={W} y1={y(v)} y2={y(v)} stroke={t.c.border} strokeWidth={1} />
              <SvgText x={pl - 8} y={y(v) + 4} fontSize={11} fill={t.c.inkMuted} textAnchor="end">{compactNaira(v)}</SvgText>
            </React.Fragment>
          ))}
          {labels.map((l, i) => (n <= 7 || i % Math.ceil(n / 6) === 0 || i === n - 1)
            ? <SvgText key={l + i} x={x(i)} y={height - 6} fontSize={11} fill={t.c.inkMuted} textAnchor="middle">{l}</SvgText> : null)}
          {series.map((s, si) => {
            const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
            const last = s.values.length - 1;
            return (
              <React.Fragment key={s.name}>
                <Path d={d} stroke={cols[si]} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={si === 2 ? '6 5' : undefined} />
                <Circle cx={x(last)} cy={y(s.values[last])} r={4} fill={cols[si]} stroke={t.c.surface} strokeWidth={2} />
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

export interface DataTableColumn<R> { key: string; label: string; align?: 'left' | 'right'; width?: number; sortable?: boolean; render?: (row: R) => React.ReactNode }
export interface DataTableProps<R> { columns: DataTableColumn<R>[]; rows: R[]; sort?: { key: string; dir: 'asc' | 'desc' }; onSort?: (key: string) => void; onRowPress?: (row: R) => void; empty?: string; rowKey?: (row: R, i: number) => string }
/** Tables for tablet and desktop widths; phones use TransactionRow. Scrolls sideways when narrow. */
export function DataTable<R extends Record<string, any>>({ columns, rows, sort, onSort, onRowPress, empty = 'Nothing to show', rowKey }: DataTableProps<R>) {
  const t = useTheme();
  const cell = (c: DataTableColumn<R>) => ({ width: c.width ?? 160, paddingHorizontal: 16, justifyContent: 'center' as const, alignItems: c.align === 'right' ? ('flex-end' as const) : ('flex-start' as const) });
  return (
    <ScrollView horizontal style={{ borderWidth: 1, borderColor: t.c.borderStrong, borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface }}>
      <View>
        <View style={{ flexDirection: 'row', height: 40, backgroundColor: t.c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: t.c.border }}>
          {columns.map((c) => {
            const on = sort?.key === c.key;
            const head = <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: '600' }}>{c.label}</Txt>;
            return (
              <View key={c.key} style={cell(c)}>
                {c.sortable && onSort ? (
                  <Pressable onPress={() => onSort(c.key)} accessibilityRole="button" accessibilityLabel={`Sort by ${c.label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} hitSlop={8}>
                    {head}<Icon name={on ? (sort!.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'arrow-up-down'} size={14} color={t.c.inkMuted} />
                  </Pressable>
                ) : head}
              </View>
            );
          })}
        </View>
        {rows.length ? rows.map((r, i) => {
          const line = (
            <View style={{ flexDirection: 'row', minHeight: 52, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: t.c.border }}>
              {columns.map((c) => <View key={c.key} style={cell(c)}>{c.render ? c.render(r) : <Txt variant="bodySm" style={c.align === 'right' ? { fontVariant: ['tabular-nums'] } : undefined}>{String(r[c.key] ?? '')}</Txt>}</View>)}
            </View>
          );
          const k = rowKey ? rowKey(r, i) : String(r.id ?? i);
          return onRowPress ? <Pressable key={k} onPress={() => onRowPress(r)} accessibilityRole="button">{line}</Pressable> : <View key={k}>{line}</View>;
        }) : <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}><Txt color={t.c.inkMuted}>{empty}</Txt></View>}
      </View>
    </ScrollView>
  );
}

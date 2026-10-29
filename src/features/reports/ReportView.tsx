import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BarChart, DonutChart, LineChart, Text, type Point } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import type { ReportChart } from '@/data/workspace/model';
import type { Row } from '@/ledger/reports';
import { t } from '@/i18n';
import { PRIVACY_MASK } from '@/money';

import { columnLabel, findingText, rowLabel, valueText } from './helpers';
import type { ReportResult } from './runner';

const sp = tokens.spacing;

/**
 * One report's chart: the table's headline column drawn as bars, a line, a donut or a figure. The chart and
 * the table read the same rows, so they can't disagree (B5.2).
 */
export function ReportChartView({
  result,
  title,
  chart,
  highlight,
  text,
  onRowPress,
  testID,
}: {
  result: ReportResult;
  title: string;
  chart?: ReportChart | null;
  /** The dashboard's one gold mark (P19-05). */
  highlight: boolean;
  text?: string | null;
  onRowPress?: (key: string) => void;
  testID?: string;
}) {
  const { privacy } = useDesign();
  const kind = chart ?? result.chart;
  const heading = findingText(result, title);
  const format = (v: bigint) => (privacy && result.unit === 'money' ? PRIVACY_MASK : valueText(v, result.unit));
  const rows: (Point & { key: string })[] = result.table.rows.map((r) => ({ key: r.key, label: rowLabel(r), value: r.total }));
  const columns: [string, string] = [t('reports.col.name'), t('reports.col.total')];
  void onRowPress;

  if (result.error === 'formula') {
    return (
      <Text testID={testID && `${testID}-error`} tone="textSecondary">
        {t('reports.formulaError')}
      </Text>
    );
  }
  switch (kind) {
    case 'note':
      return (
        <Text testID={testID && `${testID}-note`}>{text || t('reports.noteEmpty')}</Text>
      );
    case 'number':
      return (
        <View testID={testID} accessible accessibilityLabel={`${heading}, ${format(result.table.total)}`} style={{ gap: sp['spacing-xs'] }}>
          <Text variant="display-md" testID={testID && `${testID}-number`} style={{ fontVariant: ['tabular-nums'] }}>
            {format(result.table.total)}
          </Text>
          {result.finding ? (
            <Text variant="caption" tone="textSecondary">
              {heading}
            </Text>
          ) : null}
        </View>
      );
    case 'donut':
      return (
        <DonutChart
          testID={testID}
          title={heading}
          columns={columns}
          rows={[...rows].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))}
          total={result.table.total}
          goldLast={false}
          format={format}
        />
      );
    case 'line':
    case 'area':
      return (
        <LineChart
          testID={testID}
          title={heading}
          columns={columns}
          rows={rows}
          goldLatest={highlight}
          format={format}
        />
      );
    case 'table':
      return <ReportTable result={result} onRowPress={onRowPress} testID={testID && `${testID}-only-table`} />;
    default:
      return (
        <BarChart
          testID={testID}
          title={heading}
          columns={columns}
          rows={rows}
          highlight={highlight ? rows.length - 1 : undefined}
          format={format}
        />
      );
  }
}

type Sort = { column: number; down: boolean } | null;

/** Every number in the chart, sortable, with totals (P20-02). Scrolls sideways in its own box on phones. */
export function ReportTable({ result, onRowPress, testID }: { result: ReportResult; onRowPress?: (key: string) => void; testID?: string }) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const [sort, setSort] = useState<Sort>(null);
  const show = (v: bigint) => (privacy && result.unit === 'money' ? PRIVACY_MASK : valueText(v, result.unit));
  const multi = result.table.columns.length > 1;
  const tableRows = result.table.rows;
  const rows = useMemo(() => {
    if (!sort) return tableRows;
    const pick = (r: Row) => (sort.column < 0 ? r.total : (r.values[sort.column] ?? 0n));
    return [...tableRows].sort((a, b) => {
      const d = pick(a) - pick(b);
      const n = d > 0n ? 1 : d < 0n ? -1 : 0;
      return sort.down ? -n : n;
    });
  }, [tableRows, sort]);
  const toggle = (column: number) => setSort((s) => (s?.column === column ? { column, down: !s.down } : { column, down: true }));
  const cellW = 120;

  const head = (label: string, column: number) => (
    <Pressable
      key={column}
      accessibilityRole="button"
      accessibilityState={{ selected: sort?.column === column }}
      accessibilityLabel={t('reports.sortBy', { column: label })}
      onPress={() => toggle(column)}
      testID={testID && `${testID}-sort-${column}`}
      style={{ width: cellW }}
    >
      <Text variant="caption" tone={sort?.column === column ? 'link' : 'textSecondary'} style={{ textAlign: 'right' }}>
        {label}
      </Text>
    </Pressable>
  );
  const line = { flexDirection: 'row' as const, gap: sp['spacing-sm'], paddingVertical: sp['spacing-xs'], borderTopWidth: 1, borderTopColor: theme.border };
  const num = (v: bigint, key: string) => (
    <Text key={key} style={{ width: cellW, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
      {show(v)}
    </Text>
  );

  if (result.table.rows.length === 0) {
    return (
      <Text testID={testID} tone="textSecondary">
        {t('reports.noRows')}
      </Text>
    );
  }
  return (
    <ScrollView horizontal testID={testID} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, minWidth: '100%' }}>
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <Text variant="caption" tone="textSecondary" style={{ flex: 1, minWidth: 140 }}>
            {t('reports.col.name')}
          </Text>
          {multi ? result.table.columns.map((c, i) => head(columnLabel(c.key), i)) : null}
          {head(t('reports.col.total'), -1)}
        </View>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            disabled={!onRowPress}
            accessibilityRole={onRowPress ? 'link' : undefined}
            testID={testID && `${testID}-row-${r.key}`}
            onPress={() => onRowPress?.(r.key)}
            style={line}
          >
            <Text style={{ flex: 1, minWidth: 140 }}>{rowLabel(r)}</Text>
            {multi ? r.values.map((v, i) => num(v, String(i))) : null}
            {num(r.total, 'total')}
          </Pressable>
        ))}
        <View style={line}>
          <Text variant="heading-sm" style={{ flex: 1, minWidth: 140 }}>
            {t('reports.col.total')}
          </Text>
          {multi ? result.table.columnTotals.map((v, i) => num(v, String(i))) : null}
          <Text testID={testID && `${testID}-total`} style={{ width: cellW, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {show(result.table.total)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

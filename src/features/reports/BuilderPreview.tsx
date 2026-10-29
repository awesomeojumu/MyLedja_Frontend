import { ScrollView, View } from 'react-native';

import { BarChart, DonutChart, LineChart, Text, type Point } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useDesign } from '@/design/ThemeProvider';
import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import type { BuilderPreviewResult } from './builderRunner';

const sp = tokens.spacing;

function formatValue(unit: BuilderPreviewResult['unit'], value: bigint, privacy: boolean): string {
  if (privacy && unit === 'money') return PRIVACY_MASK;
  if (unit === 'count') return value.toString();
  return formatNaira(value);
}

/** Matrix of group × split columns (uses `table.columns` / `row.values`, not only totals). */
function SplitMatrix({
  result,
  format,
  testID,
}: {
  result: BuilderPreviewResult;
  format: (v: bigint) => string;
  testID?: string;
}) {
  const cols = result.table.columns;
  return (
    <ScrollView horizontal testID={testID} style={{ maxWidth: '100%' }}>
      <View style={{ gap: sp['spacing-xs'], minWidth: 200 }}>
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <Text variant="caption" tone="textSecondary" style={{ width: 96 }}>
            {t('reports.col.name')}
          </Text>
          {cols.map((c) => (
            <Text key={c.key} variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
              {c.label || c.key}
            </Text>
          ))}
          <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
            {t('reports.col.total')}
          </Text>
        </View>
        {result.table.rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'center' }}>
            <Text style={{ width: 96 }} numberOfLines={1}>
              {r.label || r.key}
            </Text>
            {cols.map((c, i) => (
              <Text key={c.key} style={{ width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                {format(r.values[i] ?? 0n)}
              </Text>
            ))}
            <Text style={{ width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{format(r.total)}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginTop: sp['spacing-xs'] }}>
          <Text variant="heading-sm" style={{ width: 96 }}>
            {t('reports.col.total')}
          </Text>
          {cols.map((c, i) => (
            <Text key={c.key} variant="heading-sm" style={{ width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {format(result.table.columnTotals[i] ?? 0n)}
            </Text>
          ))}
          <Text variant="heading-sm" style={{ width: 88, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {format(result.table.total)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/** Live chart + table for the Report builder (DESIGN page 21 / B5.2). */
export function BuilderPreview({ result, testID }: { result: BuilderPreviewResult; testID?: string }) {
  const { privacy } = useDesign();
  const format = (v: bigint) => formatValue(result.unit, v, privacy);
  const cols = result.table.columns;
  const multi = cols.length > 1 || (cols[0]?.key !== undefined && cols[0].key !== 'total');
  /** Chart series: first split column when split, else the row total. */
  const seriesIndex = multi ? 0 : -1;
  const rows: Point[] = result.table.rows.map((r) => ({
    label: r.label || r.key,
    value: seriesIndex >= 0 ? (r.values[seriesIndex] ?? 0n) : r.total,
  }));
  const chartColumns: [string, string] = [
    t('reports.col.name'),
    multi ? cols[0]?.label || cols[0]?.key || t('reports.col.total') : t('reports.col.total'),
  ];
  const title = t('reports.preview');

  if (result.chart === 'table') {
    return (
      <View testID={testID} style={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{title}</Text>
        <SplitMatrix result={result} format={format} testID={testID ? `${testID}-matrix` : undefined} />
      </View>
    );
  }

  let chart = null;
  if (result.chart === 'donut') {
    chart = (
      <DonutChart
        testID={testID ? `${testID}-chart` : undefined}
        title={title}
        columns={chartColumns}
        rows={[...rows].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))}
        total={seriesIndex >= 0 ? (result.table.columnTotals[seriesIndex] ?? 0n) : result.table.total}
        goldLast={false}
        format={format}
      />
    );
  } else if (result.chart === 'line') {
    chart = (
      <LineChart
        testID={testID ? `${testID}-chart` : undefined}
        title={title}
        columns={chartColumns}
        rows={rows}
        goldLatest={false}
        format={format}
      />
    );
  } else if (result.chart === 'area') {
    chart = (
      <LineChart
        testID={testID ? `${testID}-chart` : undefined}
        title={title}
        columns={chartColumns}
        rows={rows}
        goldLatest={false}
        filled
        format={format}
      />
    );
  } else {
    chart = (
      <BarChart testID={testID ? `${testID}-chart` : undefined} title={title} columns={chartColumns} rows={rows} format={format} />
    );
  }

  return (
    <View style={{ gap: sp['spacing-md'] }} testID={testID}>
      {chart}
      {/* Split columns must appear in the preview (P0 #3); always show matrix when split. */}
      {multi ? <SplitMatrix result={result} format={format} testID={testID ? `${testID}-matrix` : undefined} /> : null}
      {!multi ? (
        <View testID={testID ? `${testID}-table` : undefined} style={{ gap: sp['spacing-xs'] }}>
          {result.table.rows.map((r) => (
            <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
              <Text style={{ flex: 1 }}>{r.label || r.key}</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{format(r.total)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: sp['spacing-xs'] }}>
            <Text variant="heading-sm">{t('reports.col.total')}</Text>
            <Text variant="heading-sm" style={{ fontVariant: ['tabular-nums'] }}>
              {format(result.table.total)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

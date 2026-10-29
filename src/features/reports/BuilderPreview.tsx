import { View } from 'react-native';

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

/** Live chart + table for the Report builder (DESIGN page 21 / B5.2). */
export function BuilderPreview({ result, testID }: { result: BuilderPreviewResult; testID?: string }) {
  const { privacy } = useDesign();
  const format = (v: bigint) => formatValue(result.unit, v, privacy);
  const rows: Point[] = result.table.rows.map((r) => ({
    label: r.label || r.key,
    value: r.total,
  }));
  const columns: [string, string] = [t('reports.col.name'), t('reports.col.total')];
  const title = t('reports.preview');

  if (result.chart === 'table') {
    return (
      <View testID={testID} style={{ gap: sp['spacing-xs'] }}>
        <Text variant="heading-sm">{title}</Text>
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
    );
  }

  if (result.chart === 'donut') {
    return (
      <DonutChart
        testID={testID}
        title={title}
        columns={columns}
        rows={[...rows].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))}
        total={result.table.total}
        goldLast={false}
        format={format}
      />
    );
  }

  if (result.chart === 'line' || result.chart === 'area') {
    return <LineChart testID={testID} title={title} columns={columns} rows={rows} goldLatest={false} format={format} />;
  }

  return <BarChart testID={testID} title={title} columns={columns} rows={rows} format={format} />;
}

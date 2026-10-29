import { useState } from 'react';
import { View } from 'react-native';

import { Button, DatePicker, SegmentedControl, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

export type DateRange = { from: string; to: string };

type Preset = 'thisMonth' | 'last3' | 'thisYear' | 'custom';

function presetRange(preset: Preset): DateRange {
  const now = today();
  const [y, m] = now.split('-').map(Number) as [number, number];
  if (preset === 'thisMonth') return { from: `${now.slice(0, 7)}-01`, to: now };
  if (preset === 'thisYear') return { from: `${y}-01-01`, to: now };
  if (preset === 'last3') {
    const start = new Date(Date.UTC(y, m - 1 - 2, 1));
    return { from: start.toISOString().slice(0, 10), to: now };
  }
  return { from: `${now.slice(0, 7)}-01`, to: now };
}

/** TB-14 shared range control for Cash flow / Report / builder. */
export function RangeBar({
  range,
  onChange,
  compare,
  onCompareChange,
  /** When true, always show presets inline (e.g. already inside Report's phone Filters sheet). */
  embedded = false,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
  compare?: boolean;
  onCompareChange?: (v: boolean) => void;
  embedded?: boolean;
}) {
  const phone = useSizeClass() === 'phone' && !embedded;
  const [preset, setPreset] = useState<Preset>('thisMonth');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const apply = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') onChange(presetRange(p));
  };

  const controls = (
    <View style={{ gap: sp['spacing-md'] }}>
      <SegmentedControl
        testID="range-presets"
        label={t('cashflow.range')}
        value={preset}
        onChange={(v) => apply(v)}
        options={[
          { value: 'thisMonth', label: t('cashflow.thisMonth') },
          { value: 'last3', label: t('cashflow.last3') },
          { value: 'thisYear', label: t('cashflow.thisYear') },
          { value: 'custom', label: t('cashflow.custom') },
        ]}
      />
      {preset === 'custom' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <DatePicker testID="range-from" label={t('cashflow.from')} value={range.from} onChange={(from) => onChange({ ...range, from })} />
          <DatePicker testID="range-to" label={t('cashflow.to')} value={range.to} onChange={(to) => onChange({ ...range, to })} />
        </View>
      ) : null}
      {onCompareChange ? (
        <SegmentedControl
          testID="range-compare"
          label={t('cashflow.compare')}
          value={compare ? 'on' : 'off'}
          onChange={(v) => onCompareChange(v === 'on')}
          options={[
            { value: 'off', label: t('cashflow.compareOff') },
            { value: 'on', label: t('cashflow.compareOn') },
          ]}
        />
      ) : null}
      <Text variant="caption" tone="textSecondary">
        {range.from} → {range.to}
      </Text>
    </View>
  );

  if (phone) {
    return (
      <>
        <Button testID="range-filters" kind="secondary" label={t('cashflow.filters', { count: preset === 'custom' ? 2 : 1 })} onPress={() => setFiltersOpen(true)} />
        {filtersOpen ? (
          <Sheet visible title={t('cashflow.range')} onClose={() => setFiltersOpen(false)}>
            {controls}
          </Sheet>
        ) : null}
      </>
    );
  }
  return controls;
}

/** Previous period of the same length (TB14-2). */
export function previousPeriod(range: DateRange): DateRange {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

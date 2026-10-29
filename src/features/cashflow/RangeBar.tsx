import { useState } from 'react';
import { View } from 'react-native';

import { Button, DatePicker, PillTag, SegmentedControl, Sheet, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

export type DateRange = { from: string; to: string };

type Preset = 'thisMonth' | 'last3' | 'thisYear' | 'custom';

function monthEnd(year: number, month1to12: number): string {
  return new Date(Date.UTC(year, month1to12, 0)).toISOString().slice(0, 10);
}

function presetRange(preset: Preset): DateRange {
  const now = today();
  const [y, m] = now.split('-').map(Number) as [number, number];
  if (preset === 'thisMonth') return { from: `${now.slice(0, 7)}-01`, to: monthEnd(y, m) };
  if (preset === 'thisYear') return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (preset === 'last3') {
    const start = new Date(Date.UTC(y, m - 1 - 2, 1));
    return { from: start.toISOString().slice(0, 10), to: monthEnd(y, m) };
  }
  return { from: `${now.slice(0, 7)}-01`, to: monthEnd(y, m) };
}

export function detectPreset(range: DateRange): Preset {
  for (const p of ['thisMonth', 'last3', 'thisYear'] as const) {
    const r = presetRange(p);
    if (r.from === range.from && r.to === range.to) return p;
  }
  return 'custom';
}

/** TB-14 shared range control for Cash flow / Report / builder. Compare is Report-only. */
export function RangeBar({
  range,
  onChange,
  compare,
  onCompareChange,
  /** When true, always show presets inline (inside the Report Filters sheet or the Report builder's phone Edit sheet). */
  embedded = false,
  accountIds,
  accounts,
  onAccountsChange,
  includeTransfers,
  onTransfersChange,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
  compare?: boolean;
  onCompareChange?: (v: boolean) => void;
  embedded?: boolean;
  accountIds?: string[];
  accounts?: { id: string; name: string }[];
  onAccountsChange?: (ids: string[]) => void;
  includeTransfers?: boolean;
  onTransfersChange?: (v: boolean) => void;
}) {
  const phone = useSizeClass() === 'phone' && !embedded;
  const [preset, setPreset] = useState<Preset>(() => detectPreset(range));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selected = new Set(accountIds ?? []);

  const apply = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') onChange(presetRange(p));
  };

  const filterCount =
    1 +
    (preset === 'custom' ? 1 : 0) +
    (accountIds?.length ?? 0) +
    (includeTransfers ? 1 : 0) +
    (compare ? 1 : 0);

  const toggleAccount = (id: string) => {
    if (!onAccountsChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onAccountsChange([...next]);
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
      {accounts && onAccountsChange ? (
        <View style={{ gap: sp['spacing-xs'] }} testID="cashflow-accounts">
          <Text variant="caption" tone="textSecondary">
            {t('cashFlow.accounts')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
            <PillTag
              testID="cashflow-account-all"
              label={t('cashFlow.anyAccount')}
              selected={selected.size === 0}
              onPress={() => onAccountsChange([])}
            />
            {accounts.map((a) => (
              <PillTag
                key={a.id}
                testID={`cashflow-account-${a.id}`}
                label={a.name}
                selected={selected.has(a.id)}
                onPress={() => toggleAccount(a.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {onTransfersChange ? (
        <Switch testID="cashflow-transfers" label={t('cashFlow.includeTransfers')} value={!!includeTransfers} onChange={onTransfersChange} />
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
        <Button testID="range-filters" kind="secondary" label={t('cashflow.filters', { count: filterCount })} onPress={() => setFiltersOpen(true)} />
        {filtersOpen ? (
          <Sheet visible title={t('cashFlow.filtersTitle')} onClose={() => setFiltersOpen(false)} testID="cashflow-filters-sheet" width={480}>
            {controls}
            <Button testID="cashflow-filters-done" label={t('cashFlow.filtersDone')} onPress={() => setFiltersOpen(false)} />
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

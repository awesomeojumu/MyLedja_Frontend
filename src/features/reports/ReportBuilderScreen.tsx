import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { reportsApi } from '@/api/reports';
import { Button, Card, Confirm, Placeholder, SegmentedControl, Select, Sheet } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { BuilderSpecModel, ReportChart } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { FiltersSheet } from '@/features/transactions/FiltersSheet';
import type { TxFilters } from '@/features/transactions/filters';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { RangeBar, type DateRange } from '../cashflow/RangeBar';
import { BuilderPreview } from './BuilderPreview';
import { defaultBuilderName, EMPTY_SPEC, runBuilderPreview } from './builderRunner';
import { SaveReportSheet } from './reportSheets';

const sp = tokens.spacing;

const SHOWS: BuilderSpecModel['show'][] = ['spending', 'income', 'net', 'balance', 'count'];
const DIMS: BuilderSpecModel['groupBy'][] = ['category', 'group', 'payee', 'account', 'tag', 'month'];
const CHARTS: ReportChart[] = ['bar', 'line', 'area', 'donut', 'table'];

export { EMPTY_SPEC };

function txToReportFilters(f: TxFilters): BuilderSpecModel['filters'] {
  return {
    accountIds: f.accountId ? [f.accountId] : undefined,
    categoryIds: f.categoryId ? [f.categoryId] : undefined,
    payeeIds: f.payeeId ? [f.payeeId] : undefined,
    tagIds: f.tag ? [f.tag] : undefined,
    types: f.type ? [f.type] : undefined,
  };
}

function reportToTxFilters(f: BuilderSpecModel['filters']): TxFilters {
  return {
    accountId: f.accountIds?.[0],
    categoryId: f.categoryIds?.[0],
    payeeId: f.payeeIds?.[0],
    tag: f.tagIds?.[0],
    type: f.types?.[0] as TxFilters['type'],
  };
}

function activeFilterCount(f: BuilderSpecModel['filters']): number {
  let n = 0;
  if (f.accountIds?.length) n += 1;
  if (f.categoryIds?.length) n += 1;
  if (f.payeeIds?.length) n += 1;
  if (f.tagIds?.length) n += 1;
  if (f.types?.length) n += 1;
  return n;
}

/** Report builder (DESIGN.md page 21): make your own report; preview updates as you change anything. */
export function ReportBuilderScreen() {
  const params = useGlobalSearchParams<{ from?: string; to?: string; dashboard?: string }>();
  const { snapshot, repo } = useWorkspace();
  const { client, user } = useAuth();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const [spec, setSpec] = useState<BuilderSpecModel>(EMPTY_SPEC);
  const [dirty, setDirty] = useState(false);
  const [range, setRange] = useState<DateRange>({
    from: params.from ?? `${today().slice(0, 7)}-01`,
    to: params.to ?? today(),
  });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const set = (patch: Partial<BuilderSpecModel>) => {
    setDirty(true);
    setSpec((prev) => ({ ...prev, ...patch }));
  };
  const s = spec;

  useEffect(() => {
    void repo.ensureReportDashboards();
  }, [repo, snapshot?.settings.reportDashboards]);

  useEffect(() => {
    if (params.from === range.from && params.to === range.to) return;
    router.setParams({ from: range.from, to: range.to });
  }, [range.from, range.to, params.from, params.to, router]);

  const localPreview = useMemo(() => {
    if (!snapshot) return null;
    return runBuilderPreview(snapshot, s, range);
  }, [snapshot, s, range]);

  // Wire BE custom run (TECH-SPEC §8); local engine powers offline / tests.
  useEffect(() => {
    const workspaceId = user?.workspaceId;
    if (!workspaceId || !client) return;
    void reportsApi(client)
      .run(workspaceId, {
        kind: 'custom',
        from: range.from,
        to: range.to,
        interval: 'month',
        spec: s,
        filters: s.filters,
      })
      .catch(() => undefined);
  }, [client, user?.workspaceId, s, range.from, range.to]);

  const leave = () => router.push('/reports');
  const back = () => (dirty ? setLeaving(true) : leave());

  if (!snapshot || !localPreview) {
    return (
      <AppFrame title={t('reports.builder')}>
        <Placeholder height={420} />
      </AppFrame>
    );
  }

  const option = (k: BuilderSpecModel['groupBy']) => ({ value: k, label: t(`reports.dim.${k}` as TextKey) });
  const filterCount = activeFilterCount(s.filters);

  const controls = (
    <View style={{ gap: sp['spacing-sm'] }} testID="builder-controls">
      <Select
        testID="builder-show"
        label={t('reports.show')}
        value={s.show}
        onChange={(show) => set({ show })}
        options={SHOWS.map((k) => ({ value: k, label: t(`reports.show.${k}` as TextKey) }))}
      />
      <Select
        testID="builder-group"
        label={t('reports.groupBy')}
        value={s.groupBy}
        onChange={(groupBy) => set({ groupBy })}
        options={DIMS.map(option)}
      />
      <Select
        testID="builder-split"
        label={t('reports.splitBy')}
        value={s.splitBy ?? 'none'}
        onChange={(v) => set({ splitBy: v === 'none' ? null : (v as BuilderSpecModel['groupBy']) })}
        options={[{ value: 'none', label: t('reports.none') }, ...DIMS.filter((d) => d !== s.groupBy).map(option)]}
      />
      <SegmentedControl
        testID="builder-chart"
        label={t('reports.chart')}
        value={s.chart}
        onChange={(chart) => set({ chart })}
        options={CHARTS.map((k) => ({ value: k, label: t(`reports.chart.${k}` as TextKey) }))}
      />
      <RangeBar
        embedded
        range={range}
        onChange={(r) => {
          setDirty(true);
          setRange(r);
        }}
      />
      <Button
        testID="builder-filters"
        kind="secondary"
        label={filterCount ? `${t('reports.filters')} (${filterCount})` : t('reports.filters')}
        onPress={() => {
          setControlsOpen(false);
          setFiltersOpen(true);
        }}
      />
      <Button
        testID="builder-save"
        label={t('reports.saveReport')}
        onPress={() => {
          setControlsOpen(false);
          setSaving(true);
        }}
      />
    </View>
  );

  const preview = (
    <Card>
      <BuilderPreview testID="builder-preview" result={localPreview} />
    </Card>
  );

  return (
    <AppFrame title={t('reports.builder')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
        <Button testID="builder-back" kind="link" label={t('reports.back')} onPress={back} />
        <View style={{ flex: 1 }} />
        {phone ? <Button testID="builder-edit" kind="secondary" label={t('reports.editReport')} onPress={() => setControlsOpen(true)} /> : null}
      </View>
      {phone ? (
        <ScrollView>{preview}</ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', gap: sp['spacing-lg'], flex: 1 }}>
          <ScrollView style={{ maxWidth: 320 }}>
            <Card>{controls}</Card>
          </ScrollView>
          <ScrollView style={{ flex: 1 }}>{preview}</ScrollView>
        </View>
      )}
      {phone && controlsOpen ? (
        <Sheet visible testID="builder-sheet" title={t('reports.editReport')} onClose={() => setControlsOpen(false)}>
          {controls}
        </Sheet>
      ) : null}
      {filtersOpen ? (
        <FiltersSheet
          snapshot={snapshot}
          filters={reportToTxFilters(s.filters)}
          onClose={() => setFiltersOpen(false)}
          onApply={(f) => {
            const { dateFrom, dateTo, ...rest } = f;
            set({ filters: txToReportFilters(rest) });
            if (dateFrom && dateTo) {
              setDirty(true);
              setRange({ from: dateFrom, to: dateTo });
            }
            setFiltersOpen(false);
          }}
        />
      ) : null}
      {saving ? (
        <SaveReportSheet
          defaultName={defaultBuilderName(s, t('reports.range.custom'))}
          kind="custom"
          spec={s}
          initialDashboard={params.dashboard ?? ''}
          onClose={() => setSaving(false)}
          onSave={() => {
            setSaving(false);
            leave();
          }}
        />
      ) : null}
      <Confirm
        testID="builder-discard"
        visible={leaving}
        title={t('reports.discardTitle')}
        body={t('reports.discardBody')}
        confirmLabel={t('reports.discard')}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          leave();
        }}
      />
    </AppFrame>
  );
}

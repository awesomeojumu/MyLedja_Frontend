import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import { Button, Card, Confirm, Placeholder, SegmentedControl, Select, Sheet, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { BuilderSpecModel, RangePreset, ReportChart } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { newCard, RANGE_PRESETS } from './helpers';
import { ReportChartView, ReportTable } from './ReportView';
import { firstEventDate, rangeFor, runReport } from './runner';
import { useDashboards } from './useDashboards';

const sp = tokens.spacing;
const SHOWS: BuilderSpecModel['show'][] = ['spending', 'income', 'net', 'balance', 'count'];
const DIMS: BuilderSpecModel['groupBy'][] = ['category', 'group', 'payee', 'account', 'tag', 'month'];
const CHARTS: ReportChart[] = ['bar', 'line', 'area', 'donut', 'table'];

export const EMPTY_SPEC: BuilderSpecModel = { show: 'spending', groupBy: 'category', splitBy: null, chart: 'bar', filters: {} };

/** Report builder (DESIGN.md page 21): make your own report; the preview updates as you change anything. */
export function ReportBuilderScreen() {
  const params = useLocalSearchParams<{ dashboard?: string; card?: string }>();
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const { dashboards, ready, save, cardById } = useDashboards();
  const editing = params.card ? cardById(params.card) : null;
  const savedReport = editing?.card.savedReportId ? snapshot?.savedReports.find((s) => s.id === editing.card.savedReportId) : null;
  const initial: BuilderSpecModel = savedReport?.spec ?? editing?.card.spec ?? EMPTY_SPEC;
  const [spec, setSpec] = useState<BuilderSpecModel | null>(null);
  const s = spec ?? initial;
  const [range, setRange] = useState<RangePreset>(editing?.card.range ?? 'last_3_months');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const dirty = spec !== null;
  const onDate = today();
  const set = (patch: Partial<BuilderSpecModel>) => setSpec({ ...s, ...patch });

  const result = useMemo(() => {
    if (!snapshot) return null;
    const r = rangeFor(range, onDate, firstEventDate(snapshot));
    return runReport(snapshot, { kind: 'custom', ...r, interval: 'month', spec: s }, onDate);
  }, [snapshot, s, range, onDate]);

  const leave = () => router.push('/reports');
  const back = () => (dirty ? setLeaving(true) : leave());

  if (!ready || !snapshot || !result) {
    return (
      <AppFrame title={t('reports.builder')}>
        <Placeholder height={420} />
      </AppFrame>
    );
  }

  const option = (k: BuilderSpecModel['groupBy']) => ({ value: k, label: t(`reports.dim.${k}` as TextKey) });
  const filterOf = (ids: string[] | undefined) => ids?.[0] ?? '';
  const controls = (
    <View style={{ gap: sp['spacing-sm'] }} testID="builder-controls">
      <Select testID="builder-show" label={t('reports.show')} value={s.show} onChange={(show) => set({ show })} options={SHOWS.map((k) => ({ value: k, label: t(`reports.show.${k}` as TextKey) }))} />
      <Select testID="builder-group" label={t('reports.groupBy')} value={s.groupBy} onChange={(groupBy) => set({ groupBy })} options={DIMS.map(option)} />
      <Select
        testID="builder-split"
        label={t('reports.splitBy')}
        value={s.splitBy ?? 'none'}
        onChange={(v) => set({ splitBy: v === 'none' ? null : (v as BuilderSpecModel['groupBy']) })}
        options={[{ value: 'none', label: t('reports.none') }, ...DIMS.filter((d) => d !== s.groupBy).map(option)]}
      />
      <SegmentedControl testID="builder-chart" label={t('reports.chart')} value={s.chart} onChange={(chart) => set({ chart })} options={CHARTS.map((k) => ({ value: k, label: t(`reports.chart.${k}` as TextKey) }))} />
      <Select
        testID="builder-account"
        label={t('reports.accounts')}
        value={filterOf(s.filters.accountIds)}
        onChange={(v) => set({ filters: { ...s.filters, accountIds: v ? [v] : undefined } })}
        options={[{ value: '', label: t('reports.anyAccount') }, ...snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))]}
      />
      <Select
        testID="builder-category"
        label={t('reports.categories')}
        value={filterOf(s.filters.categoryIds)}
        onChange={(v) => set({ filters: { ...s.filters, categoryIds: v ? [v] : undefined } })}
        options={[{ value: '', label: t('reports.anyCategory') }, ...snapshot.categories.filter((c) => !c.hidden).map((c) => ({ value: c.id, label: c.name }))]}
      />
      <Select testID="builder-range" label={t('reports.range')} value={range} onChange={setRange} options={RANGE_PRESETS.map((r) => ({ value: r, label: t(`reports.range.${r}` as TextKey) }))} />
      <Button testID="builder-save" label={t('reports.saveReport')} onPress={() => setSaving(true)} />
    </View>
  );

  const preview = (
    <View style={{ flex: 1, gap: sp['spacing-md'] }}>
      <Card testID="builder-preview">
        <ReportChartView testID="builder-chart-preview" result={result} title={t('reports.preview')} chart={s.chart} highlight />
      </Card>
      {s.chart === 'table' ? null : (
        <Card>
          <ReportTable testID="builder-table" result={result} />
        </Card>
      )}
    </View>
  );

  return (
    <AppFrame title={savedReport?.name ?? t('reports.builder')}>
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
      {saving ? (
        <SaveReportSheet
          initialName={savedReport?.name ?? ''}
          dashboards={editing ? null : dashboards}
          initialDashboard={params.dashboard ?? dashboards[0]?.id ?? ''}
          onClose={() => setSaving(false)}
          onSave={async (name, dashboardId) => {
            const report = await repo.saveReport({ id: savedReport?.id, name, spec: s });
            if (editing && !savedReport) {
              const cards = editing.dashboard.cards.map((c) => (c.id === editing.card.id ? { ...c, savedReportId: report.id, spec: null, range } : c));
              await save(editing.dashboard.id, { cards });
            } else if (!editing && dashboardId) {
              const target = dashboards.find((d) => d.id === dashboardId);
              if (target) await save(dashboardId, { cards: [...target.cards, newCard(uuidv7(), 'custom', target.cards.length, { savedReportId: report.id, range })] });
            }
            setSaving(false);
            leave();
          }}
        />
      ) : null}
      <Confirm
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

function SaveReportSheet({
  initialName,
  dashboards,
  initialDashboard,
  onSave,
  onClose,
}: {
  initialName: string;
  /** Null when the report is already on a dashboard. */
  dashboards: { id: string; name: string }[] | null;
  initialDashboard: string;
  onSave: (name: string, dashboardId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [dashboardId, setDashboardId] = useState(initialDashboard);
  const [busy, setBusy] = useState(false);
  const ok = name.trim().length > 0 && !busy;
  return (
    <Sheet
      visible
      testID="save-report-sheet"
      title={t('reports.saveReport')}
      onClose={onClose}
      footer={
        <Button
          testID="save-report-confirm"
          label={t('reports.saveReport')}
          disabled={!ok}
          onPress={() => {
            setBusy(true);
            void onSave(name.trim(), dashboardId).finally(() => setBusy(false));
          }}
        />
      }
    >
      <TextInput testID="save-report-name" label={t('reports.reportName')} value={name} onChangeText={setName} maxLength={80} />
      {dashboards ? (
        <Select
          testID="save-report-dashboard"
          label={t('reports.dashboard')}
          value={dashboardId}
          onChange={setDashboardId}
          options={[{ value: '', label: t('reports.noDashboard') }, ...dashboards.map((d) => ({ value: d.id, label: d.name }))]}
        />
      ) : (
        <Text tone="textSecondary">{t('reports.savedOnDashboard')}</Text>
      )}
    </Sheet>
  );
}

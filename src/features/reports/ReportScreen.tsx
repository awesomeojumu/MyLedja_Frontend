import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, MoreHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import { Button, Card, EmptyState, Icon, Menu, Placeholder, Select, Sheet, Switch, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { BuilderSpecModel, RangePreset, ReportCardModel, ReportInterval } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { cardTitle, drillHref, rangeCaption, RANGE_PRESETS, reportCsv, shareCsv } from './helpers';
import { ReportChartView, ReportTable } from './ReportView';
import { firstEventDate, rangeFor, runReport } from './runner';
import { useDashboards } from './useDashboards';

const sp = tokens.spacing;
const INTERVALS: ReportInterval[] = ['day', 'week', 'month', 'year'];
const GROUPS: BuilderSpecModel['groupBy'][] = ['category', 'group', 'payee', 'account', 'tag', 'month'];
/** Reports whose rows can be grouped another way; they become a builder report for it. */
const REGROUP = new Set(['spending_by_category', 'custom']);

type Controls = { range: RangePreset; accountId: string; categoryId: string; groupBy: BuilderSpecModel['groupBy']; interval: ReportInterval; compare: boolean };

/** Report (DESIGN.md page 20): one report, full size, with its numbers. */
export function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const { dashboards, ready, save, cardById } = useDashboards();
  const found = id ? cardById(id) : null;
  const card = found?.card ?? null;
  const onDate = today();
  const savedSpec = card?.savedReportId ? (snapshot?.savedReports.find((s) => s.id === card.savedReportId)?.spec ?? null) : (card?.spec ?? null);

  const [controls, setControls] = useState<Controls | null>(null);
  const c: Controls = useMemo(
    () =>
      controls ?? {
        range: card?.range ?? 'this_month',
        accountId: '',
        categoryId: '',
        groupBy: savedSpec?.groupBy ?? 'category',
        interval: card?.interval ?? 'month',
        compare: false,
      },
    [controls, card, savedSpec],
  );
  const set = (patch: Partial<Controls>) => setControls({ ...c, ...patch });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  const result = useMemo(() => {
    if (!snapshot || !card) return null;
    const range = rangeFor(c.range, onDate, firstEventDate(snapshot));
    const filters = { ...(c.accountId ? { accountIds: [c.accountId] } : {}), ...(c.categoryId ? { categoryIds: [c.categoryId] } : {}) };
    const regroup = card.kind === 'spending_by_category' && c.groupBy !== 'category';
    const spec: BuilderSpecModel | null = regroup
      ? { show: 'spending', groupBy: c.groupBy, splitBy: null, chart: 'bar', filters: {} }
      : savedSpec && { ...savedSpec, groupBy: c.groupBy };
    return runReport(
      snapshot,
      { kind: regroup ? 'custom' : card.kind, ...range, interval: c.interval, compare: c.compare, filters, spec, formula: card.formula },
      onDate,
    );
  }, [snapshot, card, savedSpec, c, onDate]);

  const back = <Button testID="report-back" kind="link" label={t('reports.back')} onPress={() => router.push('/reports')} />;
  if (!ready || !snapshot) {
    return (
      <AppFrame title={t('reports.title')}>
        <Placeholder height={420} />
      </AppFrame>
    );
  }
  if (!card || !found || !result) {
    return (
      <AppFrame title={t('reports.title')}>
        {back}
        <EmptyState title={t('reports.missingTitle')} body={t('reports.missingBody')} actionLabel={t('reports.back')} onAction={() => router.push('/reports')} />
      </AppFrame>
    );
  }

  const title = cardTitle(card, snapshot.savedReports);
  const drill = (key: string) => {
    const d = result.drill[key];
    if (!d) return;
    router.push(drillHref({ ...d, ...(c.accountId && !d.accountId ? { accountId: c.accountId } : {}) }));
  };
  const copyTo = async (dashboardId: string) => {
    const target = dashboards.find((d) => d.id === dashboardId);
    if (!target) return;
    const copy: ReportCardModel = { ...card, id: uuidv7(), highlight: false, hidden: false, range: c.range, interval: c.interval };
    await save(dashboardId, { cards: [...target.cards, copy] });
  };

  const accounts = [{ value: '', label: t('reports.anyAccount') }, ...snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))];
  const categories = [{ value: '', label: t('reports.anyCategory') }, ...snapshot.categories.filter((x) => !x.hidden).map((x) => ({ value: x.id, label: x.name }))];
  const controlFields = (
    <View style={{ flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
      <Field>
        <Select testID="report-range" label={t('reports.range')} value={c.range} onChange={(range) => set({ range })} options={RANGE_PRESETS.map((r) => ({ value: r, label: t(`reports.range.${r}` as TextKey) }))} />
      </Field>
      <Field>
        <Select testID="report-account" label={t('reports.accounts')} value={c.accountId} onChange={(accountId) => set({ accountId })} options={accounts} />
      </Field>
      <Field>
        <Select testID="report-category" label={t('reports.categories')} value={c.categoryId} onChange={(categoryId) => set({ categoryId })} options={categories} />
      </Field>
      {REGROUP.has(card.kind) ? (
        <Field>
          <Select testID="report-group" label={t('reports.groupBy')} value={c.groupBy} onChange={(groupBy) => set({ groupBy })} options={GROUPS.map((g) => ({ value: g, label: t(`reports.dim.${g}` as TextKey) }))} />
        </Field>
      ) : null}
      <Field>
        <Select testID="report-interval" label={t('reports.interval')} value={c.interval} onChange={(interval) => set({ interval })} options={INTERVALS.map((i) => ({ value: i, label: t(`reports.interval.${i}` as TextKey) }))} />
      </Field>
      <Switch testID="report-compare" label={t('reports.compare')} value={c.compare} onChange={(compare) => set({ compare })} />
    </View>
  );

  return (
    <AppFrame title={title}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp['spacing-sm'] }}>
          {back}
          <View style={{ flex: 1 }} />
          {phone ? <Button testID="report-filters" kind="secondary" label={t('reports.filters')} onPress={() => setFiltersOpen(true)} /> : null}
          <Button testID="report-add-to-dashboard" kind="secondary" label={t('reports.addToDashboard')} onPress={() => setPlacing(true)} />
          <Button testID="report-export" kind="secondary" label={t('reports.exportCsv')} onPress={() => void shareCsv(reportCsv(result), title)} />
          <Menu
            testID="report-menu"
            trigger={(open) => (
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.options')} onPress={open} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon icon={MoreHorizontal} size="nav" />
              </Pressable>
            )}
            items={[
              { key: 'edit', label: t('reports.editInBuilder'), onPress: () => router.push(`/reports/build?card=${card.id}`) },
              { key: 'duplicate', label: t('reports.duplicate'), onPress: () => void copyTo(found.dashboard.id) },
            ]}
          />
        </View>
        {phone ? null : <Card>{controlFields}</Card>}
        <Card style={{ gap: sp['spacing-sm'] }}>
          <Text variant="caption" tone="textSecondary" testID="report-range-caption">
            {rangeCaption(result.range.from, result.range.to)}
          </Text>
          <ReportChartView testID="report-chart" result={result} title={title} chart={card.chart} highlight text={card.text} onRowPress={drill} />
          {result.partial.length ? (
            <Text variant="caption" tone="textSecondary" testID="report-partial">
              {t('reports.partial', { currencies: result.partial.join(', ') })}
            </Text>
          ) : null}
        </Card>
        {card.kind === 'note' ? null : (
          <Card>
            <ReportTable testID="report-table" result={result} onRowPress={Object.keys(result.drill).length ? drill : undefined} />
          </Card>
        )}
        <Card style={{ flexDirection: 'row', gap: sp['spacing-sm'] }} testID="report-about">
          <Icon icon={Info} size="row" />
          <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
            <Text variant="heading-sm">{t('reports.whatThisShows')}</Text>
            <Text tone="textSecondary">{t(`reports.about.${card.kind}` as TextKey)}</Text>
          </View>
        </Card>
      </ScrollView>
      {filtersOpen ? (
        <Sheet visible testID="report-filters-sheet" title={t('reports.filters')} onClose={() => setFiltersOpen(false)} footer={<Button label={t('common.close')} onPress={() => setFiltersOpen(false)} />}>
          {controlFields}
        </Sheet>
      ) : null}
      {placing ? (
        <PlaceSheet
          dashboards={dashboards}
          onClose={() => setPlacing(false)}
          onPick={async (dashboardId) => {
            setPlacing(false);
            await copyTo(dashboardId);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <View style={{ minWidth: 180, flexGrow: 1 }}>{children}</View>;
}

/** Add to dashboard: which dashboard the card goes on. */
export function PlaceSheet({ dashboards, onPick, onClose }: { dashboards: { id: string; name: string }[]; onPick: (id: string) => void; onClose: () => void }) {
  const [id, setId] = useState(dashboards[0]?.id ?? '');
  return (
    <Sheet
      visible
      testID="place-sheet"
      title={t('reports.addToDashboard')}
      onClose={onClose}
      footer={<Button testID="place-save" label={t('reports.addToDashboard')} disabled={!id} onPress={() => onPick(id)} />}
    >
      <Select testID="place-dashboard" label={t('reports.dashboard')} value={id} onChange={setId} options={dashboards.map((d) => ({ value: d.id, label: d.name }))} />
    </Sheet>
  );
}

import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { Info, MoreHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { reportsApi, type ReportDimension, type ReportInterval, type ReportResultWire, type RunReportBody } from '@/api/reports';
import { Button, Card, EmptyState, Icon, Menu, Placeholder, Select, Sheet, Switch, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { ReportCard, ReportDashboard } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { RangeBar, type DateRange } from '@/features/cashflow/RangeBar';
import { FiltersSheet } from '@/features/transactions/FiltersSheet';
import { emptyFilters, type TxFilters } from '@/features/transactions/filters';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { aboutKey, drillHref, rangeCaption, reportCsv, shareCsv, viewResult, type ViewReportResult } from './helpers';
import { apiKind, canRegroup } from './kinds';
import { ReportChartView, ReportTable } from './ReportView';
import { SaveReportSheet } from './reportSheets';

const sp = tokens.spacing;
const INTERVALS: ReportInterval[] = ['day', 'week', 'month', 'year'];
const GROUPS: ReportDimension[] = ['category', 'group', 'payee', 'account', 'tag', 'month'];

type Found = { dashboard: ReportDashboard; card: ReportCard };
type LoadState = { status: 'idle' | 'loading' | 'ready' | 'error'; result: ViewReportResult | null };

/** Optional inject for tests — otherwise calls BE `POST …/reports/run`. */
export type ReportRunner = (workspaceId: string, body: RunReportBody) => Promise<ReportResultWire>;

function paramOne(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Report (DESIGN.md page 20): one report, full size, with its numbers. */
export function ReportScreen({ runner }: { runner?: ReportRunner } = {}) {
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const id = paramOne(rawId);
  const params = useGlobalSearchParams<{ from?: string; to?: string }>();
  const { snapshot, repo } = useWorkspace();
  const { client } = useAuth();
  const api = useMemo(() => reportsApi(client), [client]);
  const run = runner ?? api.run;
  const workspaceId = repo.workspaceId;
  const router = useRouter();
  const toast = useToast();
  const phone = useSizeClass() === 'phone';
  const [dashboards, setDashboards] = useState<ReportDashboard[] | null>(null);
  const [range, setRange] = useState<DateRange>({
    from: paramOne(params.from) ?? `${today().slice(0, 7)}-01`,
    to: paramOne(params.to) ?? today(),
  });
  const [interval, setInterval] = useState<ReportInterval>('month');
  const [groupBy, setGroupBy] = useState<ReportDimension>('category');
  const [compare, setCompare] = useState(false);
  const [txFilters, setTxFilters] = useState<TxFilters>(emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pu19Open, setPu19Open] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [load, setLoad] = useState<LoadState>({ status: 'idle', result: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void repo.ensureReportDashboards().then(setDashboards);
  }, [repo, snapshot?.settings.reportDashboards]);

  const found: Found | null = (() => {
    if (!id || !dashboards) return null;
    for (const d of dashboards) {
      const card = d.cards.find((c) => c.id === id);
      if (card) return { dashboard: d, card };
    }
    return null;
  })();

  const card = found?.card ?? null;
  const title = card?.title || t('reports.title');

  const filterCount =
    (txFilters.accountId ? 1 : 0) +
    (txFilters.categoryId ? 1 : 0) +
    (txFilters.payeeId ? 1 : 0) +
    (compare ? 1 : 0) +
    (interval !== 'month' ? 1 : 0) +
    (groupBy !== 'category' ? 1 : 0);

  const buildBody = useCallback((): RunReportBody | null => {
    if (!card) return null;
    const kind = apiKind(card.kind);
    const filters = {
      ...(txFilters.accountId ? { accountIds: [txFilters.accountId] } : {}),
      ...(txFilters.categoryId ? { categoryIds: [txFilters.categoryId] } : {}),
      ...(txFilters.payeeId ? { payeeIds: [txFilters.payeeId] } : {}),
    };
    const regroup = canRegroup(card.kind) && groupBy !== 'category';
    const body: RunReportBody = {
      kind: regroup ? 'custom' : kind,
      from: range.from,
      to: range.to,
      interval,
      compare,
      filters,
    };
    if (regroup || kind === 'custom') {
      body.spec = {
        show: 'spending',
        groupBy,
        splitBy: null,
        chart: 'bar',
        filters: {},
      };
    }
    return body;
  }, [card, txFilters, groupBy, range, interval, compare]);

  useEffect(() => {
    if (!card || !workspaceId) return;
    const body = buildBody();
    if (!body) return;
    let alive = true;
    // Mark loading only after scheduling the request (callback), not as a sync effect body cascade.
    queueMicrotask(() => {
      if (alive) setLoad((prev) => ({ status: 'loading', result: prev.result }));
    });
    void run(workspaceId, body).then(
      (wire) => {
        if (!alive) return;
        setLoad({ status: 'ready', result: viewResult(wire) });
      },
      () => {
        if (!alive) return;
        setLoad({ status: 'error', result: null });
      },
    );
    return () => {
      alive = false;
    };
  }, [card, workspaceId, buildBody, run, tick]);

  const back = <Button testID="report-back" kind="link" label={t('reports.back')} onPress={() => router.push('/reports')} />;
  const result = load.result;

  if (!dashboards || (load.status === 'loading' && !result && card) || (load.status === 'idle' && card)) {
    return (
      <AppFrame title={t('reports.title')}>
        {back}
        <Placeholder height={420} testID="report-loading" />
      </AppFrame>
    );
  }

  if (!card || !found) {
    return (
      <AppFrame title={t('reports.title')}>
        {back}
        <View testID="report-missing">
          <EmptyState title={t('reports.missingTitle')} body={t('reports.missingBody')} actionLabel={t('reports.back')} onAction={() => router.push('/reports')} />
        </View>
      </AppFrame>
    );
  }

  if (load.status === 'error' || !result) {
    return (
      <AppFrame title={title}>
        {back}
        <View testID="report-load-failed">
          <EmptyState title={t('reports.loadFailed')} body={t('reports.missingBody')} actionLabel={t('reports.retry')} onAction={() => setTick((n) => n + 1)} />
        </View>
      </AppFrame>
    );
  }

  const drill = (key: string) => {
    const d = result.drill[key];
    if (!d) return;
    router.push(drillHref(d));
  };

  const copyTo = async (dashboardId: string) => {
    if (!dashboards || !card) return;
    const copy: ReportCard = { ...card, id: `card-${Date.now()}`, hidden: false };
    await repo.saveReportDashboards(dashboards.map((d) => (d.id === dashboardId ? { ...d, cards: [...d.cards, copy] } : d)));
    toast.show(t('reports.reportAdded'));
  };

  const controlFields = (
    <View style={{ gap: sp['spacing-md'] }}>
      <RangeBar
        range={range}
        onChange={(r) => {
          setRange(r);
          router.setParams({ from: r.from, to: r.to });
        }}
        compare={compare}
        onCompareChange={setCompare}
        embedded={phone}
      />
      <View style={{ flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
        {canRegroup(card.kind) ? (
          <Field>
            <Select
              testID="report-group"
              label={t('reports.groupBy')}
              value={groupBy}
              onChange={(v) => setGroupBy(v as ReportDimension)}
              options={GROUPS.map((g) => ({ value: g, label: t(`reports.dim.${g}` as TextKey) }))}
            />
          </Field>
        ) : null}
        <Field>
          <Select
            testID="report-interval"
            label={t('reports.interval')}
            value={interval}
            onChange={(v) => setInterval(v as ReportInterval)}
            options={INTERVALS.map((i) => ({ value: i, label: t(`reports.interval.${i}` as TextKey) }))}
          />
        </Field>
        <Switch testID="report-compare" label={t('reports.compare')} value={compare} onChange={setCompare} />
      </View>
      <Button testID="report-pu19" kind="secondary" label={t('reports.openFilters')} onPress={() => setPu19Open(true)} />
    </View>
  );

  return (
    <AppFrame title={title}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }} style={{ maxWidth: '100%' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sp['spacing-sm'] }}>
          {back}
          <View style={{ flex: 1 }} />
          {phone ? (
            <Button
              testID="report-filters"
              kind="secondary"
              label={t('reports.filtersCount', { count: String(Math.max(1, filterCount)) })}
              onPress={() => setFiltersOpen(true)}
            />
          ) : null}
          <Button testID="report-add-to-dashboard" kind="secondary" label={t('reports.addToDashboard')} onPress={() => setPlacing(true)} />
          <Button testID="report-export" kind="secondary" label={t('reports.exportCsv')} onPress={() => void shareCsv(reportCsv(result), title)} />
          <Menu
            testID="report-menu"
            trigger={(open) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.options')}
                onPress={open}
                style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon icon={MoreHorizontal} size="nav" />
              </Pressable>
            )}
            items={[
              { key: 'edit', label: t('reports.editInBuilder'), onPress: () => toast.show(t('reports.buildOwn')) },
              { key: 'duplicate', label: t('reports.duplicate'), onPress: () => setDuplicateOpen(true) },
            ]}
          />
        </View>
        {phone ? null : <Card testID="report-controls">{controlFields}</Card>}
        <Card style={{ gap: sp['spacing-sm'] }}>
          <Text variant="caption" tone="textSecondary" testID="report-range-caption">
            {rangeCaption(result.from, result.to)}
          </Text>
          <ReportChartView testID="report-chart" result={result} title={title} highlight onRowPress={drill} />
          {result.partial.length ? (
            <Text variant="caption" tone="textSecondary" testID="report-partial">
              {t('reports.partial', { currencies: result.partial.join(', ') })}
            </Text>
          ) : null}
        </Card>
        {result.chart === 'note' ? null : (
          <Card>
            <ReportTable testID="report-table" result={result} onRowPress={Object.keys(result.drill).length ? drill : undefined} />
          </Card>
        )}
        <Card style={{ flexDirection: 'row', gap: sp['spacing-sm'] }} testID="report-about">
          <Icon icon={Info} size="row" />
          <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
            <Text variant="heading-sm">{t('reports.whatThisShows')}</Text>
            <Text tone="textSecondary">{t(aboutKey(card.kind))}</Text>
          </View>
        </Card>
      </ScrollView>
      {filtersOpen ? (
        <Sheet
          visible
          testID="report-filters-sheet"
          title={t('reports.filters')}
          onClose={() => setFiltersOpen(false)}
          footer={<Button label={t('common.close')} onPress={() => setFiltersOpen(false)} />}
        >
          {controlFields}
        </Sheet>
      ) : null}
      {pu19Open && snapshot ? (
        <FiltersSheet
          snapshot={snapshot}
          filters={txFilters}
          onClose={() => setPu19Open(false)}
          onApply={(f) => {
            setTxFilters(f);
            if (f.dateFrom && f.dateTo) {
              const next = { from: f.dateFrom, to: f.dateTo };
              setRange(next);
              router.setParams(next);
            }
            setPu19Open(false);
            setFiltersOpen(false);
          }}
        />
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
      {duplicateOpen ? (
        <SaveReportSheet
          defaultName={title}
          kind={card.kind}
          onClose={() => setDuplicateOpen(false)}
          onSave={(saved) => {
            if (saved.dashboardId) {
              void copyTo(saved.dashboardId);
            }
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <View style={{ minWidth: 180, flexGrow: 1 }}>{children}</View>;
}

function PlaceSheet({ dashboards, onPick, onClose }: { dashboards: { id: string; name: string }[]; onPick: (id: string) => void; onClose: () => void }) {
  const [pickId, setPickId] = useState(dashboards[0]?.id ?? '');
  return (
    <Sheet
      visible
      testID="place-sheet"
      title={t('reports.addToDashboard')}
      onClose={onClose}
      footer={<Button testID="place-save" label={t('reports.addToDashboard')} disabled={!pickId} onPress={() => onPick(pickId)} />}
    >
      <Select testID="place-dashboard" label={t('reports.dashboard')} value={pickId} onChange={setPickId} options={dashboards.map((d) => ({ value: d.id, label: d.name }))} />
    </Sheet>
  );
}

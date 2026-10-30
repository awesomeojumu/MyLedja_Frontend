import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { reportsApi, type ReportResultWire, type RunReportBody } from '@/api/reports';
import type { RangePreset, ReportKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignEmpty,
  RedesignIcon,
  RedesignListRow,
  RedesignProgress,
  RedesignSheet,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignSwitch,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';

import {
  cardTitle,
  drillHref,
  reportCsv,
  rowLabel,
  shareCsv,
  valueText,
  viewResult,
  type ViewReportResult,
} from './helpers';
import { rangeFor } from './runner';
import { useDashboards } from './useDashboards';

const sp = tokens.space;
const shape = tokens.shape;

function monthLong(monthKey: string): string {
  const m = Number(monthKey.slice(5, 7));
  return t(`date.monthLong.${m}` as TextKey);
}

/** Figma Phone / Report chips (5:2387): This month · Last month · 3 months · This year. */
const RANGE_CHIPS: { key: RangePreset; labelKey: 'reports.redesign.chipThisMonth' | 'reports.redesign.chipLastMonth' | 'reports.redesign.chip3Months' | 'reports.redesign.chipThisYear' }[] = [
  { key: 'this_month', labelKey: 'reports.redesign.chipThisMonth' },
  { key: 'last_month', labelKey: 'reports.redesign.chipLastMonth' },
  { key: 'last_3_months', labelKey: 'reports.redesign.chip3Months' },
  { key: 'this_year', labelKey: 'reports.redesign.chipThisYear' },
];

type LoadState = { status: 'idle' | 'loading' | 'ready' | 'error'; result: ViewReportResult | null };

export type ReportRunner = (workspaceId: string, body: RunReportBody) => Promise<ReportResultWire>;

function paramOne(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function totalLabel(kind: ReportKind, monthKey: string): string {
  const month = monthLong(monthKey);
  if (kind === 'spending_by_category' || kind === 'spending_trends' || kind === 'custom') {
    return t('reports.redesign.spentIn', { month });
  }
  if (kind === 'income_vs_expenses' || kind === 'income_steadiness') {
    return t('reports.redesign.receivedIn', { month });
  }
  if (kind === 'net_worth') return t('reports.redesign.netWorthTotal');
  return t('reports.redesign.totalIn', { month });
}

function compareLine(current: bigint, previous: bigint | null, previousFrom: string | null, privacy: boolean): string {
  if (previous === null) return '';
  const delta = current - previous;
  const amount = privacy ? PRIVACY_MASK : formatNaira(delta < 0n ? -delta : delta);
  const signed = delta < 0n ? `−${amount}` : delta > 0n ? `+${amount}` : amount;
  const month = previousFrom ? monthLong(previousFrom.slice(0, 7)) : '';
  return t('reports.redesign.comparedWith', { amount: signed, month });
}

/**
 * Figma Mobile App Phone / Report (5:2369) + Share (12:6128) + Loading / Could not load.
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignReportScreen({ runner }: { runner?: ReportRunner } = {}) {
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const id = paramOne(rawId);
  const params = useGlobalSearchParams<{ range?: string; view?: string; share?: string }>();
  const { snapshot, repo } = useWorkspace();
  const { client } = useAuth();
  const api = useMemo(() => reportsApi(client), [client]);
  const run = runner ?? api.run;
  const workspaceId = repo.workspaceId;
  const router = useRouter();
  const { ready, cardById } = useDashboards();

  const preset = (RANGE_CHIPS.some((c) => c.key === params.range) ? params.range : 'this_month') as RangePreset;
  const tableView = params.view === 'table';
  const shareOpen = params.share === '1';
  const onDate = today();
  const bounds = rangeFor(preset, onDate, null);

  const [load, setLoad] = useState<LoadState>({ status: 'idle', result: null });
  const [tick, setTick] = useState(0);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const found = id ? cardById(id) : null;
  const card = found?.card ?? null;
  const title = card && snapshot ? cardTitle(card, snapshot.savedReports) : t('reports.title');
  const savedSpec = card?.savedReportId
    ? (snapshot?.savedReports.find((r) => r.id === card.savedReportId)?.spec ?? null)
    : (card?.spec ?? null);

  const buildBody = useCallback((): RunReportBody | null => {
    if (!card) return null;
    const body: RunReportBody = {
      kind: card.kind === 'custom' ? 'custom' : card.kind,
      from: bounds.from,
      to: bounds.to,
      interval: 'month',
      compare: true,
      filters: {},
    };
    if (card.kind === 'custom') {
      body.spec = savedSpec ?? { show: 'spending', groupBy: 'category', splitBy: null, chart: 'bar', filters: {} };
    }
    if (card.kind === 'formula' && card.formula) body.formula = card.formula;
    return body;
  }, [card, bounds.from, bounds.to, savedSpec]);

  useEffect(() => {
    if (!card || !workspaceId) return;
    const body = buildBody();
    if (!body) return;
    let alive = true;
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

  const result = load.result;
  const privacy = hideAmounts;
  const monthKey = bounds.to.slice(0, 7);

  const setPreset = (key: RangePreset) => router.setParams({ range: key });
  const openShare = () => router.setParams({ share: '1' });
  const closeShare = () => {
    setShareNote(null);
    router.setParams({ share: undefined });
  };
  const toggleTable = () => router.setParams({ view: tableView ? undefined : 'table' });

  const onCsv = async () => {
    if (!result) return;
    await shareCsv(reportCsv(result), title);
    closeShare();
  };

  const onPdf = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
      closeShare();
      return;
    }
    setShareNote(t('reports.redesign.pdfSoon'));
  };

  const onImage = () => {
    setShareNote(t('reports.shareUnavailable'));
  };

  const frame = (body: React.ReactNode) => (
    <RedesignStackFrame
      testID="redesign-report"
      title={title}
      onBack={() => router.push('/reports')}
      trailing={
        card ? (
          <Pressable
            testID="redesign-report-more"
            accessibilityRole="button"
            accessibilityLabel={t('reports.redesign.shareOrExport')}
            onPress={openShare}
            style={{
              width: tokens.density.touch.minTarget,
              height: tokens.density.touch.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignIcon name="more" size={24} color={theme.text} />
          </Pressable>
        ) : (
          <View style={{ width: tokens.density.touch.minTarget }} />
        )
      }
    >
      {body}
    </RedesignStackFrame>
  );

  if (!ready || (card && load.status === 'idle') || (card && load.status === 'loading' && !result)) {
    return frame(
      <View testID="redesign-report-loading" style={{ gap: sp.lg }}>
        <RedesignSkeleton height={36} />
        <RedesignSkeleton height={120} />
        <RedesignSkeleton height={220} />
      </View>,
    );
  }

  if (!card || !found) {
    return frame(
      <View testID="redesign-report-missing">
        <RedesignEmpty
          title={t('reports.missingTitle')}
          body={t('reports.missingBody')}
          actionLabel={t('reports.back')}
          onAction={() => router.push('/reports')}
        />
      </View>,
    );
  }

  if (load.status === 'error' || !result) {
    return frame(
      <View testID="redesign-report-failed">
        <RedesignEmpty
          title={t('reports.redesign.loadFailedTitle')}
          body={t('reports.redesign.loadFailedBody')}
          actionLabel={t('reports.redesign.tryAgain')}
          onAction={() => setTick((n) => n + 1)}
        />
      </View>,
    );
  }

  const rows = result.table.rows;
  const total = result.table.total;
  const previousTotal = result.previous?.total ?? null;
  const compare = compareLine(total, previousTotal, result.finding?.previousFrom ?? result.from, privacy);
  const maxRow = rows.reduce((m, r) => (r.total > m ? r.total : m), 0n);

  return frame(
    <>
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
          {RANGE_CHIPS.map((chip) => (
            <RedesignChip
              key={chip.key}
              testID={`redesign-report-range-${chip.key}`}
              label={t(chip.labelKey)}
              selected={preset === chip.key}
              onPress={() => setPreset(chip.key)}
            />
          ))}
        </ScrollView>

        <View
          testID="redesign-report-total"
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            padding: sp.lg,
            gap: sp.sm,
          }}
        >
          <RedesignText variant="label" tone="textSecondary">
            {totalLabel(card.kind, monthKey)}
          </RedesignText>
          <RedesignAmount
            testID="redesign-report-amount"
            text={valueText(total, result.unit)}
            hidden={privacy}
            sizeVariant="display"
          />
          {compare ? (
            <RedesignText testID="redesign-report-compare" tone="textSecondary">
              {compare}
            </RedesignText>
          ) : null}
        </View>

        {tableView ? (
          <View
            testID="redesign-report-table"
            style={{
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              overflow: 'hidden',
            }}
          >
            {rows.map((row) => (
              <Pressable
                key={row.key}
                testID={`redesign-report-table-row-${row.key}`}
                accessibilityRole="button"
                onPress={() => {
                  const d = result.drill[row.key];
                  if (d) router.push(drillHref(d));
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: 48,
                  paddingHorizontal: sp.md,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  gap: sp.md,
                }}
              >
                <RedesignText style={{ flex: 1 }} numberOfLines={1}>
                  {rowLabel(row)}
                </RedesignText>
                <RedesignText style={{ fontVariant: ['tabular-nums'] }}>
                  {privacy ? PRIVACY_MASK : valueText(row.total, result.unit)}
                </RedesignText>
              </Pressable>
            ))}
          </View>
        ) : (
          <View
            testID="redesign-report-breakdown"
            style={{
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              padding: sp.lg,
              gap: sp.md,
            }}
          >
            {rows.map((row) => {
              const pct = total === 0n ? 0 : Math.round(Number((row.total * 1000n) / total) / 10);
              return (
                <Pressable
                  key={row.key}
                  testID={`redesign-report-row-${row.key}`}
                  accessibilityRole="button"
                  onPress={() => {
                    const d = result.drill[row.key];
                    if (d) router.push(drillHref(d));
                  }}
                  style={{ gap: sp.xs }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                    <RedesignText style={{ flex: 1 }} numberOfLines={1}>
                      {rowLabel(row)}
                    </RedesignText>
                    <RedesignText variant="helper" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
                      {`${pct}%`}
                    </RedesignText>
                    <RedesignText style={{ fontVariant: ['tabular-nums'], minWidth: 88, textAlign: 'right' }}>
                      {privacy ? PRIVACY_MASK : valueText(row.total, result.unit)}
                    </RedesignText>
                  </View>
                  <RedesignProgress
                    testID={`redesign-report-bar-${row.key}`}
                    value={Number(row.total > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : row.total)}
                    max={Number(maxRow > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : maxRow) || 1}
                  />
                </Pressable>
              );
            })}
          </View>
        )}

        <RedesignButton
          testID="redesign-report-view-table"
          kind="secondary"
          label={tableView ? t('reports.redesign.viewAsBars') : t('reports.redesign.viewAsTable')}
          onPress={toggleTable}
        />
      </ScrollView>

      {shareOpen ? (
        <RedesignSheet visible title={t('reports.redesign.shareReport')} onClose={closeShare} testID="redesign-report-share">
          <RedesignListRow
            testID="redesign-report-share-pdf"
            title={t('reports.redesign.savePdf')}
            subtitle={t('reports.redesign.savePdfBody')}
            onPress={onPdf}
          />
          <RedesignListRow
            testID="redesign-report-share-csv"
            title={t('reports.redesign.saveCsv')}
            subtitle={t('reports.redesign.saveCsvBody')}
            onPress={() => void onCsv()}
          />
          <RedesignListRow
            testID="redesign-report-share-image"
            title={t('reports.redesign.shareImage')}
            subtitle={t('reports.redesign.shareImageBody')}
            onPress={onImage}
          />
          <RedesignSwitch
            testID="redesign-report-hide-amounts"
            label={t('reports.redesign.hideAmounts')}
            value={hideAmounts}
            onChange={setHideAmounts}
          />
          {shareNote ? (
            <RedesignText testID="redesign-report-share-note" tone="textSecondary">
              {shareNote}
            </RedesignText>
          ) : null}
        </RedesignSheet>
      ) : null}
    </>,
  );
}

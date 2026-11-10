import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import type { BuilderSpecModel, RangePreset, ReportCardModel, ReportKind, SavedReportModel } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignButton,
  RedesignChip,
  RedesignIcon,
  RedesignListRow,
  RedesignSheet,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';

import { GALLERY, kindName, newCard } from './helpers';
import { useDashboards } from './useDashboards';

const sp = tokens.space;
const shape = tokens.shape;

type FeaturedKey = 'spending_by_category' | 'income_vs_expenses' | 'net_worth' | 'spending_by_payee';

type FeaturedEntry = {
  key: FeaturedKey;
  kind: ReportKind;
  titleKey: TextKey;
  bodyKey: TextKey;
  range: ReportCardModel['range'];
  title?: string;
  spec?: BuilderSpecModel;
};

/** Figma Mobile Phone / Reports (5:2297) featured catalogue. */
const FEATURED: FeaturedEntry[] = [
  {
    key: 'spending_by_category',
    kind: 'spending_by_category',
    titleKey: 'reports.redesign.spendingByCategory',
    bodyKey: 'reports.redesign.spendingByCategoryBody',
    range: 'this_month',
  },
  {
    key: 'income_vs_expenses',
    kind: 'income_vs_expenses',
    titleKey: 'reports.redesign.incomeAndSpending',
    bodyKey: 'reports.redesign.incomeAndSpendingBody',
    range: 'last_12_months',
  },
  {
    key: 'net_worth',
    kind: 'net_worth',
    titleKey: 'reports.redesign.netWorth',
    bodyKey: 'reports.redesign.netWorthBody',
    range: 'this_month',
  },
  {
    key: 'spending_by_payee',
    kind: 'custom',
    titleKey: 'reports.redesign.spendingByPayee',
    bodyKey: 'reports.redesign.spendingByPayeeBody',
    range: 'this_month',
    title: 'Spending by payee',
    spec: { show: 'spending', groupBy: 'payee', splitBy: null, chart: 'bar', filters: {} },
  },
];

const DATE_PRESETS: { key: RangePreset; labelKey: TextKey }[] = [
  { key: 'this_month', labelKey: 'reports.redesign.chipThisMonth' },
  { key: 'last_month', labelKey: 'reports.redesign.chipLastMonth' },
  { key: 'last_3_months', labelKey: 'reports.redesign.chip3Months' },
  { key: 'this_year', labelKey: 'reports.redesign.chipThisYear' },
];

function matchesFeatured(card: ReportCardModel, entry: FeaturedEntry): boolean {
  if (entry.key === 'spending_by_payee') {
    return card.kind === 'custom' && (card.title === entry.title || card.spec?.groupBy === 'payee');
  }
  return card.kind === entry.kind && !card.savedReportId;
}

function matchesSaved(card: ReportCardModel, savedId: string): boolean {
  return card.kind === 'custom' && card.savedReportId === savedId;
}

type TemplateKey = 'executive' | 'debt' | 'tax';

/**
 * Figma Mobile App Phone / Reports (5:2297).
 * Upgraded with Global Time Horizon Sync, Financial Anomaly Insights,
 * Pre-built Dashboard Templates, and Executive Export.
 */
export function RedesignReportsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const params = useGlobalSearchParams<{ addReport?: string; range?: string }>();
  const { dashboards, ready, save } = useDashboards();
  const [busy, setBusy] = useState(false);
  const [selectedRange, setSelectedRange] = useState<RangePreset>((params.range as RangePreset) || 'this_month');
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('executive');

  const overview = dashboards[0] ?? null;
  const saved = snapshot?.savedReports ?? [];
  const adding = params.addReport === '1';

  const openAdd = () => router.setParams({ addReport: '1' });
  const closeAdd = () => router.setParams({ addReport: undefined });

  // Compute financial anomaly insights from recent events
  const anomaly = useMemo(() => {
    if (!snapshot || snapshot.events.length === 0) return null;
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthEvents = snapshot.events.filter((e) => e.date.startsWith(thisMonthPrefix) && e.status === 'posted');
    const spentThisMonth = thisMonthEvents
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + e.lines.filter((l) => l.amountMinor < 0n).reduce((sum, l) => sum + -l.amountMinor, 0n), 0n);

    if (spentThisMonth > 0n) {
      return {
        text: t('reports.redesign.comparedWith', {
          amount: formatNaira(spentThisMonth),
          month: t(`date.monthLong.${now.getMonth() + 1}` as TextKey),
        }),
      };
    }
    return null;
  }, [snapshot]);

  const ensureAndOpen = useCallback(
    async (find: (card: ReportCardModel) => boolean, make: () => ReportCardModel) => {
      if (!overview || busy) return;
      const existing = overview.cards.find(find);
      if (existing) {
        router.push(`/reports/view/${existing.id}?range=${selectedRange}`);
        return;
      }
      setBusy(true);
      try {
        const card = make();
        card.range = selectedRange;
        await save(overview.id, { cards: [...overview.cards, card] });
        router.push(`/reports/view/${card.id}?range=${selectedRange}`);
      } finally {
        setBusy(false);
      }
    },
    [overview, busy, save, router, selectedRange],
  );

  const openFeatured = (entry: FeaturedEntry) => {
    void ensureAndOpen(
      (c) => matchesFeatured(c, entry),
      () =>
        newCard(uuidv7(), entry.kind, overview?.cards.length ?? 0, {
          range: selectedRange,
          title: entry.title ?? null,
          spec: entry.spec ?? null,
        }),
    );
  };

  const openSaved = (report: SavedReportModel) => {
    void ensureAndOpen(
      (c) => matchesSaved(c, report.id),
      () =>
        newCard(uuidv7(), 'custom', overview?.cards.length ?? 0, {
          savedReportId: report.id,
          title: report.name,
          range: selectedRange,
        }),
    );
  };

  const addKind = (kind: ReportKind, savedId: string | null = null) => {
    closeAdd();
    if (savedId) {
      const report = saved.find((s) => s.id === savedId);
      if (report) openSaved(report);
      return;
    }
    const featured = FEATURED.find((e) => e.kind === kind && e.key !== 'spending_by_payee');
    if (featured) {
      openFeatured(featured);
      return;
    }
    void ensureAndOpen(
      (c) => c.kind === kind && !c.savedReportId,
      () => newCard(uuidv7(), kind, overview?.cards.length ?? 0),
    );
  };

  const onExportExecutivePdf = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <RedesignStackFrame
      testID="redesign-reports"
      title={t('reports.title')}
      onBack={() => router.back()}
      trailing={
        <Pressable
          testID="redesign-reports-add"
          accessibilityRole="button"
          accessibilityLabel={t('reports.addReport')}
          onPress={openAdd}
          style={{
            width: tokens.density.touch.minTarget,
            height: tokens.density.touch.minTarget,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RedesignIcon name="plus" size={24} color={theme.text} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        {!ready || !snapshot ? (
          <RedesignSkeleton height={220} testID="redesign-reports-skeleton" />
        ) : (
          <>
            {/* Global Time Horizon Selector */}
            <View style={{ gap: sp.xs }}>
              <RedesignText variant="caption" tone="textSecondary">
                {t('reports.redesign.timeHorizon')}
              </RedesignText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
                {DATE_PRESETS.map((p) => (
                  <RedesignChip
                    key={p.key}
                    testID={`redesign-reports-date-${p.key}`}
                    label={t(p.labelKey)}
                    selected={selectedRange === p.key}
                    onPress={() => setSelectedRange(p.key)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Financial Anomaly Insights Card */}
            {anomaly ? (
              <View
                testID="redesign-reports-anomaly"
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: shape['radius-lg'],
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: sp.md,
                  gap: sp.xs,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                  <RedesignIcon name="trending-up" size={16} color={theme.primary} />
                  <RedesignText variant="label">{t('reports.redesign.anomalyTitle')}</RedesignText>
                </View>
                <RedesignText variant="caption" tone="textSecondary">
                  {anomaly.text}
                </RedesignText>
              </View>
            ) : null}

            {/* Dashboard Templates */}
            <View style={{ gap: sp.xs }}>
              <RedesignText variant="label" tone="textSecondary">
                {t('reports.redesign.templatesTitle')}
              </RedesignText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
                <RedesignChip
                  testID="redesign-template-executive"
                  label={t('reports.redesign.templateExecutive')}
                  selected={activeTemplate === 'executive'}
                  onPress={() => setActiveTemplate('executive')}
                />
                <RedesignChip
                  testID="redesign-template-debt"
                  label={t('reports.redesign.templateDebt')}
                  selected={activeTemplate === 'debt'}
                  onPress={() => setActiveTemplate('debt')}
                />
                <RedesignChip
                  testID="redesign-template-tax"
                  label={t('reports.redesign.templateTax')}
                  selected={activeTemplate === 'tax'}
                  onPress={() => setActiveTemplate('tax')}
                />
              </View>
            </View>

            {/* Featured Reports */}
            <View
              testID="redesign-reports-featured"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
              }}
            >
              {FEATURED.map((entry) => (
                <RedesignListRow
                  key={entry.key}
                  testID={`redesign-reports-row-${entry.key}`}
                  title={t(entry.titleKey)}
                  subtitle={t(entry.bodyKey)}
                  onPress={() => openFeatured(entry)}
                />
              ))}
            </View>

            {/* Your Reports / Saved Reports */}
            <RedesignText testID="redesign-reports-your-label" variant="label" tone="textSecondary">
              {t('reports.redesign.yourReports')}
            </RedesignText>

            <View
              testID="redesign-reports-saved"
              style={{
                backgroundColor: theme.surface,
                borderRadius: shape['radius-lg'],
                borderWidth: 1,
                borderColor: theme.border,
                overflow: 'hidden',
                minHeight: saved.length ? undefined : 68,
                justifyContent: saved.length ? undefined : 'center',
              }}
            >
              {saved.length === 0 ? (
                <RedesignText tone="textSecondary" style={{ paddingHorizontal: sp.md, paddingVertical: sp.md }}>
                  {t('reports.redesign.noSaved')}
                </RedesignText>
              ) : (
                saved.map((report) => (
                  <RedesignListRow
                    key={report.id}
                    testID={`redesign-reports-saved-${report.id}`}
                    title={report.name}
                    subtitle={t('reports.customSaved')}
                    onPress={() => openSaved(report)}
                  />
                ))
              )}
            </View>

            <RedesignButton
              testID="redesign-reports-build"
              kind="secondary"
              label={t('reports.redesign.buildYourOwn')}
              onPress={() => router.push('/reports/build')}
              fullWidth
            />

            <RedesignButton
              testID="redesign-reports-export-pdf"
              kind="link"
              label={t('reports.redesign.exportExecutivePdf')}
              onPress={onExportExecutivePdf}
              fullWidth
            />
          </>
        )}
      </ScrollView>

      {adding ? (
        <RedesignSheet visible title={t('reports.addReport')} onClose={closeAdd} testID="redesign-reports-gallery">
          {GALLERY.map((g) => (
            <View key={g.group} style={{ gap: sp.sm }}>
              <RedesignText variant="label" tone="textSecondary">
                {t(`reports.gallery.${g.group}` as TextKey)}
              </RedesignText>
              {g.kinds.map((k) => (
                <RedesignListRow
                  key={k}
                  testID={`redesign-gallery-${k}`}
                  title={kindName(k)}
                  subtitle={t(`reports.about.${k}` as TextKey)}
                  onPress={() => addKind(k, null)}
                />
              ))}
              {g.group === 'custom'
                ? saved.map((s) => (
                    <RedesignListRow
                      key={s.id}
                      testID={`redesign-gallery-saved-${s.id}`}
                      title={s.name}
                      subtitle={t('reports.customSaved')}
                      onPress={() => addKind('custom', s.id)}
                    />
                  ))
                : null}
            </View>
          ))}
          <RedesignButton
            testID="redesign-gallery-build"
            kind="secondary"
            label={t('reports.redesign.buildYourOwn')}
            onPress={() => {
              closeAdd();
              router.push(overview ? `/reports/build?dashboard=${overview.id}` : '/reports/build');
            }}
            fullWidth
          />
        </RedesignSheet>
      ) : null}
    </RedesignStackFrame>
  );
}

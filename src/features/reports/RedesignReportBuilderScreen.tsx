import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { v7 as uuidv7 } from 'uuid';

import type { BuilderSpecModel } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignButton,
  RedesignChip,
  RedesignDialog,
  RedesignField,
  RedesignIcon,
  RedesignListRow,
  RedesignSheet,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { EMPTY_SPEC, monthBounds, runBuilderPreview, shiftMonth } from './builderRunner';
import { newCard } from './helpers';
import { useDashboards } from './useDashboards';

const sp = tokens.space;
const shape = tokens.shape;

const SHOWS: BuilderSpecModel['show'][] = ['spending', 'income', 'net', 'balance', 'count'];
const DIMS: BuilderSpecModel['groupBy'][] = ['category', 'group', 'payee', 'account', 'tag', 'month'];

type PeriodKey = '3m' | '6m' | '1y' | 'custom';

const PERIODS: { key: PeriodKey; labelKey: TextKey }[] = [
  { key: '3m', labelKey: 'reports.redesign.period3Months' },
  { key: '6m', labelKey: 'reports.redesign.period6Months' },
  { key: '1y', labelKey: 'reports.redesign.period1Year' },
  { key: 'custom', labelKey: 'reports.redesign.periodCustom' },
];

function periodRange(period: PeriodKey, onDate: string, custom: { from: string; to: string }): { from: string; to: string } {
  const month = onDate.slice(0, 7);
  switch (period) {
    case '3m':
      return { from: monthBounds(shiftMonth(month, -2)).from, to: monthBounds(month).to };
    case '6m':
      return { from: monthBounds(shiftMonth(month, -5)).from, to: monthBounds(month).to };
    case '1y':
      return { from: monthBounds(shiftMonth(month, -11)).from, to: monthBounds(month).to };
    case 'custom':
      return custom;
  }
}

function shortBarLabel(key: string): string {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const m = Number(key.slice(5, 7));
    return t(`date.month.${m}` as TextKey);
  }
  return key.slice(0, 3);
}

/**
 * Figma Mobile App Phone / Report builder (5:2436).
 * Behind EXPO_PUBLIC_REDESIGN; W0 tokens/components only.
 */
export function RedesignReportBuilderScreen() {
  const params = useGlobalSearchParams<{ from?: string; to?: string; dashboard?: string; card?: string }>();
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const { dashboards, ready, save, cardById } = useDashboards();
  const editing = params.card ? cardById(params.card) : null;
  const savedReport = editing?.card.savedReportId
    ? snapshot?.savedReports.find((r) => r.id === editing.card.savedReportId)
    : null;
  const initial: BuilderSpecModel = savedReport?.spec ?? editing?.card.spec ?? {
    ...EMPTY_SPEC,
    groupBy: 'month',
    chart: 'bar',
  };

  const onDate = today();
  const [name, setName] = useState(savedReport?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [edited, setEdited] = useState<BuilderSpecModel | null>(null);
  const [dirty, setDirty] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [customRange, setCustomRange] = useState({
    from: params.from ?? `${onDate.slice(0, 7)}-01`,
    to: params.to ?? onDate,
  });
  const [pick, setPick] = useState<'show' | 'group' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const s = edited ?? initial;
  const range = periodRange(period, onDate, customRange);

  const set = (patch: Partial<BuilderSpecModel>) => {
    setDirty(true);
    setEdited({ ...s, ...patch });
  };

  const preview = useMemo(() => {
    if (!snapshot) return null;
    return runBuilderPreview(snapshot, s, range);
  }, [snapshot, s, range]);

  const groups = useMemo(() => {
    if (!snapshot) return [] as { key: string; label: string; categoryIds: string[] }[];
    const map = new Map<string, string[]>();
    for (const c of snapshot.categories) {
      if (c.kind === 'income') continue;
      const list = map.get(c.group) ?? [];
      list.push(c.id);
      map.set(c.group, list);
    }
    return [...map.entries()].map(([key, categoryIds]) => ({
      key,
      label: t(key as TextKey),
      categoryIds,
    }));
  }, [snapshot]);

  const selectedCategoryIds = new Set(s.filters.categoryIds ?? []);

  const toggleGroup = (categoryIds: string[]) => {
    setDirty(true);
    const allOn = categoryIds.every((id) => selectedCategoryIds.has(id));
    const next = new Set(selectedCategoryIds);
    if (allOn) categoryIds.forEach((id) => next.delete(id));
    else categoryIds.forEach((id) => next.add(id));
    set({ filters: { ...s.filters, categoryIds: next.size ? [...next] : undefined } });
  };

  const leave = () => router.push('/reports');
  const back = () => (dirty ? setLeaving(true) : leave());

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('reports.redesign.nameRequired'));
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const report = await repo.saveReport({ id: savedReport?.id, name: trimmed, spec: s });
      if (editing && !savedReport) {
        const cards = editing.dashboard.cards.map((c) =>
          c.id === editing.card.id ? { ...c, savedReportId: report.id, spec: null, title: trimmed } : c,
        );
        await save(editing.dashboard.id, { cards });
      } else if (!editing) {
        const dashboardId = params.dashboard ?? dashboards[0]?.id;
        const target = dashboards.find((d) => d.id === dashboardId) ?? dashboards[0];
        if (target) {
          await save(target.id, {
            cards: [...target.cards, newCard(uuidv7(), 'custom', target.cards.length, { savedReportId: report.id, title: trimmed })],
          });
        }
      }
      leave();
    } finally {
      setSaving(false);
    }
  };

  if (!snapshot || !preview || !ready) {
    return (
      <RedesignStackFrame testID="redesign-builder" title={t('reports.redesign.buildTitle')} onBack={() => router.push('/reports')}>
        <RedesignSkeleton height={420} testID="redesign-builder-skeleton" />
      </RedesignStackFrame>
    );
  }

  const bars = preview.table.rows.slice(-6);
  const maxBar = bars.reduce((m, r) => (r.total > m ? r.total : m), 1n);

  return (
    <RedesignStackFrame testID="redesign-builder" title={t('reports.redesign.buildTitle')} onBack={back}>
      <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}>
        <RedesignField
          testID="redesign-builder-name"
          label={t('reports.redesign.reportName')}
          value={name}
          onChangeText={(v) => {
            setDirty(true);
            setName(v);
            if (nameError) setNameError(null);
          }}
          error={nameError}
          placeholder={t('reports.redesign.reportNamePlaceholder')}
        />

        <RedesignField
          testID="redesign-builder-show"
          label={t('reports.show')}
          value={t(`reports.show.${s.show}` as TextKey)}
          editable={false}
          onPress={() => setPick('show')}
          trailing={<RedesignIcon name="chevron-down" size={24} color={theme.textSecondary} />}
        />

        <RedesignField
          testID="redesign-builder-group"
          label={t('reports.groupBy')}
          value={t(`reports.dim.${s.groupBy}` as TextKey)}
          editable={false}
          onPress={() => setPick('group')}
          trailing={<RedesignIcon name="chevron-down" size={24} color={theme.textSecondary} />}
        />

        <RedesignText variant="label" tone="textSecondary">
          {t('reports.redesign.period')}
        </RedesignText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
          {PERIODS.map((p) => (
            <RedesignChip
              key={p.key}
              testID={`redesign-builder-period-${p.key}`}
              label={t(p.labelKey)}
              selected={period === p.key}
              onPress={() => {
                setDirty(true);
                setPeriod(p.key);
              }}
            />
          ))}
        </ScrollView>

        {period === 'custom' ? (
          <View style={{ gap: sp.md }}>
            <RedesignField
              testID="redesign-builder-from"
              label={t('reports.redesign.from')}
              value={customRange.from}
              onChangeText={(from) => {
                setDirty(true);
                setCustomRange((r) => ({ ...r, from }));
              }}
            />
            <RedesignField
              testID="redesign-builder-to"
              label={t('reports.redesign.to')}
              value={customRange.to}
              onChangeText={(to) => {
                setDirty(true);
                setCustomRange((r) => ({ ...r, to }));
              }}
            />
          </View>
        ) : null}

        {groups.length ? (
          <>
            <RedesignText variant="label" tone="textSecondary">
              {t('reports.redesign.onlyCategories')}
            </RedesignText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
              {groups.map((g) => {
                const selected = g.categoryIds.length > 0 && g.categoryIds.every((id) => selectedCategoryIds.has(id));
                return (
                  <RedesignChip
                    key={g.key}
                    testID={`redesign-builder-cat-${g.key}`}
                    label={g.label}
                    selected={selected}
                    onPress={() => toggleGroup(g.categoryIds)}
                  />
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <View
          testID="redesign-builder-preview"
          style={{
            backgroundColor: theme.surface,
            borderRadius: shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            padding: sp.lg,
            gap: sp.md,
          }}
        >
          <RedesignText variant="label" tone="textSecondary">
            {t('reports.preview')}
          </RedesignText>
          <View
            testID="redesign-builder-bars"
            style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 100, gap: sp.xs }}
          >
            {bars.length === 0 ? (
              <RedesignText tone="textSecondary">{t('reports.redesign.previewEmpty')}</RedesignText>
            ) : (
              bars.map((row) => {
                const h = Math.max(8, Math.round((Number(row.total) / Number(maxBar)) * 76));
                return (
                  <View key={row.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: 24,
                        height: h,
                        borderRadius: 4,
                        backgroundColor: theme.primary,
                      }}
                    />
                    <RedesignText variant="helper" tone="textSecondary">
                      {shortBarLabel(row.key)}
                    </RedesignText>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          paddingTop: sp.md,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.page,
        }}
      >
        <RedesignButton
          testID="redesign-builder-save"
          label={t('reports.saveReport')}
          onPress={() => void onSave()}
          disabled={saving}
          fullWidth
        />
      </View>

      {pick ? (
        <RedesignSheet
          visible
          title={pick === 'show' ? t('reports.show') : t('reports.groupBy')}
          onClose={() => setPick(null)}
          testID={`redesign-builder-pick-${pick}`}
        >
          {(pick === 'show' ? SHOWS : DIMS).map((key) => (
            <RedesignListRow
              key={key}
              testID={`redesign-builder-option-${key}`}
              title={t((pick === 'show' ? `reports.show.${key}` : `reports.dim.${key}`) as TextKey)}
              onPress={() => {
                if (pick === 'show') set({ show: key as BuilderSpecModel['show'] });
                else set({ groupBy: key as BuilderSpecModel['groupBy'] });
                setPick(null);
              }}
            />
          ))}
        </RedesignSheet>
      ) : null}

      <RedesignDialog
        visible={leaving}
        title={t('reports.discardTitle')}
        body={t('reports.discardBody')}
        confirmLabel={t('reports.discard')}
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          leave();
        }}
        testID="redesign-builder-discard"
      />
    </RedesignStackFrame>
  );
}

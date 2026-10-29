import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Confirm, EmptyState, Placeholder, Switch, Tabs, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { ReportCardKind, ReportDashboard } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthIncome, monthSpent, netWorth, periodTotals } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { AddReportSheet, DashboardNameSheet } from './reportSheets';
import { RangeBar, type DateRange } from '../cashflow/RangeBar';

const sp = tokens.spacing;

/** TB-10 Reports dashboards */
export function ReportsScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const params = useGlobalSearchParams<{ dashboard?: string; from?: string; to?: string }>();
  const [dashboards, setDashboards] = useState<ReportDashboard[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(params.dashboard ?? null);
  const [editLayout, setEditLayout] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState<'new' | 'rename' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [range, setRange] = useState<DateRange>({
    from: params.from ?? `${today().slice(0, 7)}-01`,
    to: params.to ?? today(),
  });

  useEffect(() => {
    void repo.ensureReportDashboards().then((list) => {
      setDashboards(list);
      setActiveId((id) => id ?? list[0]?.id ?? null);
    });
  }, [repo, snapshot?.settings.reportDashboards]);

  const active = dashboards?.find((d) => d.id === activeId) ?? dashboards?.[0] ?? null;

  const persist = async (next: ReportDashboard[]) => {
    setDashboards(next);
    await repo.saveReportDashboards(next);
  };

  const figures = useMemo(() => {
    if (!snapshot) return null;
    const month = range.to.slice(0, 7);
    const totals = periodTotals(snapshot.events);
    return {
      income: monthIncome(snapshot.chart, totals, month),
      spent: monthSpent(snapshot.chart, totals, month),
      netWorth: netWorth(snapshot.chart, snapshot.events, range.to).total,
    };
  }, [snapshot, range]);

  const cardBody = (kind: ReportCardKind) => {
    if (!figures) return '—';
    if (kind === 'incomeVsSpending') return `${formatNaira(figures.income)} / ${formatNaira(figures.spent)}`;
    if (kind === 'netWorth') return formatNaira(figures.netWorth);
    if (kind === 'spendingByCategory') return formatNaira(figures.spent);
    if (kind === 'cashFlow') return formatNaira(figures.income - figures.spent);
    return t('reports.cardReady');
  };

  return (
    <AppFrame title={t('reports.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        {!dashboards ? (
          <Placeholder height={120} />
        ) : (
          <>
            <Tabs
              testID="reports-dashboards"
              value={active?.id ?? ''}
              onChange={(id) => {
                if (id === '__new') return setNameOpen('new');
                setActiveId(id);
                router.setParams({ dashboard: id });
              }}
              options={[
                ...dashboards.map((d) => ({ value: d.id, label: d.name })),
                { value: '__new', label: t('reports.new') },
              ]}
            />
            <RangeBar
              range={range}
              onChange={(r) => {
                setRange(r);
                router.setParams({ from: r.from, to: r.to });
              }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
              <Button testID="reports-add-card" label={t('reports.addReport')} onPress={() => setAddOpen(true)} />
              <Button kind="secondary" label={editLayout ? t('reports.doneLayout') : t('reports.editLayout')} onPress={() => setEditLayout((v) => !v)} />
              <Button kind="secondary" label={t('reports.rename')} onPress={() => setNameOpen('rename')} />
              <Button kind="secondary" label={t('reports.delete')} onPress={() => setDeleteOpen(true)} />
            </View>
            {!active || active.cards.filter((c) => !c.hidden).length === 0 ? (
              <EmptyState title={t('reports.emptyTitle')} body={t('reports.emptyBody')} actionLabel={t('reports.addReport')} onAction={() => setAddOpen(true)} />
            ) : (
              active.cards
                .filter((c) => editLayout || !c.hidden)
                .map((card) => (
                  <Pressable
                    key={card.id}
                    testID={`report-card-${card.id}`}
                    accessibilityRole={editLayout ? undefined : 'link'}
                    disabled={editLayout}
                    onPress={editLayout ? undefined : () => router.push(`/reports/view/${card.id}?from=${range.from}&to=${range.to}`)}
                  >
                    <Card style={{ gap: sp['spacing-sm'], opacity: card.hidden ? 0.5 : 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text variant="heading-sm">{card.title}</Text>
                        {editLayout ? (
                          <Switch
                            label={t('reports.showCard')}
                            value={!card.hidden}
                            onChange={(show) => {
                              if (!active || !dashboards) return;
                              void persist(
                                dashboards.map((d) =>
                                  d.id !== active.id
                                    ? d
                                    : { ...d, cards: d.cards.map((c) => (c.id === card.id ? { ...c, hidden: !show } : c)) },
                                ),
                              );
                            }}
                          />
                        ) : null}
                      </View>
                      <Text>{cardBody(card.kind)}</Text>
                      {!editLayout ? <Text testID={`report-open-${card.id}`} tone="link">{t('reports.openReport')}</Text> : null}
                    </Card>
                  </Pressable>
                ))
            )}
          </>
        )}
      </ScrollView>

      {addOpen && active ? (
        <AddReportSheet
          dashboard={active}
          onClose={() => setAddOpen(false)}
          onAdd={(kind, title) => {
            if (!dashboards || !active) return;
            const next = dashboards.map((d) =>
              d.id !== active.id ? d : { ...d, cards: [...d.cards, { id: `card-${Date.now()}`, kind, title }] },
            );
            void persist(next).then(() => toast.show(t('reports.reportAdded')));
          }}
        />
      ) : null}
      {nameOpen ? (
        <DashboardNameSheet
          existing={(dashboards ?? []).map((d) => d.name)}
          initial={nameOpen === 'rename' ? active?.name : undefined}
          onClose={() => setNameOpen(null)}
          onSave={(name) => {
            if (!dashboards) return;
            if (nameOpen === 'new') {
              const created: ReportDashboard = { id: `dash-${Date.now()}`, name, order: dashboards.length, cards: [] };
              void persist([...dashboards, created]).then(() => {
                setActiveId(created.id);
                toast.show(t('reports.dashboardCreated'));
              });
            } else if (active) {
              void persist(dashboards.map((d) => (d.id === active.id ? { ...d, name } : d)));
            }
          }}
        />
      ) : null}
      {deleteOpen && active ? (
        <Confirm
          visible
          title={t('reports.deleteTitle', { name: active.name })}
          body={t('reports.deleteBody')}
          confirmLabel={t('reports.delete')}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            if (!dashboards || !active) return;
            const saved = snapshot?.settings.savedReports ?? [];
            // Keep saved reports available in Add report (TB10-2).
            void repo.saveSavedReport;
            void persist(dashboards.filter((d) => d.id !== active.id)).then(() => {
              setDeleteOpen(false);
              setActiveId(dashboards.find((d) => d.id !== active.id)?.id ?? null);
              toast.show(t('reports.dashboardDeleted', { count: String(saved.length) }));
            });
          }}
        />
      ) : null}
    </AppFrame>
  );
}

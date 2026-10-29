import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Amount, BarChart, Button, Card, DonutChart, LineChart, Placeholder, StatusPill, Text, formatDay, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { monthLabel, nextMonth, prevMonth } from '@/features/budget/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import { CustomizeDashboardSheet } from './CustomizeDashboardSheet';
import { checklist, dashboardModel, type ComingUpRow } from './helpers';
import { resolveLayoutForDevice, visibleDashboardCards, withStoredLayoutForDevice, type DashboardLayout, type DashboardCardId } from './layout';

const sp = tokens.spacing;

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? t('dashboard.goodMorning') : h < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');
  return t('dashboard.greeting', { part, name });
}

export function DashboardScreen() {
  const { snapshot, repo } = useWorkspace();
  const { user } = useAuth();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const size = useSizeClass();
  const params = useGlobalSearchParams<{ customize?: string }>();
  const customizeOpen = params.customize === '1';
  const [month, setMonth] = useState(() => monthOf(today()));
  const [checklistHidden, setChecklistHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const model = useMemo(() => (snapshot ? dashboardModel(snapshot, month) : null), [snapshot, month]);
  const items = useMemo(() => (snapshot ? checklist(snapshot, checklistHidden || !!snapshot.settings.checklistHidden) : []), [snapshot, checklistHidden]);
  const layout = useMemo(() => resolveLayoutForDevice(snapshot?.settings, size), [snapshot?.settings, size]);
  const cards = useMemo(() => visibleDashboardCards(layout), [layout]);

  const hideChecklist = () => {
    setChecklistHidden(true);
    if (snapshot) void repo.updateSettings({ ...snapshot.settings, checklistHidden: true });
  };

  const openCustomize = () => router.setParams({ customize: '1' });
  const closeCustomize = () => router.setParams({ customize: undefined });

  const saveLayout = async (next: DashboardLayout) => {
    if (!snapshot) return;
    await repo.updateSettings(withStoredLayoutForDevice(snapshot.settings, size, next));
    toast.show(t('dashboard.layoutSaved'));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await repo.load();
    } finally {
      setRefreshing(false);
    }
  }, [repo]);

  const renderCard = (id: DashboardCardId) => {
    if (!model) return null;
    switch (id) {
      case 'checklist':
        if (items.length === 0) return null;
        return (
          <Card key={id} testID="dashboard-checklist" style={{ gap: sp['spacing-sm'] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading-sm">{t('dashboard.checklistTitle')}</Text>
              <Text variant="caption" tone="textSecondary">
                {t('dashboard.checklistProgress', { done: items.filter((i) => i.done).length, total: items.length })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button testID="dashboard-checklist-hide" kind="link" label={t('dashboard.checklistHide')} onPress={hideChecklist} />
            </View>
            {items.map((item) => (
              <View key={item.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text>{t(item.labelKey)}</Text>
                {item.done ? (
                  <Text tone="textSecondary">{t('dashboard.checkDone')}</Text>
                ) : (
                  <Button testID={`dashboard-check-${item.key}`} kind="secondary" size="sm" label={t('dashboard.checkDoIt')} onPress={() => router.push(item.href)} />
                )}
              </View>
            ))}
          </Card>
        );
      case 'netWorth':
        return (
          <Pressable key={id} testID="dashboard-net-worth" accessibilityRole="link" onPress={() => router.push('/accounts')}>
            <Card style={{ gap: sp['spacing-sm'] }}>
              <Text variant="caption" tone="textSecondary">
                {t('accounts.netWorth')}
              </Text>
              <Amount testID="dashboard-net-worth-amount" minor={model.worthNow} variant="display-md" />
              {model.worthChange !== 0n ? (
                <Text variant="caption" tone="textSecondary">
                  {model.worthChange >= 0n
                    ? t('dashboard.netWorthUp', { amount: formatNaira(model.worthChange) })
                    : t('dashboard.netWorthDown', { amount: formatNaira(-model.worthChange) })}
                </Text>
              ) : null}
              <LineChart testID="dashboard-net-worth-chart" title={t('dashboard.netWorthTrend')} columns={[t('category.chartMonth'), t('accounts.netWorth')]} rows={model.netWorthLine} />
              {model.assets + model.liabilityTotal > 0n ? (
                <View style={{ gap: sp['spacing-xs'] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text variant="caption" tone="textSecondary">
                      {t('dashboard.assets', { amount: formatNaira(model.assets) })}
                    </Text>
                    <Text variant="caption" tone="textSecondary">
                      {t('dashboard.debtsLabel', { amount: formatNaira(model.liabilityTotal) })}
                    </Text>
                  </View>
                  <View style={{ height: 6, flexDirection: 'row', borderRadius: 3, overflow: 'hidden', backgroundColor: theme.border }}>
                    <View
                      style={{
                        height: 6,
                        width: `${model.assets + model.liabilityTotal > 0n ? Number((model.assets * 100n) / (model.assets + model.liabilityTotal)) : 50}%`,
                        backgroundColor: theme.primaryFill,
                      }}
                    />
                    <View style={{ flex: 1, height: 6, backgroundColor: theme.error }} />
                  </View>
                </View>
              ) : null}
            </Card>
          </Pressable>
        );
      case 'leftToSpend':
        return (
          <Pressable key={id} testID="dashboard-left-to-spend" accessibilityRole="link" onPress={() => router.push('/budget')}>
            <Card style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{t('dashboard.leftToSpend')}</Text>
              <Amount minor={model.leftToSpend} variant="heading-lg" />
              {model.plannedTotal > 0n ? (
                <>
                  <Text variant="caption" tone="textSecondary">
                    {t('dashboard.ofPlanned', { amount: formatNaira(model.plannedTotal) })}
                  </Text>
                  <View
                    testID="dashboard-left-bar"
                    accessibilityRole="progressbar"
                    style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginTop: sp['spacing-xs'] }}
                  >
                    <View
                      style={{
                        height: 6,
                        width: `${Math.min(100, Math.max(0, Number((model.leftToSpend * 100n) / model.plannedTotal)))}%`,
                        backgroundColor: theme.primaryFill,
                      }}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          </Pressable>
        );
      case 'statTiles':
        return (
          <ScrollView key={id} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp['spacing-md'] }}>
            <StatTile testID="dashboard-tile-income" label={t('dashboard.tile.income')} amount={model.income} change={model.incomeChange} onPress={() => router.push('/transactions')} />
            <StatTile testID="dashboard-tile-spent" label={t('dashboard.tile.spent')} amount={model.spent} change={model.spentChange} onPress={() => router.push('/transactions')} />
            <StatTile
              testID="dashboard-tile-net-cash"
              label={t('dashboard.tile.netCash')}
              amount={model.netCash}
              change={null}
              onPress={() => router.push('/transactions')}
            />
            <StatTile
              testID="dashboard-tile-budget-left"
              label={t('dashboard.tile.budgetLeft')}
              amount={model.budgetLeft}
              change={null}
              footnote={model.daysLeft != null ? t('dashboard.daysLeft', { days: model.daysLeft }) : undefined}
              onPress={() => router.push('/budget')}
            />
          </ScrollView>
        );
      case 'comingUp':
        return <ComingUpCard key={id} rows={model.comingUp} onPlan={() => router.push('/plan')} />;
      case 'goals':
        return (
          <Pressable key={id} testID="dashboard-goals" accessibilityRole="link" onPress={() => router.push('/goals')}>
            <Card style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('dashboard.goalsCard')}</Text>
              {model.goals.length === 0 ? (
                <Text tone="textSecondary">{t('dashboard.goalsEmpty')}</Text>
              ) : (
                model.goals.map((g) => (
                  <View key={g.goal.id} style={{ gap: sp['spacing-xs'] }}>
                    <Text>{g.goal.name}</Text>
                    <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 6, width: `${Math.round(g.progress * 100)}%`, backgroundColor: theme.primaryFill }} />
                    </View>
                    <Text variant="caption" tone="textSecondary">
                      {t('dashboard.goalOf', { amount: formatNaira(g.target) })}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </Pressable>
        );
      case 'debts':
        return (
          <Pressable key={id} testID="dashboard-debts" accessibilityRole="link" onPress={() => router.push('/debts')}>
            <Card style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('dashboard.debtsCard')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
                <View>
                  <Text variant="caption" tone="textSecondary">
                    {t('debts.theyOwe')}
                  </Text>
                  <Amount minor={model.debts.owedToMe} variant="caption" />
                </View>
                <View>
                  <Text variant="caption" tone="textSecondary">
                    {t('debts.iOwe')}
                  </Text>
                  <Amount minor={model.debts.iOwe} variant="caption" />
                </View>
              </View>
            </Card>
          </Pressable>
        );
      case 'incomeVsSpending':
        return (
          <BarChart
            key={id}
            testID="dashboard-income-vs-spending"
            title={t('dashboard.incomeVsSpending')}
            columns={[t('category.chartMonth'), t('dashboard.amount')]}
            rows={model.incomeVsSpent}
          />
        );
      case 'spendingTrend':
        return (
          <BarChart
            key={id}
            testID="dashboard-spending-trend"
            title={t('dashboard.spendingVsLastMonth')}
            columns={[t('category.chartMonth'), t('dashboard.tile.spent')]}
            rows={model.spendingTrend}
          />
        );
      case 'budgetProgress':
        return (
          <Card key={id} testID="dashboard-budget-progress" style={{ gap: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{t('dashboard.budgetProgress')}</Text>
            {model.progress.map(({ category, row, state }) => (
              <Pressable key={category.id} testID={`dashboard-progress-${category.id}`} onPress={() => router.push(`/budget/category/${category.id}`)}>
                <View style={{ gap: 2 }}>
                  <Text>{category.name}</Text>
                  {state === 'over' ? (
                    <Text variant="caption" tone="textSecondary">
                      {t('budget.overBy', { amount: formatNaira(-row.available) })}
                    </Text>
                  ) : state === 'near' ? (
                    <Text variant="caption" tone="textSecondary">
                      {t('budget.nearLimit')}
                    </Text>
                  ) : (
                    <Text variant="caption" tone="textSecondary">
                      {t('dashboard.remaining', { amount: formatNaira(row.available) })}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
            <Button kind="link" label={t('dashboard.seeBudget')} onPress={() => router.push('/budget')} />
          </Card>
        );
      case 'whereItWent':
        return model.where.length > 0 ? (
          <DonutChart key={id} testID="dashboard-where" title={t('dashboard.whereItWent')} columns={[t('category.group'), t('dashboard.tile.spent')]} rows={model.where} total={model.spent} />
        ) : null;
      case 'recent':
        return (
          <Card key={id} testID="dashboard-recent" style={{ gap: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{t('dashboard.recent')}</Text>
            {model.recent.length === 0 ? (
              <Text tone="textSecondary">{t('tx.emptyTitle')}</Text>
            ) : (
              model.recent.map((row) => (
                <Pressable key={row.event.id} onPress={() => router.push({ pathname: '/transactions', params: { tx: row.event.id } })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text>{row.title}</Text>
                    <Amount minor={row.amount} signed variant="caption" />
                  </View>
                </Pressable>
              ))
            )}
            <Button kind="link" label={t('dashboard.seeTransactions')} onPress={() => router.push('/transactions')} />
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <AppFrame title={t('dashboard.title')}>
      <ScrollView
        contentContainerStyle={{ gap: sp['spacing-lg'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <Text testID="dashboard-greeting" variant="display-md">
          {greeting(user?.name ?? '')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <Pressable
              testID="dashboard-prev-month"
              accessibilityRole="button"
              accessibilityLabel={t('date.previousMonth')}
              onPress={() => setMonth(prevMonth(month))}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={20} color={theme.textSecondary} />
            </Pressable>
            <Text testID="dashboard-month" variant="heading-sm">
              {monthLabel(month)}
            </Text>
            <Pressable
              testID="dashboard-next-month"
              accessibilityRole="button"
              accessibilityLabel={t('date.nextMonth')}
              onPress={() => setMonth(nextMonth(month))}
              style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <Button testID="dashboard-customize" kind="link" label={t('dashboard.customize')} onPress={openCustomize} />
        </View>

        {!model ? (
          <Placeholder height={200} />
        ) : (
          cards.map((id) => renderCard(id))
        )}
      </ScrollView>
      <CustomizeDashboardSheet visible={customizeOpen} layout={layout} onClose={closeCustomize} onSave={saveLayout} />
    </AppFrame>
  );
}

function ComingUpCard({ rows, onPlan }: { rows: ComingUpRow[]; onPlan: () => void }) {
  return (
    <Card testID="dashboard-coming-up" style={{ gap: sp['spacing-sm'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading-sm">{t('dashboard.comingUp')}</Text>
        <Button kind="link" label={t('dashboard.seePlan')} onPress={onPlan} />
      </View>
      {rows.length === 0 ? (
        <Text tone="textSecondary">{t('dashboard.comingUpEmpty')}</Text>
      ) : (
        rows.slice(0, 8).map((row) => (
          <View key={`${row.recurring.id}:${row.dueDate}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text>{row.recurring.name}</Text>
              <Text variant="caption" tone="textSecondary">
                {formatDay(row.dueDate)}
              </Text>
            </View>
            {row.overdue ? <StatusPill kind="problem" label={t('dashboard.overdue')} /> : null}
            <Amount minor={row.amountMinor} signed={row.recurring.kind === 'income'} variant="caption" />
          </View>
        ))
      )}
    </Card>
  );
}

function StatTile({
  testID,
  label,
  amount,
  change,
  footnote,
  onPress,
}: {
  testID: string;
  label: string;
  amount: bigint;
  change: number | null;
  footnote?: string;
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={{ minWidth: 140 }}>
      <Card style={{ gap: sp['spacing-xs'] }}>
        <Text variant="caption" tone="textSecondary">
          {label}
        </Text>
        <Amount minor={amount} variant="heading-sm" signed={label !== t('dashboard.tile.spent')} />
        {change !== null ? (
          <Text variant="micro" tone="textSecondary">
            {change >= 0 ? t('dashboard.changeUp', { pct: Math.abs(change).toFixed(0) }) : t('dashboard.changeDown', { pct: Math.abs(change).toFixed(0) })}
          </Text>
        ) : null}
        {footnote ? (
          <Text variant="micro" tone="textSecondary">
            {footnote}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

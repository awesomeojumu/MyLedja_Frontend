import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Amount, BarChart, Button, Card, DonutChart, LineChart, Placeholder, StatusPill, Text, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { monthLabel, nextMonth, prevMonth } from '@/features/budget/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import { checklist, dashboardModel } from './helpers';

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
  const router = useRouter();
  const [month, setMonth] = useState(() => monthOf(today()));
  const [checklistHidden, setChecklistHidden] = useState(false);

  const model = useMemo(() => (snapshot ? dashboardModel(snapshot, month) : null), [snapshot, month]);
  const items = useMemo(() => (snapshot ? checklist(snapshot, checklistHidden || !!snapshot.settings.checklistHidden) : []), [snapshot, checklistHidden]);

  const hideChecklist = () => {
    setChecklistHidden(true);
    if (snapshot) void repo.updateSettings({ ...snapshot.settings, checklistHidden: true });
  };

  return (
    <AppFrame title={t('dashboard.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <Text testID="dashboard-greeting" variant="display-md">
          {greeting(user?.name ?? '')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable testID="dashboard-prev-month" accessibilityLabel={t('date.previousMonth')} onPress={() => setMonth(prevMonth(month))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={20} color={theme.textSecondary} />
          </Pressable>
          <Text testID="dashboard-month" variant="heading-sm">
            {monthLabel(month)}
          </Text>
          <Pressable testID="dashboard-next-month" accessibilityLabel={t('date.nextMonth')} onPress={() => setMonth(nextMonth(month))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {!model ? (
          <Placeholder height={200} />
        ) : (
          <>
            {items.length > 0 ? (
              <Card testID="dashboard-checklist" style={{ gap: sp['spacing-sm'] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="heading-sm">{t('dashboard.checklistTitle')}</Text>
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
            ) : null}

            <Pressable testID="dashboard-net-worth" accessibilityRole="link" onPress={() => router.push('/accounts')}>
              <Card style={{ gap: sp['spacing-sm'] }}>
                <Text variant="caption" tone="textSecondary">
                  {t('accounts.netWorth')}
                </Text>
                <Amount testID="dashboard-net-worth-amount" minor={model.worthNow} variant="display-md" />
                <LineChart testID="dashboard-net-worth-chart" title={t('dashboard.netWorthTrend')} columns={[t('category.chartMonth'), t('accounts.netWorth')]} rows={model.netWorthLine} />
              </Card>
            </Pressable>

            <Pressable testID="dashboard-left-to-spend" accessibilityRole="link" onPress={() => router.push('/budget')}>
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

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp['spacing-md'] }}>
              <StatTile testID="dashboard-tile-income" label={t('dashboard.tile.income')} amount={model.income} change={model.incomeChange} onPress={() => router.push('/transactions')} />
              <StatTile testID="dashboard-tile-spent" label={t('dashboard.tile.spent')} amount={model.spent} change={model.spentChange} onPress={() => router.push('/transactions')} />
              <StatTile testID="dashboard-tile-net-cash" label={t('dashboard.tile.netCash')} amount={model.netCash} change={null} onPress={() => router.push('/transactions')} />
              <StatTile testID="dashboard-tile-budget-left" label={t('dashboard.tile.budgetLeft')} amount={model.budgetLeft} change={null} onPress={() => router.push('/budget')} />
            </ScrollView>

            <Card testID="dashboard-coming-up" style={{ gap: sp['spacing-sm'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="heading-sm">{t('dashboard.comingUp')}</Text>
                <Button kind="link" label={t('dashboard.seePlan')} onPress={() => router.push('/plan')} />
              </View>
              {model.comingUp.length === 0 ? (
                <Text tone="textSecondary">{t('dashboard.comingUpEmpty')}</Text>
              ) : (
                model.comingUp.slice(0, 6).map((row) => (
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

            <Pressable testID="dashboard-goals" accessibilityRole="link" onPress={() => router.push('/goals')}>
              <Card style={{ gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm">{t('dashboard.goalsCard')}</Text>
                {model.goals.length === 0 ? (
                  <Text tone="textSecondary">{t('dashboard.goalsEmpty')}</Text>
                ) : (
                  model.goals.map((g) => (
                    <View key={g.goal.id} style={{ gap: 2 }}>
                      <Text>{g.goal.name}</Text>
                      <Amount minor={g.saved} variant="caption" />
                      <Text variant="caption" tone="textSecondary">
                        {t('dashboard.goalOf', { amount: formatNaira(g.target) })}
                      </Text>
                    </View>
                  ))
                )}
              </Card>
            </Pressable>

            <Pressable testID="dashboard-debts" accessibilityRole="link" onPress={() => router.push('/debts')}>
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

            <BarChart testID="dashboard-income-vs-spending" title={t('dashboard.incomeVsSpending')} columns={[t('category.chartMonth'), t('dashboard.amount')]} rows={model.incomeVsSpent} />
            <BarChart testID="dashboard-spending-trend" title={t('dashboard.spendingVsLastMonth')} columns={[t('category.chartMonth'), t('dashboard.tile.spent')]} rows={model.spendingTrend} />

            <Card testID="dashboard-budget-progress" style={{ gap: sp['spacing-sm'] }}>
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

            {model.where.length > 0 ? (
              <DonutChart testID="dashboard-where" title={t('dashboard.whereItWent')} columns={[t('category.group'), t('dashboard.tile.spent')]} rows={model.where} total={model.spent} />
            ) : null}

            <Card testID="dashboard-recent" style={{ gap: sp['spacing-sm'] }}>
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
          </>
        )}
      </ScrollView>
    </AppFrame>
  );
}

function StatTile({
  testID,
  label,
  amount,
  change,
  onPress,
}: {
  testID: string;
  label: string;
  amount: bigint;
  change: number | null;
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
      </Card>
    </Pressable>
  );
}

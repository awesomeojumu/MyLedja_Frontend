import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react-native';

import {
  Amount,
  BarChart,
  Button,
  Card,
  GradientBand,
  LineChart,
  Placeholder,
  ProgressRing,
  StatusPill,
  Text,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { monthLabel, nextMonth, prevMonth } from '@/features/budget/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { useSecurityApi } from '@/features/settings/SecuritySheets';
import { adviceText, reasonText } from '@/features/health/HealthScreen';
import { healthPage } from '@/features/health/helpers';
import { today } from '@/features/transactions/helpers';
import { filtersToParams } from '@/features/transactions/filters';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import { CustomizeDashboardSheet } from './CustomizeDashboardSheet';
import { checklist, dashboardModel, endOfMonth, type ComingUpRow } from './helpers';
import { cardColumnSpan, resolveLayoutForDevice, visibleDashboardCards, withStoredLayoutForDevice, type DashboardLayout, type DashboardCardId } from './layout';
import { RedesignDashboardScreen } from './RedesignDashboardScreen';
import { SpendingTrendChart } from './SpendingTrendChart';
import { WhereItWentChart } from './WhereItWentChart';
import { isRedesignEnabled } from '@/design/redesign';

const sp = tokens.spacing;
const c = tokens.color;

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? t('dashboard.goodMorning') : h < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening');
  return t('dashboard.greeting', { part, name });
}

function barFill(state: string): string {
  if (state === 'over') return c.ruby;
  if (state === 'near') return c.primary;
  return c['primary-soft'];
}

/** Web hover lift (DESIGN.md page 5 D23). */
function LiftPressable({
  testID,
  onPress,
  accessibilityRole,
  style,
  children,
}: {
  testID?: string;
  onPress: () => void;
  accessibilityRole?: 'link' | 'button';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const web = Platform.OS === 'web';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      onPress={onPress}
      onHoverIn={web ? () => setHovered(true) : undefined}
      onHoverOut={web ? () => setHovered(false) : undefined}
      style={[
        style,
        web
          ? ({
              transform: [{ translateY: hovered ? -2 : 0 }],
              transition: 'transform 120ms ease',
            } as ViewStyle)
          : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** One-shot count-up for the net-worth hero (DESIGN.md page 5 / P05-02). */
function useCountUp(target: bigint, active: boolean): bigint {
  const [value, setValue] = useState(0n);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - p) * (1 - p);
      setValue(BigInt(Math.round(Number(target) * eased)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return active ? value : target;
}

export function DashboardScreen() {
  if (isRedesignEnabled()) return <RedesignDashboardScreen />;
  return <LegacyDashboardScreen />;
}

function LegacyDashboardScreen() {
  const { snapshot, repo } = useWorkspace();
  const { user } = useAuth();
  const security = useSecurityApi();
  const theme = useTheme();
  const { reduceMotion } = useDesign();
  const toast = useToast();
  const router = useRouter();
  const size = useSizeClass();
  const phone = size === 'phone';
  const params = useGlobalSearchParams<{ customize?: string }>();
  const customizeOpen = params.customize === '1';
  const [month, setMonth] = useState(() => monthOf(today()));
  const [checklistHidden, setChecklistHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [twoFactorOn, setTwoFactorOn] = useState(false);
  const [counted, setCounted] = useState(false);
  const [titleShrunk, setTitleShrunk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void security
      .status()
      .then((s) => {
        if (!cancelled) setTwoFactorOn(!!s.twoFactorOn);
      })
      .catch(() => {
        /* offline — leave false */
      });
    return () => {
      cancelled = true;
    };
  }, [security]);

  // DESIGN D22: on Android, Back on the Dashboard leaves the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, []);

  const model = useMemo(() => (snapshot ? dashboardModel(snapshot, month) : null), [snapshot, month]);
  const items = useMemo(
    () => (snapshot ? checklist(snapshot, checklistHidden || !!snapshot.settings.checklistHidden, twoFactorOn) : []),
    [snapshot, checklistHidden, twoFactorOn],
  );
  const layout = useMemo(() => resolveLayoutForDevice(snapshot?.settings, size), [snapshot?.settings, size]);
  const cards = useMemo(() => visibleDashboardCards(layout), [layout]);
  const animateWorth = !!model && !reduceMotion && !counted;
  const worthAnimated = useCountUp(model?.worthNow ?? 0n, animateWorth);
  useEffect(() => {
    if (!animateWorth) return;
    const id = setTimeout(() => setCounted(true), 700);
    return () => clearTimeout(id);
  }, [animateWorth]);

  const monthFrom = `${month}-01`;
  const monthTo = endOfMonth(month);
  const todayStr = today();
  const todayDay = monthOf(todayStr) === month ? Number(todayStr.slice(8, 10)) : null;

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
      try {
        const s = await security.status();
        setTwoFactorOn(!!s.twoFactorOn);
      } catch {
        /* ignore */
      }
    } finally {
      setRefreshing(false);
    }
  }, [repo, security]);

  const txHref = (extra: { type?: 'income' | 'expense' }) => {
    const params = filtersToParams({ dateFrom: monthFrom, dateTo: monthTo, ...(extra.type ? { type: extra.type } : {}) });
    return { pathname: '/transactions' as const, params };
  };

  const renderCard = (id: DashboardCardId) => {
    if (!model) return null;
    const span = cardColumnSpan(id, size);
    const wrap = (node: ReactNode) => (
      <View key={id} style={{ width: phone ? '100%' : `${(span / 12) * 100}%`, paddingHorizontal: phone ? 0 : sp['spacing-xs'] }}>
        {node}
      </View>
    );

    switch (id) {
      case 'checklist': {
        if (items.length === 0) return null;
        const done = items.filter((i) => i.done).length;
        return wrap(
          <Card testID="dashboard-checklist" style={{ gap: sp['spacing-sm'] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm" style={{ flex: 1 }}>
                {t('dashboard.checklistTitle')}
              </Text>
              <Text variant="caption" tone="textSecondary">
                {t('dashboard.checklistProgress', { done, total: items.length })}
              </Text>
              <Button testID="dashboard-checklist-hide" kind="link" label={t('dashboard.checklistHide')} onPress={hideChecklist} />
            </View>
            <View
              testID="dashboard-checklist-bar"
              accessibilityRole="progressbar"
              accessibilityLabel={t('dashboard.checklistProgress', { done, total: items.length })}
              accessibilityValue={{ min: 0, max: items.length, now: done }}
              style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' }}
            >
              <View style={{ height: 6, width: `${(done / items.length) * 100}%`, backgroundColor: theme.primaryFill }} />
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
          </Card>,
        );
      }
      case 'netWorth':
        return wrap(
          <LiftPressable testID="dashboard-net-worth" accessibilityRole="link" onPress={() => router.push({ pathname: '/reports', params: { kind: 'netWorth' } })}>
            <Card style={{ gap: sp['spacing-sm'], overflow: 'hidden', position: 'relative' }}>
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 72, opacity: 0.9 }} pointerEvents="none">
                <GradientBand />
              </View>
              <Text variant="caption" style={{ color: c['on-primary'] }}>
                {t('accounts.netWorth')}
              </Text>
              <Amount testID="dashboard-net-worth-amount" minor={reduceMotion || counted ? model.worthNow : worthAnimated} variant="display-lg" />
              {model.worthChange !== 0n ? (
                <Text variant="caption" tone="textSecondary">
                  {model.worthChange >= 0n
                    ? t('dashboard.netWorthUp', { amount: formatNaira(model.worthChange) })
                    : t('dashboard.netWorthDown', { amount: formatNaira(-model.worthChange) })}
                </Text>
              ) : null}
              {model.worthPartial.length > 0 ? (
                <Text variant="caption" tone="textSecondary" testID="dashboard-net-worth-partial">
                  {t('dashboard.partial', { currencies: model.worthPartial.join(', ') })}
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
          </LiftPressable>,
        );
      case 'leftToSpend':
        return wrap(
          <LiftPressable testID="dashboard-left-to-spend" accessibilityRole="link" onPress={() => router.push('/budget')}>
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
                    accessibilityLabel={t('dashboard.ofPlanned', { amount: formatNaira(model.plannedTotal) })}
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
          </LiftPressable>,
        );
      case 'statTiles':
        return wrap(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp['spacing-md'] }}>
            <StatTile
              testID="dashboard-tile-income"
              label={t('dashboard.tile.income')}
              basis={t('dashboard.basis.income')}
              amount={model.income}
              change={model.incomeChange}
              onPress={() => router.push(txHref({ type: 'income' }))}
            />
            <StatTile
              testID="dashboard-tile-spent"
              label={t('dashboard.tile.spent')}
              basis={t('dashboard.basis.spent')}
              amount={model.spent}
              change={model.spentChange}
              onPress={() => router.push(txHref({ type: 'expense' }))}
            />
            <StatTile
              testID="dashboard-tile-net-cash"
              label={t('dashboard.tile.netCash')}
              basis={t('dashboard.basis.netCash')}
              amount={model.netCash}
              change={null}
              onPress={() => router.push(txHref({}))}
            />
            <StatTile
              testID="dashboard-tile-budget-left"
              label={t('dashboard.tile.budgetLeft')}
              basis={t('dashboard.basis.budgetLeft')}
              amount={model.budgetLeft}
              change={null}
              footnote={model.daysLeft != null ? t('dashboard.daysLeft', { days: model.daysLeft }) : undefined}
              onPress={() => router.push('/budget')}
            />
          </ScrollView>,
        );
      case 'comingUp':
        return wrap(
          <ComingUpCard
            rows={model.comingUp}
            onPlan={() => router.push('/plan')}
            onRow={(row) => {
              // PU-26: bills and income streams open Mark paid / Mark received on Plan.
              router.push({ pathname: '/plan', params: { occurrence: `${row.recurring.id}:${row.dueDate}` } });
            }}
          />,
        );
      case 'goals':
        return wrap(
          <LiftPressable testID="dashboard-goals" accessibilityRole="link" onPress={() => router.push('/goals')}>
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
          </LiftPressable>,
        );
      case 'debts':
        return wrap(
          <LiftPressable testID="dashboard-debts" accessibilityRole="link" onPress={() => router.push('/debts')}>
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
          </LiftPressable>,
        );
      case 'health':
        return wrap(<HealthCard month={month} onOpen={() => router.push('/health')} />);
      case 'investments':
        if (!model.hasInvestments) return null;
        return wrap(
          <LiftPressable testID="dashboard-investments" accessibilityRole="link" onPress={() => router.push('/investments')}>
            <Card style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{t('dashboard.investmentsCard')}</Text>
              <Amount testID="dashboard-investments-value" minor={model.investmentsValue} variant="heading-md" />
              <Text variant="caption" tone="textSecondary" testID="dashboard-investments-gain">
                {t('dashboard.investmentsGain', { amount: formatNaira(model.investmentsGain, { signed: true }) })}
              </Text>
            </Card>
          </LiftPressable>,
        );
      case 'incomeVsSpending':
        return wrap(
          <LiftPressable
            testID="dashboard-income-vs-spending"
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/reports', params: { kind: 'incomeVsSpending' } })}
          >
            <BarChart
              title={t('dashboard.incomeVsSpending')}
              columns={[t('category.chartMonth'), t('dashboard.amount')]}
              rows={model.incomeVsSpent}
            />
          </LiftPressable>,
        );
      case 'spendingTrend':
        return wrap(
          <SpendingTrendChart
            thisMonth={model.spendingTrendRows}
            lastMonth={model.spendingTrendCompare}
            todayDay={todayDay}
            onPress={() => router.push({ pathname: '/reports', params: { kind: 'spendingByCategory' } })}
          />,
        );
      case 'budgetProgress':
        return wrap(
          <Card testID="dashboard-budget-progress" style={{ gap: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{t('dashboard.budgetProgress')}</Text>
            {model.progress.map(({ category, row, state, plan }) => {
              const used = plan > 0n ? Math.min(100, Number((row.activity * 100n) / plan)) : row.activity > 0n ? 100 : 0;
              return (
                <Pressable key={category.id} testID={`dashboard-progress-${category.id}`} onPress={() => router.push(`/budget/category/${category.id}`)}>
                  <View style={{ gap: sp['spacing-xs'] }}>
                    <Text>{category.name}</Text>
                    <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: `${used}%`, backgroundColor: barFill(state) }} />
                    </View>
                    {state === 'over' ? (
                      <Text variant="caption" style={{ color: theme.error }}>
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
              );
            })}
            <Button kind="link" label={t('dashboard.seeBudget')} onPress={() => router.push('/budget')} />
          </Card>,
        );
      case 'whereItWent':
        return model.where.length > 0
          ? wrap(
              <LiftPressable testID="dashboard-where" accessibilityRole="link" onPress={() => router.push('/cash-flow')}>
                <WhereItWentChart rows={model.where} total={model.spent} />
              </LiftPressable>,
            )
          : null;
      case 'recent':
        return wrap(
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
          </Card>,
        );
      default:
        return null;
    }
  };

  const trioIds = useMemo(() => new Set<DashboardCardId>(['health', 'goals', 'debts']), []);

  const gridCards = !model
    ? null
    : (() => {
        const nodes: ReactNode[] = [];
        let i = 0;
        let trioDone = false;
        while (i < cards.length) {
          const id = cards[i]!;
          // DESIGN D21: health / goals / debts as a swipeable (phone) or paired (tablet) row.
          if (trioIds.has(id) && !trioDone) {
            const group = cards.filter((cid) => trioIds.has(cid));
            if (phone) {
              nodes.push(
                <ScrollView
                  key="health-goals-debts"
                  testID="dashboard-trio-swipe"
                  horizontal
                  pagingEnabled={false}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: sp['spacing-md'], paddingHorizontal: sp['spacing-xs'] }}
                  style={{ width: '100%' }}
                >
                  {group.map((gid) => (
                    <View key={gid} style={{ width: 260 }}>
                      {renderCard(gid)}
                    </View>
                  ))}
                </ScrollView>,
              );
            } else {
              nodes.push(
                <View key="health-goals-debts" style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
                  {group.map((gid) => renderCard(gid))}
                </View>,
              );
            }
            trioDone = true;
            while (i < cards.length && trioIds.has(cards[i]!)) i += 1;
            continue;
          }
          if (trioIds.has(id) && trioDone) {
            i += 1;
            continue;
          }
          nodes.push(renderCard(id));
          i += 1;
        }
        return nodes;
      })();

  return (
    <AppFrame title={titleShrunk ? greeting(user?.name ?? '') : t('dashboard.title')}>
      <ScrollView
        contentContainerStyle={{ gap: sp['spacing-lg'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        scrollEventThrottle={16}
        onScroll={(e) => {
          // DESIGN D22: iOS-style large title shrinks into the top bar on scroll.
          const y = e.nativeEvent.contentOffset.y;
          setTitleShrunk(y > 48);
        }}
      >
        <Text testID="dashboard-greeting" variant={titleShrunk ? 'heading-sm' : 'display-md'}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: phone ? 0 : -sp['spacing-xs'] }}>{gridCards}</View>
        )}
      </ScrollView>
      <CustomizeDashboardSheet visible={customizeOpen} layout={layout} onClose={closeCustomize} onSave={saveLayout} />
    </AppFrame>
  );
}

function ComingUpCard({ rows, onPlan, onRow }: { rows: ComingUpRow[]; onPlan: () => void; onRow: (row: ComingUpRow) => void }) {
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
          <Pressable
            key={`${row.recurring.id}:${row.dueDate}`}
            testID={`dashboard-coming-up-row-${row.recurring.id}:${row.dueDate}`}
            accessibilityRole="button"
            onPress={() => onRow(row)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text>{row.recurring.name}</Text>
              <Text variant="caption" tone="textSecondary">
                {formatDay(row.dueDate)}
              </Text>
            </View>
            {row.overdue ? <StatusPill kind="problem" label={t('dashboard.overdue')} /> : null}
            <Amount minor={row.amountMinor} signed={row.recurring.kind === 'income'} variant="caption" />
          </Pressable>
        ))
      )}
    </Card>
  );
}

function StatTile({
  testID,
  label,
  basis,
  amount,
  change,
  footnote,
  onPress,
}: {
  testID: string;
  label: string;
  basis: string;
  amount: bigint;
  change: number | null;
  footnote?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ minWidth: 140 }} accessibilityHint={basis}>
      <Card style={{ gap: sp['spacing-xs'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" tone="textSecondary">
            {label}
          </Text>
          <Info size={14} color={theme.textSecondary} accessibilityLabel={basis} />
        </View>
        <Amount minor={amount} variant="heading-sm" signed={label !== t('dashboard.tile.spent')} />
        <Text variant="micro" tone="textSecondary">
          {basis}
        </Text>
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

/** F5.5: score ring and one line of advice → Health. */
function HealthCard({ month, onOpen }: { month: string; onOpen: () => void }) {
  const { snapshot } = useWorkspace();
  const onDate = today();
  const page = useMemo(
    () => (snapshot ? healthPage(snapshot, month < onDate.slice(0, 7) ? month : onDate.slice(0, 7), onDate, { history: false }) : null),
    [snapshot, month, onDate],
  );
  if (!page) return null;
  return (
    <LiftPressable testID="dashboard-health" accessibilityRole="link" onPress={onOpen}>
      <Card style={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{t('dashboard.healthCard')}</Text>
        {page.ready && page.score !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
            <ProgressRing value={page.score / 100} label={t('health.scoreLabel', { score: String(page.score) })} />
            <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
              <Text variant="heading-md" testID="dashboard-health-score">
                {String(page.score)}
              </Text>
              <Text tone="textSecondary">{reasonText(page) || (page.advice[0] ? adviceText(page.advice[0], formatNaira) : '')}</Text>
            </View>
          </View>
        ) : (
          <Text tone="textSecondary" testID="dashboard-health-not-ready">
            {t('health.notReadyTitle')}
          </Text>
        )}
      </Card>
    </LiftPressable>
  );
}

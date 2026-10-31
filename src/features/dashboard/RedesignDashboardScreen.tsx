import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import {
  RedesignAmount,
  RedesignButton,
  RedesignIcon,
  RedesignProgress,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { monthLabel } from '@/features/budget/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { useAuth } from '@/features/auth/AuthProvider';
import { adviceText, reasonText } from '@/features/health/HealthScreen';
import { healthPage } from '@/features/health/helpers';
import { today } from '@/features/transactions/helpers';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import { dashboardModel, type ComingUpRow } from './helpers';
import {
  comingUpDueTotal,
  comingUpWeek,
  monthlyAverages,
  perDayLeft,
  redesignCheckAction,
  redesignCheckHint,
  redesignChecklist,
  REDESIGN_SAVINGS_GOAL_PCT,
  unsortedCount,
} from './redesignHelpers';
import {
  redesignCardSpan,
  layoutDeviceKind,
  resolveRedesignLayoutForDevice,
  visibleRedesignCards,
  withStoredRedesignLayoutForDevice,
  type RedesignCardId,
  type RedesignDashboardLayout,
} from './redesignLayout';
import { RedesignEditHomeSheet } from './RedesignEditHomeSheet';

const sp = tokens.space;
const shape = tokens.shape;

function fullMonthName(month: string): string {
  const m = Number(month.slice(5, 7));
  return t(`dashboard.redesign.monthFull.${m}` as TextKey);
}

function longDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay();
  return t('dashboard.redesign.dueLong', {
    weekday: t(`dashboard.redesign.weekday.${weekday}` as TextKey),
    d,
    month: fullMonthName(`${y}-${String(mo).padStart(2, '0')}`),
  });
}

function todayLong(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay();
  return t('dashboard.redesign.todayLong', {
    weekday: t(`dashboard.redesign.weekday.${weekday}` as TextKey),
    d,
    month: fullMonthName(`${y}-${String(mo).padStart(2, '0')}`),
  });
}

const HIDDEN_AMOUNT = '₦ ••••••';

function money(minor: bigint, privacy: boolean, signed = false): string {
  if (privacy) return HIDDEN_AMOUNT;
  return formatNaira(minor, { signed });
}

function CardShell({
  testID,
  children,
  onPress,
  style,
}: {
  testID?: string;
  children: ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const body = (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="link" onPress={onPress}>
      {body}
    </Pressable>
  );
}

function CardHeader({ title, onPress, trailing }: { title: string; onPress?: () => void; trailing?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.sm }}
    >
      <RedesignText variant="label">{title}</RedesignText>
      {trailing ?? (onPress ? <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} /> : null)}
    </Pressable>
  );
}

/**
 * Figma Dashboard Home — Phone 16:865 / Tablet 11:922 / Web 1:141.
 * Only mounted when EXPO_PUBLIC_REDESIGN is on.
 */
export function RedesignDashboardScreen() {
  const { snapshot, repo } = useWorkspace();
  const { user } = useAuth();
  const { privacy } = useDesign();
  const router = useRouter();
  const size = useSizeClass();
  const phone = size === 'phone';
  const add = useOptionalAddTransaction();
  const params = useGlobalSearchParams<{ customize?: string }>();
  const editOpen = params.customize === '1';
  const month = monthOf(today());
  const [checklistHidden, setChecklistHidden] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'All'>('6M');

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
    () => (snapshot ? redesignChecklist(snapshot, checklistHidden || !!snapshot.settings.checklistHidden) : []),
    [snapshot, checklistHidden],
  );
  const deviceKind = layoutDeviceKind(size);
  const layout = useMemo(() => resolveRedesignLayoutForDevice(snapshot?.settings, size), [snapshot?.settings, size]);
  const cards = useMemo(() => visibleRedesignCards(layout, deviceKind), [layout, deviceKind]);
  const averages = useMemo(() => (snapshot ? monthlyAverages(snapshot, month) : null), [snapshot, month]);
  const weekRows = useMemo(() => (snapshot ? comingUpWeek(snapshot, today()) : []), [snapshot]);
  const toSort = useMemo(() => (snapshot ? unsortedCount(snapshot) : 0), [snapshot]);
  const todayStr = today();

  const openEdit = () => router.setParams({ customize: '1' });
  const closeEdit = () => router.setParams({ customize: undefined });

  const saveLayout = async (next: RedesignDashboardLayout) => {
    if (!snapshot) return;
    await repo.updateSettings(withStoredRedesignLayoutForDevice(snapshot.settings, size, next));
  };

  const hideChecklist = () => {
    setChecklistHidden(true);
    if (snapshot) void repo.updateSettings({ ...snapshot.settings, checklistHidden: true });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await repo.load();
    } finally {
      setRefreshing(false);
    }
  }, [repo]);

  const rangeMonths = range === '1M' ? 1 : range === '3M' ? 3 : range === '6M' ? 6 : range === '1Y' ? 12 : 12;
  const netWorthLine = useMemo(() => {
    if (!model) return [];
    return model.netWorthLine.slice(-rangeMonths);
  }, [model, rangeMonths]);

  const wrap = (id: RedesignCardId, node: ReactNode) => {
    const span = redesignCardSpan(id, size);
    return (
      <View key={id} style={{ width: phone ? '100%' : `${(span / 12) * 100}%`, paddingHorizontal: phone ? 0 : sp.xs }}>
        {node}
      </View>
    );
  };

  const renderCard = (id: RedesignCardId) => {
    if (!model || !snapshot || !averages) return null;

    switch (id) {
      case 'leftToSpend': {
        const hasPlan = model.plannedTotal > 0n;
        const dayLeft = perDayLeft(model.leftToSpend, model.daysLeft);
        if (!hasPlan) {
          return wrap(
            id,
            <CardShell testID="redesign-home-left">
              <CardHeader title={t('dashboard.card.leftToSpend')} />
              <RedesignText variant="amount">{t('dashboard.redesign.noBudgetTitle', { month: fullMonthName(month) })}</RedesignText>
              <RedesignText tone="textSecondary">{t('dashboard.redesign.noBudgetBody')}</RedesignText>
              <RedesignButton
                testID="redesign-home-plan-budget"
                kind="link"
                label={t('dashboard.redesign.planBudget')}
                onPress={() => router.push('/budget')}
              />
            </CardShell>,
          );
        }
        return wrap(
          id,
          <CardShell testID="redesign-home-left">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <RedesignText variant="label">{t('dashboard.card.leftToSpend')}</RedesignText>
              <RedesignText variant="label" tone="textSecondary">
                {fullMonthName(month)}
              </RedesignText>
            </View>
            <RedesignAmount testID="redesign-home-left-amount" text={money(model.leftToSpend, privacy)} sizeVariant="display" hidden={privacy} />
            {model.daysLeft != null ? (
              <RedesignText tone="textSecondary">
                {model.daysLeft === 1
                  ? t('dashboard.redesign.daysLeftOne')
                  : t('dashboard.redesign.daysLeft', { n: model.daysLeft })}
              </RedesignText>
            ) : null}
            <RedesignProgress
              testID="redesign-home-left-bar"
              value={Number(model.spent)}
              max={Number(model.plannedTotal > 0n ? model.plannedTotal : 1n)}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <RedesignText variant="helper" tone="textSecondary">
                {t('dashboard.redesign.spentOf', { spent: money(model.spent, privacy) })}
              </RedesignText>
              <RedesignText variant="helper" tone="textSecondary">
                {t('dashboard.redesign.plannedOf', { planned: money(model.plannedTotal, privacy) })}
              </RedesignText>
            </View>
            <View
              style={{
                flexDirection: phone ? 'row' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTopWidth: 1,
                borderColor: theme.border,
                paddingTop: sp.md,
                gap: sp.sm,
                flexWrap: 'wrap',
              }}
            >
              <RedesignText variant="body-medium">
                {dayLeft != null
                  ? phone
                    ? t('dashboard.redesign.aboutPerDay', { amount: money(dayLeft, privacy) })
                    : t('dashboard.redesign.youCanSpend', { amount: money(dayLeft, privacy) })
                  : null}
              </RedesignText>
              <RedesignButton
                testID="redesign-home-open-budget"
                kind="link"
                label={t('dashboard.redesign.openBudget')}
                onPress={() => router.push('/budget')}
              />
            </View>
          </CardShell>,
        );
      }
      case 'netWorth':
        return wrap(
          id,
          <CardShell testID="redesign-home-net-worth" onPress={() => router.push({ pathname: '/reports', params: { kind: 'netWorth' } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <CardHeader title={t('dashboard.card.netWorth')} onPress={() => router.push({ pathname: '/reports', params: { kind: 'netWorth' } })} />
              {!phone ? (
                <View style={{ flexDirection: 'row', gap: sp.xs }}>
                  {(['1M', '3M', '6M', '1Y', 'All'] as const).map((r) => (
                    <Pressable
                      key={r}
                      testID={`redesign-nw-range-${r}`}
                      onPress={() => setRange(r)}
                      style={{
                        paddingHorizontal: sp.sm,
                        paddingVertical: sp.xs,
                        borderRadius: shape['radius-pill'],
                        backgroundColor: range === r ? theme.primary : 'transparent',
                      }}
                    >
                      <RedesignText
                        variant="label"
                        tone={range === r ? 'textOnPrimary' : 'textSecondary'}
                        style={range === r ? { color: theme.textOnPrimary } : undefined}
                      >
                        {t(`dashboard.redesign.range.${r.toLowerCase()}` as TextKey)}
                      </RedesignText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <RedesignAmount testID="redesign-home-nw-amount" text={money(model.worthNow, privacy)} sizeVariant="amount" hidden={privacy} />
            {model.worthChange !== 0n ? (
              <RedesignText tone="textSecondary">
                {model.worthChange >= 0n
                  ? t('dashboard.redesign.worthUp', { amount: money(model.worthChange, privacy) })
                  : t('dashboard.redesign.worthDown', { amount: money(model.worthChange, privacy, true) })}
              </RedesignText>
            ) : (
              <RedesignText tone="textSecondary">{t('dashboard.redesign.worthTrendHint')}</RedesignText>
            )}
            {netWorthLine.length > 1 ? (
              <View testID="redesign-home-nw-chart" style={{ height: 72, justifyContent: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 56 }}>
                  {netWorthLine.map((p, i) => {
                    const max = netWorthLine.reduce((m, x) => (x.value > m ? x.value : m), 1n);
                    const h = Math.max(4, Math.round((Number(p.value) / Number(max)) * 56));
                    return (
                      <View
                        key={`${p.label}-${i}`}
                        style={{
                          flex: 1,
                          height: h,
                          backgroundColor: i === netWorthLine.length - 1 ? theme.primary : theme.primarySoft,
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}
            {!phone ? (
              <RedesignButton kind="link" label={t('chart.viewAsTable')} onPress={() => router.push({ pathname: '/reports', params: { kind: 'netWorth' } })} />
            ) : null}
          </CardShell>,
        );
      case 'averages': {
        // Tablet `11:922`: Income / Spending + Monthly average.
        // Web `1:141`: Average monthly income / spending + Last 6 months.
        // Phone list (when shown): Income / Spending + Last 6 months.
        const web = size === 'desktop' || size === 'wide';
        const incomeLabel = web ? t('dashboard.redesign.avgIncomeLong') : t('dashboard.redesign.avgIncome');
        const spendingLabel = web ? t('dashboard.redesign.avgSpendingLong') : t('dashboard.redesign.avgSpending');
        const avgHint = size === 'tablet' ? t('dashboard.redesign.monthlyAverage') : t('dashboard.redesign.last6');
        const rows = [
          {
            key: 'income',
            label: incomeLabel,
            hint: avgHint,
            value: money(averages.avgIncome, privacy),
          },
          {
            key: 'spending',
            label: spendingLabel,
            hint: avgHint,
            value: money(averages.avgSpending, privacy),
          },
          {
            key: 'savings',
            label: t('dashboard.redesign.savingsRate'),
            hint: t('dashboard.redesign.savingsGoal', { pct: REDESIGN_SAVINGS_GOAL_PCT }),
            value: `${averages.savingsRate}%`,
          },
        ];
        if (phone) {
          return wrap(
            id,
            <CardShell testID="redesign-home-averages" onPress={() => router.push('/reports')}>
              <CardHeader title={t('dashboard.redesign.card.averages')} onPress={() => router.push('/reports')} />
              {rows.map((r) => (
                <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sp.md }}>
                  <View style={{ flex: 1 }}>
                    <RedesignText variant="body-medium">{r.label}</RedesignText>
                    <RedesignText variant="caption" tone="textSecondary">
                      {r.hint}
                    </RedesignText>
                  </View>
                  <RedesignAmount text={r.value} sizeVariant="body" hidden={privacy && r.key !== 'savings'} />
                </View>
              ))}
            </CardShell>,
          );
        }
        return wrap(
          id,
          <View testID="redesign-home-averages" style={{ flexDirection: 'row', gap: sp.md, width: '100%' }}>
            {rows.map((r) => (
              <CardShell key={r.key} style={{ flex: 1 }}>
                <RedesignText variant="label">{r.label}</RedesignText>
                <RedesignAmount text={r.value} sizeVariant="amount" hidden={privacy && r.key !== 'savings'} />
                <RedesignText tone="textSecondary">{r.hint}</RedesignText>
              </CardShell>
            ))}
          </View>,
        );
      }
      case 'comingUp': {
        const due = comingUpDueTotal(weekRows);
        return wrap(
          id,
          <CardShell testID="redesign-home-coming-up" onPress={() => router.push('/plan')}>
            <CardHeader title={t('dashboard.comingUp')} onPress={() => router.push('/plan')} />
            {weekRows.length === 0 ? (
              <>
                <RedesignText variant="body-medium">{t('dashboard.redesign.comingEmptyTitle')}</RedesignText>
                <RedesignText tone="textSecondary">{t('dashboard.redesign.comingEmptyBody')}</RedesignText>
                <RedesignButton
                  testID="redesign-home-add-bill"
                  kind="link"
                  label={t('dashboard.redesign.addBill')}
                  onPress={() => router.push('/plan')}
                />
              </>
            ) : (
              <>
                <RedesignAmount text={money(due, privacy)} sizeVariant="amount" hidden={privacy} />
                <RedesignText tone="textSecondary">{t('dashboard.redesign.comingDue')}</RedesignText>
                {weekRows.slice(0, 3).map((row) => (
                  <ComingRow key={`${row.recurring.id}:${row.dueDate}`} row={row} privacy={privacy} onPress={() => router.push({ pathname: '/plan', params: { occurrence: `${row.recurring.id}:${row.dueDate}` } })} />
                ))}
              </>
            )}
          </CardShell>,
        );
      }
      case 'budget': {
        const over = model.progress.filter((p) => p.state === 'over').length;
        return wrap(
          id,
          <CardShell testID="redesign-home-budget" onPress={() => router.push('/budget')}>
            <CardHeader title={t('dashboard.redesign.card.budget')} onPress={() => router.push('/budget')} />
            <RedesignText variant="amount">
              {over === 1 ? t('dashboard.redesign.overPlanOne') : over > 1 ? t('dashboard.redesign.overPlanMany', { n: over }) : monthLabel(month)}
            </RedesignText>
            {model.progress.slice(0, 3).map((p) => {
              const plan = p.plan;
              const spent = p.row.activity;
              return (
                <View key={p.category.id} style={{ gap: sp.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <RedesignText variant="body-medium">{p.category.name}</RedesignText>
                      {p.state === 'over' ? (
                        <RedesignText variant="caption" tone="textSecondary">
                          {t('dashboard.redesign.overPlan')}
                        </RedesignText>
                      ) : null}
                    </View>
                    <RedesignText variant="caption" tone="textSecondary">
                      {t('dashboard.redesign.ofPlan', {
                        spent: money(spent, privacy),
                        planned: money(plan, privacy),
                      })}
                    </RedesignText>
                  </View>
                  <RedesignProgress value={Number(spent)} max={Number(plan > 0n ? plan : 1n)} overPlan={p.state === 'over'} />
                </View>
              );
            })}
          </CardShell>,
        );
      }
      case 'recent':
        return wrap(
          id,
          <CardShell testID="redesign-home-recent" onPress={() => router.push('/transactions')}>
            <CardHeader title={t('dashboard.redesign.card.recent')} onPress={() => router.push('/transactions')} />
            {toSort > 0 ? (
              <>
                <RedesignText variant="amount">{t('dashboard.redesign.toSort', { n: toSort })}</RedesignText>
                <RedesignText tone="textSecondary">{t('dashboard.redesign.toSortHint')}</RedesignText>
              </>
            ) : null}
            {model.recent.slice(0, 3).map((r) => (
              <Pressable
                key={r.event.id}
                testID={`redesign-home-tx-${r.event.id}`}
                onPress={() => router.push({ pathname: '/transactions', params: { tx: r.event.id } })}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md }}
              >
                <View style={{ flex: 1 }}>
                  <RedesignText variant="body-medium">{r.title}</RedesignText>
                  <RedesignText variant="caption" tone="textSecondary">
                    {[r.category, r.event.date === todayStr ? t('date.today').toLowerCase() : longDate(r.event.date)].filter(Boolean).join(', ')}
                  </RedesignText>
                </View>
                <RedesignAmount
                  text={privacy ? HIDDEN_AMOUNT : formatNaira(r.amount < 0n ? -r.amount : r.amount)}
                  sizeVariant="body"
                  sign={privacy ? null : r.amount > 0n ? '+' : r.amount < 0n ? '−' : null}
                />
              </Pressable>
            ))}
          </CardShell>,
        );
      case 'goals': {
        const goal = model.goals[0];
        if (!goal) {
          return wrap(
            id,
            <CardShell testID="redesign-home-goals" onPress={() => router.push('/goals')}>
              <CardHeader title={t('dashboard.card.goals')} onPress={() => router.push('/goals')} />
              <RedesignText tone="textSecondary">{t('dashboard.goalsEmpty')}</RedesignText>
            </CardShell>,
          );
        }
        const pct = Math.round(goal.progress * 100);
        return wrap(
          id,
          <CardShell testID="redesign-home-goals" onPress={() => router.push('/goals')}>
            <CardHeader title={t('dashboard.card.goals')} onPress={() => router.push('/goals')} />
            <View style={{ flexDirection: 'row', gap: sp.lg, alignItems: 'center' }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 6,
                  borderColor: theme.progressTrack,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 6,
                    borderColor: theme.primary,
                    borderTopColor: 'transparent',
                    borderRightColor: pct > 25 ? theme.primary : 'transparent',
                    borderBottomColor: pct > 50 ? theme.primary : 'transparent',
                    borderLeftColor: pct > 75 ? theme.primary : 'transparent',
                    transform: [{ rotate: '-45deg' }],
                  }}
                />
                <View style={{ alignItems: 'center' }} testID="redesign-home-goals-ring">
                  <RedesignText variant="label">
                    {phone ? t('dashboard.redesign.savedScore', { pct }) : t('dashboard.redesign.savedPct', { pct })}
                  </RedesignText>
                  <RedesignText variant="caption" tone="textSecondary" style={{ fontSize: 10, lineHeight: 12 }}>
                    {phone ? t('dashboard.redesign.outOf100') : t('dashboard.redesign.savedLabel')}
                  </RedesignText>
                </View>
              </View>
              <View style={{ flex: 1, gap: sp.xs }}>
                <RedesignText variant="body-medium">{goal.goal.name}</RedesignText>
                <RedesignText variant="caption" tone="textSecondary">
                  {t('dashboard.redesign.ofPlan', {
                    spent: money(goal.saved, privacy),
                    planned: money(goal.target, privacy),
                  })}
                </RedesignText>
                {goal.goal.targetDate ? (
                  <RedesignText variant="caption" tone="textSecondary">
                    {t('dashboard.redesign.onTrack', {
                      month: fullMonthName(goal.goal.targetDate.slice(0, 7)),
                    })}
                  </RedesignText>
                ) : null}
              </View>
            </View>
          </CardShell>,
        );
      }
      case 'investments':
        if (!model.hasInvestments) return null;
        return wrap(
          id,
          <CardShell testID="redesign-home-investments" onPress={() => router.push('/investments')}>
            <CardHeader title={t('dashboard.card.investments')} onPress={() => router.push('/investments')} />
            <RedesignAmount text={money(model.investmentsValue, privacy)} sizeVariant="amount" hidden={privacy} />
            <RedesignText tone="textSecondary">
              {t('dashboard.investmentsGain', { amount: money(model.investmentsGain, privacy, true) })}
            </RedesignText>
          </CardShell>,
        );
      case 'debts':
        return wrap(
          id,
          <CardShell testID="redesign-home-debts" onPress={() => router.push('/debts')}>
            <CardHeader title={t('dashboard.card.debts')} onPress={() => router.push('/debts')} />
            <RedesignText tone="textSecondary">
              {t('dashboard.assets', { amount: money(model.debts.owedToMe, privacy) })}
            </RedesignText>
            <RedesignText tone="textSecondary">
              {t('dashboard.debtsLabel', { amount: money(model.debts.iOwe, privacy) })}
            </RedesignText>
          </CardShell>,
        );
      case 'health':
        return wrap(id, <HealthCard month={month} privacy={privacy} onOpen={() => router.push('/health')} />);
      case 'cashFlow':
        return wrap(
          id,
          <CardShell testID="redesign-home-cash-flow" onPress={() => router.push('/cash-flow')}>
            <CardHeader title={t('dashboard.redesign.card.cashFlow')} onPress={() => router.push('/cash-flow')} />
            <RedesignText tone="textSecondary">{t('dashboard.whereItWent')}</RedesignText>
          </CardShell>,
        );
      default:
        return null;
    }
  };

  const firstTodo = items.find((i) => !i.done);

  const checklistCard =
    items.length > 0 ? (
      <View key="checklist" style={{ width: '100%', gap: sp.lg, marginBottom: sp.sm }}>
        <View style={{ gap: sp.md }}>
          <RedesignText variant="headline" testID="redesign-home-welcome">
            {t('dashboard.redesign.welcome', { name: user?.name?.split(' ')[0] || user?.name || '' })}
          </RedesignText>
          <RedesignText tone="textSecondary">{t('dashboard.redesign.welcomeBody')}</RedesignText>
        </View>
        <CardShell testID="redesign-home-checklist">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <RedesignText variant="headline">{t('dashboard.redesign.getStarted')}</RedesignText>
              <RedesignText tone="textSecondary">
                {t('dashboard.redesign.progress', {
                  done: items.filter((i) => i.done).length,
                  total: items.length,
                })}
              </RedesignText>
            </View>
            <Pressable
              testID="redesign-home-checklist-hide"
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.checklistHide')}
              onPress={hideChecklist}
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <RedesignProgress
            value={items.filter((i) => i.done).length}
            max={items.length}
            testID="redesign-home-checklist-bar"
          />
          {items.map((item) => (
            <Pressable
              key={item.key}
              testID={`redesign-home-check-${item.key}`}
              disabled={item.done}
              onPress={() => router.push(item.href as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: sp.md,
                paddingVertical: sp.sm,
                borderTopWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: item.done ? theme.primary : 'transparent',
                  borderWidth: item.done ? 0 : 2,
                  borderColor: theme.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.done ? <RedesignIcon name="check" size={16} color={theme.textOnPrimary} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <RedesignText
                  variant="body-medium"
                  style={item.done ? { textDecorationLine: 'line-through', color: theme.textSecondary } : undefined}
                >
                  {t(item.labelKey)}
                </RedesignText>
                <RedesignText variant="caption" tone="textSecondary">
                  {snapshot ? redesignCheckHint(snapshot, item.key) : ''}
                </RedesignText>
              </View>
              {!item.done ? <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} /> : null}
            </Pressable>
          ))}
          {firstTodo ? (
            <RedesignButton
              testID="redesign-home-checklist-cta"
              label={t(redesignCheckAction(firstTodo.key))}
              onPress={() => router.push(firstTodo.href as never)}
              fullWidth
            />
          ) : null}
        </CardShell>
      </View>
    ) : null;

  return (
    <AppFrame title={t('nav.home')}>
      <ScrollView
        testID="redesign-home"
        contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {!phone ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp.md, flexWrap: 'wrap' }}>
            <View>
              <RedesignText variant="title" testID="redesign-home-title">
                {t('nav.home')}
              </RedesignText>
              <RedesignText tone="textSecondary">{todayLong(todayStr)}</RedesignText>
            </View>
            <View style={{ flexDirection: 'row', gap: sp.sm, alignItems: 'center' }}>
              <RedesignButton testID="redesign-home-edit" kind="secondary" label={t('dashboard.redesign.editHome')} onPress={openEdit} />
              <RedesignButton
                testID="redesign-home-add"
                label={t('tx.add')}
                onPress={() => add?.open('expense')}
              />
            </View>
          </View>
        ) : null}

        {!model ? (
          <RedesignSkeleton testID="redesign-home-skeleton" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: phone ? 0 : -sp.xs, gap: phone ? sp.lg : 0 }}>
            {checklistCard}
            {cards.map((id) => renderCard(id))}
          </View>
        )}

        {phone ? (
          <View style={{ alignItems: 'flex-start', paddingTop: sp.sm }}>
            <RedesignButton testID="redesign-home-edit" kind="secondary" label={t('dashboard.redesign.editHome')} onPress={openEdit} />
          </View>
        ) : null}
      </ScrollView>
      <RedesignEditHomeSheet
        visible={editOpen}
        layout={layout}
        deviceKind={deviceKind}
        onClose={closeEdit}
        onSave={saveLayout}
      />
    </AppFrame>
  );
}

function ComingRow({ row, privacy, onPress }: { row: ComingUpRow; privacy: boolean; onPress: () => void }) {
  const signed = row.recurring.kind === 'income';
  const amt = signed ? row.amountMinor : -row.amountMinor;
  return (
    <Pressable
      testID={`redesign-coming-${row.recurring.id}:${row.dueDate}`}
      onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md }}
    >
      <View style={{ flex: 1 }}>
        <RedesignText variant="body-medium">{row.recurring.name}</RedesignText>
        <RedesignText variant="caption" tone="textSecondary">
          {longDate(row.dueDate)}
        </RedesignText>
      </View>
      <RedesignAmount
        text={money(amt < 0n ? -amt : amt, privacy)}
        sizeVariant="body"
        hidden={privacy}
        sign={amt > 0n ? '+' : '−'}
      />
    </Pressable>
  );
}

function HealthCard({ month, privacy: _privacy, onOpen }: { month: string; privacy: boolean; onOpen: () => void }) {
  const { snapshot } = useWorkspace();
  const onDate = today();
  const page = useMemo(
    () => (snapshot ? healthPage(snapshot, month < onDate.slice(0, 7) ? month : onDate.slice(0, 7), onDate, { history: false }) : null),
    [snapshot, month, onDate],
  );
  if (!page) return null;
  return (
    <CardShell testID="redesign-home-health" onPress={onOpen}>
      <CardHeader title={t('dashboard.healthCard')} onPress={onOpen} />
      {page.ready && page.score !== null ? (
        <>
          <RedesignText variant="amount" testID="redesign-home-health-score">
            {String(page.score)}
          </RedesignText>
          <RedesignText tone="textSecondary">{reasonText(page) || (page.advice[0] ? adviceText(page.advice[0], formatNaira) : '')}</RedesignText>
        </>
      ) : (
        <RedesignText tone="textSecondary">{t('health.notReadyTitle')}</RedesignText>
      )}
    </CardShell>
  );
}

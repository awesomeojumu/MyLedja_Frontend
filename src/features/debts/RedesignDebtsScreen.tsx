import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DebtInterest, PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignProgress,
  RedesignSegmented,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira, parseAmount } from '@/money';
import { today } from '@/features/transactions/helpers';

import {
  calculateCashFlowFreed,
  calculateRealApr,
  comparePayoffStrategies,
  debtInitials,
  debtRows,
  debtTotals,
  findRecentPayment,
  type DebtFilter,
  type DebtRow,
} from './helpers';
import { contactsAvailable, pickContact } from './contacts';
import { listMoneyBackReview } from './moneyBack';
import { MoneyBackReviewSheet } from './MoneyBackReviewSheet';
import { addMonths, debtIsOverdue, debtOriginalAmount, debtProgress } from './schedule';

const sp = tokens.space;
const shape = tokens.shape;

const MONTH_LONG = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

type PayOrder = 'smallest' | 'interest' | 'custom';
type DebtKind = 'loan' | 'card' | 'person' | 'cooperative' | 'loan_app';

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTH_LONG[m] ?? m} ${y}`;
}

function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function annualPercent(interest?: DebtInterest): number | null {
  if (!interest || interest.kind === 'none') return null;
  if (interest.kind === 'percent_month') return Math.round(interest.percent * 12 * 10) / 10;
  return null;
}

function monthlyFromSchedule(debt: PersonDebt): bigint | null {
  if (!debt.scheduleAmountMinor) return null;
  const n = BigInt(debt.scheduleAmountMinor);
  return n > 0n ? n : null;
}

function rowCaption(debt: PersonDebt): string {
  const pct = annualPercent(debt.interest);
  const monthly = monthlyFromSchedule(debt);
  const next = debt.nextDueDate ? dayMonth(debt.nextDueDate) : null;
  if (pct == null && monthly == null && next) return t('debts.redesign.noInterestNext', { when: next });
  if (pct == null && next) return t('debts.redesign.nextOnly', { when: next });
  if (pct != null && monthly != null) {
    const asMin = (debt.notes ?? '').toLowerCase().includes('card') || debt.name.toLowerCase().includes('card');
    return asMin
      ? t('debts.redesign.interestYearMin', { pct: String(pct), amount: formatNaira(monthly) })
      : t('debts.redesign.interestYearMonth', { pct: String(pct), amount: formatNaira(monthly) });
  }
  if (pct != null) return t('debts.redesign.interestYear', { pct: String(pct) });
  if (next) return t('debts.redesign.nextOnly', { when: next });
  return t('debts.redesign.noInterest');
}

function sortRows(rows: DebtRow[], order: PayOrder): DebtRow[] {
  const copy = [...rows];
  if (order === 'smallest') {
    return copy.sort((a, b) => (a.balance === b.balance ? 0 : a.balance < b.balance ? -1 : 1));
  }
  if (order === 'interest') {
    return copy.sort((a, b) => {
      const ap = annualPercent(a.debt.interest) ?? -1;
      const bp = annualPercent(b.debt.interest) ?? -1;
      if (bp !== ap) return bp - ap;
      return a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1;
    });
  }
  return copy;
}

function debtFreeIso(total: bigint, monthlyPace: bigint, fromIso: string): string | null {
  if (total <= 0n || monthlyPace <= 0n) return null;
  const months = Number(total / monthlyPace + (total % monthlyPace > 0n ? 1n : 0n));
  return addMonths(fromIso, Math.max(1, months));
}

export function RedesignDebtsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const todayIso = today();

  const [tab, setTab] = useState<DebtFilter>('all');
  const [order, setOrder] = useState<PayOrder>('smallest');
  const [extraMonthly, setExtraMonthly] = useState<bigint>(0n);
  const [addOpen, setAddOpen] = useState(false);
  const [addDirection, setAddDirection] = useState<PersonDebt['direction']>('iOwe');
  const [moneyBackOpen, setMoneyBackOpen] = useState(false);
  const [quickPayDebt, setQuickPayDebt] = useState<PersonDebt | null>(null);

  const allRows = snapshot ? debtRows(snapshot, 'all', todayIso) : [];
  const totals = debtTotals(allRows);
  const currentRows = snapshot ? debtRows(snapshot, tab, todayIso) : [];
  const iOweRows = allRows.filter((r) => r.debt.direction === 'iOwe' && r.balance > 0n);
  const owedToMeRows = allRows.filter((r) => r.debt.direction === 'owedToMe' && r.balance > 0n);
  const sorted = sortRows(currentRows, order);

  const totalOwed = iOweRows.reduce((s, r) => s + r.balance, 0n);
  const totalOriginalOwed = snapshot
    ? iOweRows.reduce((s, r) => s + debtOriginalAmount(r.debt.id, snapshot), 0n)
    : 0n;
  const totalPaidOwed = totalOriginalOwed > totalOwed ? totalOriginalOwed - totalOwed : 0n;

  const baselineMonthlyPace = iOweRows.reduce((s, r) => s + (monthlyFromSchedule(r.debt) ?? 0n), 0n);
  const totalMonthlyPace = baselineMonthlyPace + extraMonthly;
  const freeBy = debtFreeIso(totalOwed, totalMonthlyPace, todayIso);

  const strategyComp = comparePayoffStrategies(iOweRows, extraMonthly);
  const baselineFreeMonths = baselineMonthlyPace > 0n ? Number(totalOwed / baselineMonthlyPace) : 0;
  const acceleratedFreeMonths = totalMonthlyPace > 0n ? Number(totalOwed / totalMonthlyPace) : 0;
  const speedupMonths = baselineFreeMonths > acceleratedFreeMonths ? baselineFreeMonths - acceleratedFreeMonths : 0;

  const moneyBackSuggestions = snapshot ? listMoneyBackReview(snapshot, todayIso) : [];

  const uncollectedCapital = totals.owedToMe;
  const overdueCapital = owedToMeRows
    .filter((r) => snapshot && debtIsOverdue(r.debt, snapshot, todayIso))
    .reduce((s, r) => s + r.balance, 0n);

  const defaultAccount = snapshot?.accounts.find((a) => !a.archived);

  const onSendReminder = async (debt: PersonDebt, balance: bigint) => {
    const accountStr = defaultAccount ? `${defaultAccount.name}` : '';
    const message = accountStr
      ? t('debts.redesign.remindMessage', { name: debt.name, amount: formatNaira(balance), account: accountStr })
      : t('debts.redesign.remindMessageNoAccount', { name: debt.name, amount: formatNaira(balance) });

    try {
      if (Platform.OS === 'web') {
        const nav =
          typeof navigator !== 'undefined'
            ? (navigator as Navigator & {
                share?: (data: { text: string }) => Promise<void>;
                clipboard?: { writeText: (s: string) => Promise<void> };
              })
            : null;
        if (nav?.share) {
          await nav.share({ text: message });
          return;
        }
        if (nav?.clipboard) {
          await nav.clipboard.writeText(message);
          toast.show(t('debts.redesign.remindCopied'));
          return;
        }
      }
      await Share.share({ message });
    } catch {
      // Ignored if cancelled
    }
  };

  return (
    <RedesignShell>
      <SafeAreaView testID="redesign-debts" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={t('debts.title')}
          onBack={() => router.push('/more')}
          trailing={
            <Pressable
              testID="debts-redesign-add"
              accessibilityRole="button"
              accessibilityLabel={t('debts.redesign.addADebt')}
              onPress={() => {
                setAddDirection(tab === 'owedToMe' ? 'owedToMe' : 'iOwe');
                setAddOpen(true);
              }}
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
        />

        <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
          {/* Dual Summary Header: Owed to you · You owe · Net */}
          <Card testID="debts-summary-header">
            <View style={{ padding: sp.lg, gap: sp.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.sm }}>
                <View testID="debts-summary-owed-to-you" style={{ flex: 1, gap: 4 }}>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('debts.redesign.owedToYou')}
                  </RedesignText>
                  <RedesignAmount
                    testID="debts-amount-owed-to-you"
                    text={formatNaira(totals.owedToMe)}
                    sizeVariant="amount"
                  />
                </View>
                <View testID="debts-summary-you-owe" style={{ flex: 1, gap: 4 }}>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('debts.redesign.youOwe')}
                  </RedesignText>
                  <RedesignAmount
                    testID="debts-amount-you-owe"
                    text={formatNaira(totals.iOwe)}
                    sizeVariant="amount"
                  />
                </View>
                <View testID="debts-summary-net" style={{ flex: 1, gap: 4 }}>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('debts.redesign.netPosition')}
                  </RedesignText>
                  <RedesignAmount
                    testID="debts-amount-net"
                    text={formatNaira(totals.net < 0n ? -totals.net : totals.net)}
                    sign={totals.net >= 0n ? '+' : '−'}
                    sizeVariant="amount"
                  />
                </View>
              </View>

              {/* Action buttons: I lent & I borrowed */}
              <View style={{ flexDirection: 'row', gap: sp.sm }}>
                <View style={{ flex: 1 }}>
                  <RedesignButton
                    testID="debts-btn-lent"
                    label={t('debts.redesign.iLent')}
                    kind="secondary"
                    fullWidth
                    onPress={() => {
                      setAddDirection('owedToMe');
                      setAddOpen(true);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <RedesignButton
                    testID="debts-btn-borrowed"
                    label={t('debts.redesign.iBorrowed')}
                    kind="primary"
                    fullWidth
                    onPress={() => {
                      setAddDirection('iOwe');
                      setAddOpen(true);
                    }}
                  />
                </View>
              </View>
            </View>
          </Card>

          {/* Money Back Review Banner */}
          {moneyBackSuggestions.length > 0 ? (
            <Card testID="debts-moneyback-banner">
              <View
                style={{
                  padding: sp.lg,
                  gap: sp.sm,
                  backgroundColor: theme.surfaceMuted,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <RedesignText variant="label">
                    {t('debts.redesign.moneyBackBanner', { count: moneyBackSuggestions.length })}
                  </RedesignText>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('debts.moneyBack.hint')}
                  </RedesignText>
                </View>
                <RedesignButton
                  testID="debts-moneyback-review"
                  label={t('debts.redesign.reviewMoneyBack')}
                  kind="secondary"
                  onPress={() => setMoneyBackOpen(true)}
                />
              </View>
            </Card>
          ) : null}

          {/* Top 4-way filter tabs: All | They owe me | I owe | Settled */}
          <View testID="debts-filter-tabs">
            <RedesignSegmented
              testID="debts-tab-segmented"
              value={tab}
              onChange={(v) => setTab(v as DebtFilter)}
              options={[
                { key: 'all', label: t('debts.redesign.tabAll') },
                { key: 'owedToMe', label: t('debts.redesign.tabOwedToMe') },
                { key: 'iOwe', label: t('debts.redesign.tabIOwe') },
                { key: 'settled', label: t('debts.redesign.tabSettled') },
              ]}
            />
          </View>

          {/* Recovery Mode Stats Header when in They owe me tab */}
          {tab === 'owedToMe' ? (
            <Card testID="debts-recovery-card">
              <View style={{ padding: sp.lg, gap: sp.sm }}>
                <RedesignText variant="label">{t('debts.redesign.recoveryTitle')}</RedesignText>
                <View style={{ flexDirection: 'row', gap: sp.lg }}>
                  <View testID="debts-recovery-uncollected" style={{ gap: 2 }}>
                    <RedesignText variant="helper" tone="textSecondary">
                      {t('debts.redesign.uncollectedCapital')}
                    </RedesignText>
                    <RedesignAmount text={formatNaira(uncollectedCapital)} sizeVariant="amount" />
                  </View>
                  {overdueCapital > 0n ? (
                    <View testID="debts-recovery-overdue" style={{ gap: 2 }}>
                      <RedesignText variant="helper" tone="danger">
                        {t('debts.redesign.overdueCapital')}
                      </RedesignText>
                      <RedesignAmount text={formatNaira(overdueCapital)} sizeVariant="amount" />
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : null}

          {/* Payoff Mode Header (when in I owe tab or All with debts you owe) */}
          {(tab === 'iOwe' || tab === 'all') && totalOwed > 0n ? (
            <>
              <Card testID="debts-redesign-total">
                <View style={{ padding: sp.lg, gap: sp.sm }}>
                  <RedesignText variant="label" tone="textSecondary">
                    {t('debts.redesign.youOwe')}
                  </RedesignText>
                  <RedesignAmount
                    testID="debts-redesign-total-amount"
                    text={formatNaira(totalOwed)}
                    sizeVariant="display"
                  />
                  <RedesignText>
                    {freeBy
                      ? t('debts.redesign.debtFreeBy', { when: monthYear(freeBy) })
                      : t('debts.redesign.debtFreeUnknown')}
                  </RedesignText>
                  {totalOriginalOwed > 0n ? (
                    <RedesignProgress
                      testID="debts-redesign-progress"
                      value={Number(totalPaidOwed)}
                      max={Number(totalOriginalOwed)}
                    />
                  ) : null}
                </View>
              </Card>

              {/* Payoff Strategy Order Selector */}
              <View style={{ gap: sp.sm }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('debts.redesign.payOffOrder')}
                </RedesignText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm }}>
                  {(
                    [
                      ['smallest', t('debts.redesign.smallestFirst')],
                      ['interest', t('debts.redesign.highestInterest')],
                      ['custom', t('debts.redesign.myOwnOrder')],
                    ] as const
                  ).map(([key, label]) => {
                    const on = order === key;
                    return (
                      <Pressable
                        key={key}
                        testID={`debts-order-${key}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => setOrder(key)}
                        style={{
                          paddingHorizontal: sp.md,
                          paddingVertical: sp.sm,
                          borderRadius: shape['radius-pill'],
                          borderWidth: 1,
                          borderColor: on ? theme.primary : theme.border,
                          backgroundColor: on ? theme.primary : theme.surface,
                          minHeight: tokens.density.touch.minTarget,
                          justifyContent: 'center',
                        }}
                      >
                        <RedesignText variant="label" style={{ color: on ? theme.textOnPrimary : theme.text }}>
                          {label}
                        </RedesignText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Side-by-side Strategy Comparison Card */}
              {strategyComp && (strategyComp.interestSaved > 0n || strategyComp.monthsEarlier > 0) ? (
                <Card testID="debts-strategy-card">
                  <View style={{ padding: sp.lg, gap: sp.sm }}>
                    <RedesignText variant="label">{t('debts.redesign.strategyComparisonTitle')}</RedesignText>
                    <RedesignText variant="body" tone="textSecondary">
                      {t('debts.redesign.strategyComparisonDiff', {
                        saved: formatNaira(strategyComp.interestSaved),
                        months: strategyComp.monthsEarlier,
                        days: strategyComp.snowballFirstVictoryDays,
                      })}
                    </RedesignText>
                  </View>
                </Card>
              ) : null}

              {/* Debt Accelerator (Extra monthly payment chips) */}
              <Card testID="debts-accelerator-card">
                <View style={{ padding: sp.lg, gap: sp.sm }}>
                  <RedesignText variant="label">{t('debts.redesign.acceleratorTitle')}</RedesignText>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('debts.redesign.acceleratorHint')}
                  </RedesignText>
                  <View style={{ flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap' }}>
                    {(
                      [
                        [0n, '0'],
                        [1_000_000n, t('debts.redesign.acceleratorChip10')],
                        [2_500_000n, t('debts.redesign.acceleratorChip25')],
                        [5_000_000n, t('debts.redesign.acceleratorChip50')],
                      ] as const
                    ).map(([val, label]) => {
                      const on = extraMonthly === val;
                      const testId =
                        val === 1_000_000n
                          ? 'debts-accelerator-10'
                          : val === 2_500_000n
                          ? 'debts-accelerator-25'
                          : val === 5_000_000n
                          ? 'debts-accelerator-50'
                          : 'debts-accelerator-0';
                      return (
                        <Pressable
                          key={String(val)}
                          testID={testId}
                          accessibilityRole="button"
                          onPress={() => setExtraMonthly(val)}
                          style={{
                            paddingHorizontal: sp.md,
                            paddingVertical: sp.xs,
                            borderRadius: shape['radius-pill'],
                            borderWidth: 1,
                            borderColor: on ? theme.primary : theme.border,
                            backgroundColor: on ? theme.primary : theme.surface,
                          }}
                        >
                          <RedesignText variant="helper" style={{ color: on ? theme.textOnPrimary : theme.text }}>
                            {label}
                          </RedesignText>
                        </Pressable>
                      );
                    })}
                  </View>
                  {speedupMonths > 0 ? (
                    <RedesignText variant="helper" tone="primary">
                      {t('debts.redesign.acceleratorSpeedup', { months: speedupMonths })}
                    </RedesignText>
                  ) : null}
                </View>
              </Card>
            </>
          ) : null}

          {/* Empty state */}
          {sorted.length === 0 ? (
            <Card testID="debts-redesign-empty">
              <View style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.surfaceMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RedesignIcon name="list" size={28} color={theme.text} />
                </View>
                <RedesignText variant="headline" accessibilityRole="header">
                  {t('debts.redesign.emptyTitle')}
                </RedesignText>
                <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                  {t('debts.redesign.emptyBody')}
                </RedesignText>
                <RedesignButton
                  testID="debts-redesign-empty-add"
                  label={t('debts.redesign.addADebt')}
                  onPress={() => {
                    setAddDirection(tab === 'owedToMe' ? 'owedToMe' : 'iOwe');
                    setAddOpen(true);
                  }}
                />
              </View>
            </Card>
          ) : (
            /* Debts List */
            <Card testID="debts-redesign-list">
              {sorted.map(({ debt, balance }, idx) => {
                const isOwe = debt.direction === 'iOwe';
                const isFocus = isOwe && idx === 0 && balance > 0n;
                const freedCash = calculateCashFlowFreed({ debt, balance });
                const isOverdue = snapshot ? debtIsOverdue(debt, snapshot, todayIso) : false;
                const original = snapshot ? debtOriginalAmount(debt.id, snapshot) : 0n;
                const pctProgress = Math.round(debtProgress(debt.id, snapshot!, balance) * 100);

                return (
                  <Pressable
                    key={debt.id}
                    testID={`debt-row-${debt.id}`}
                    accessibilityRole="button"
                    onPress={() => router.push(`/debts/${debt.id}`)}
                    style={{
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.md,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                      gap: sp.xs,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md }}>
                      <View
                        style={{
                          width: tokens.size.avatar,
                          height: tokens.size.avatar,
                          borderRadius: tokens.size.avatar / 2,
                          backgroundColor: theme.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <RedesignText variant="label">{debtInitials(debt.name).slice(0, 2)}</RedesignText>
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs, flexWrap: 'wrap' }}>
                          <RedesignText variant="label">{debt.name}</RedesignText>
                          {isFocus ? (
                            <View
                              testID="debts-focus-badge"
                              style={{
                                backgroundColor: theme.primary,
                                paddingHorizontal: sp.xs,
                                borderRadius: shape['radius-pill'],
                              }}
                            >
                              <RedesignText variant="helper" style={{ color: theme.textOnPrimary, fontSize: 10 }}>
                                {t('debts.redesign.focusBadge')}
                              </RedesignText>
                            </View>
                          ) : null}
                          {isOverdue ? (
                            <View
                              testID={`debts-row-overdue-${debt.id}`}
                              style={{
                                backgroundColor: 'rgba(217, 45, 32, 0.12)',
                                paddingHorizontal: sp.xs,
                                borderRadius: shape['radius-pill'],
                              }}
                            >
                              <RedesignText variant="helper" tone="danger" style={{ fontSize: 10 }}>
                                {t('debts.redesign.overdueTag')}
                              </RedesignText>
                            </View>
                          ) : null}
                        </View>

                        <RedesignText variant="helper" tone="textSecondary">
                          {isOwe ? t('debts.redesign.youOweLabel') : t('debts.redesign.theyOweLabel')} · {rowCaption(debt)}
                        </RedesignText>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <RedesignAmount text={formatNaira(balance)} sizeVariant="amount" />
                        {original > 0n ? (
                          <RedesignText variant="helper" tone="textSecondary">
                            {isOwe
                              ? t('debts.redesign.percentPaid', { pct: pctProgress })
                              : t('debts.redesign.percentBack', { pct: pctProgress })}
                          </RedesignText>
                        ) : null}
                      </View>
                    </View>

                    {/* Focus debt cash flow impact banner */}
                    {isFocus ? (
                      <View
                        style={{
                          backgroundColor: theme.surfaceMuted,
                          padding: sp.xs,
                          borderRadius: shape['radius-sm'],
                        }}
                      >
                        <RedesignText variant="helper" tone="primary">
                          {t('debts.redesign.cashFlowImpact', { amount: formatNaira(freedCash) })}
                        </RedesignText>
                      </View>
                    ) : null}

                    {/* Row quick actions: Record payment & Remind */}
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        gap: sp.sm,
                        marginTop: sp.xs,
                      }}
                    >
                      {!isOwe && balance > 0n ? (
                        <Pressable
                          testID={`debts-row-remind-${debt.id}`}
                          accessibilityRole="button"
                          onPress={() => void onSendReminder(debt, balance)}
                          style={{
                            paddingHorizontal: sp.md,
                            paddingVertical: sp.xs,
                            borderRadius: shape['radius-pill'],
                            borderWidth: 1,
                            borderColor: theme.border,
                            backgroundColor: theme.surface,
                          }}
                        >
                          <RedesignText variant="helper">{t('debts.redesign.remindButton')}</RedesignText>
                        </Pressable>
                      ) : null}

                      {debt.status === 'open' && balance > 0n ? (
                        <Pressable
                          testID={`debt-quick-pay-${debt.id}`}
                          accessibilityRole="button"
                          onPress={() => setQuickPayDebt(debt)}
                          style={{
                            paddingHorizontal: sp.md,
                            paddingVertical: sp.xs,
                            borderRadius: shape['radius-pill'],
                            backgroundColor: theme.primary,
                          }}
                        >
                          <RedesignText variant="helper" style={{ color: theme.textOnPrimary }}>
                            {t('debts.redesign.quickPay')}
                          </RedesignText>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          )}

          {/* Bank Loans Section */}
          <Card testID="debts-bank-loans">
            <View style={{ padding: sp.lg, gap: sp.sm }}>
              <RedesignText variant="label">{t('debts.bankLoansTitle')}</RedesignText>
              <RedesignText variant="helper" tone="textSecondary">
                {t('debts.bankLoansBody')}
              </RedesignText>
              <RedesignButton
                label={t('debts.redesign.viewBankLoans')}
                kind="secondary"
                onPress={() => router.push('/accounts')}
              />
            </View>
          </Card>
        </ScrollView>

        {/* Add Debt Sheet */}
        {addOpen && snapshot ? (
          <AddDebtSheet
            snapshot={snapshot}
            initialDirection={addDirection}
            onClose={() => setAddOpen(false)}
            onSave={async (input) => {
              const r = await repo.openPersonDebt(input);
              if (r.ok) {
                if (input.monthly && input.monthly > 0n) {
                  await repo.updatePersonDebt({
                    ...r.value,
                    scheduleAmountMinor: input.monthly.toString(),
                    scheduleEvery: 'month',
                    scheduleFirstDue: input.dueDate,
                  });
                }
                toast.show(t('debts.redesign.debtSaved'));
                setAddOpen(false);
              }
            }}
          />
        ) : null}

        {/* Money Back Review Sheet */}
        {moneyBackOpen ? <MoneyBackReviewSheet onClose={() => setMoneyBackOpen(false)} /> : null}

        {/* Inline Quick Payment Sheet */}
        {quickPayDebt && snapshot ? (
          <QuickPaymentSheet
            debt={quickPayDebt}
            snapshot={snapshot}
            onClose={() => setQuickPayDebt(null)}
            onSave={async ({ amount, accountId, date }) => {
              const r = await repo.recordDebtPayment(quickPayDebt.id, {
                accountId,
                amount,
                date,
              });
              if (r.ok) {
                toast.show(t('debts.redesign.paymentSaved'));
                const remaining = allRows.find((row) => row.debt.id === quickPayDebt.id)?.balance ?? 0n;
                if (remaining <= amount) {
                  toast.show(t('debts.redesign.settledCelebrationTitle'));
                }
                setQuickPayDebt(null);
              }
            }}
          />
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

function AddDebtSheet({
  snapshot,
  initialDirection = 'iOwe',
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  initialDirection?: PersonDebt['direction'];
  onClose: () => void;
  onSave: (input: {
    name: string;
    direction: PersonDebt['direction'];
    accountId: string;
    amount: bigint;
    date: string;
    interest?: DebtInterest;
    dueDate?: string;
    monthly?: bigint;
    notes?: string;
  }) => Promise<void>;
}) {
  const [direction, setDirection] = useState<PersonDebt['direction']>(initialDirection);
  const [kind, setKind] = useState<DebtKind>('loan');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [interestText, setInterestText] = useState('');
  const [monthlyText, setMonthlyText] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseAmount(amountText);
  const selectedAccountName =
    snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('debts.redesign.chooseOption');

  // Real APR reality check computation
  const monthlyPct = Number(interestText.replace(/%/g, '').trim());
  const hasMonthlyRate = Number.isFinite(monthlyPct) && monthlyPct > 0;
  const realApr =
    hasMonthlyRate && parsedAmount.ok && parsedAmount.minor > 0n
      ? calculateRealApr(monthlyPct, parsedAmount.minor, 6)
      : null;

  return (
    <RedesignSheet
      testID="debts-redesign-add-sheet"
      visible
      title={t('debts.redesign.addDebtTitle')}
      onClose={onClose}
      dirty={!!name || !!amountText || !!interestText || !!monthlyText}
      footer={
        <RedesignButton
          testID="debts-redesign-save"
          label={t('debts.redesign.addDebt')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!name.trim()) {
              setError(t('debts.redesign.namePlaceholder'));
              return;
            }
            if (!parsedAmount.ok || parsedAmount.minor <= 0n) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('debts.redesign.chooseOption'));
              return;
            }
            let interest: DebtInterest | undefined = { kind: 'none' };
            if (kind !== 'cooperative') {
              const yearPct = Number(interestText.replace(/%/g, '').trim());
              if (interestText.trim() && Number.isFinite(yearPct) && yearPct > 0) {
                interest = { kind: 'percent_month', percent: yearPct / 12 };
              }
            }
            const monthly = monthlyText.trim() ? parseAmount(monthlyText) : null;
            if (monthlyText.trim() && (!monthly || !monthly.ok || monthly.minor <= 0n)) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            setSaving(true);
            void onSave({
              name: name.trim(),
              direction,
              accountId,
              amount: parsedAmount.minor,
              date: today(),
              interest,
              dueDate: nextDate.trim() || undefined,
              monthly: monthly && monthly.ok ? monthly.minor : undefined,
              notes:
                kind === 'card'
                  ? 'card'
                  : kind === 'person'
                  ? 'person'
                  : kind === 'cooperative'
                  ? 'cooperative'
                  : kind === 'loan_app'
                  ? 'loan_app'
                  : 'loan',
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        {/* Direction Segmented Switcher */}
        <RedesignSegmented
          testID="debts-redesign-direction"
          value={direction}
          onChange={(d) => setDirection(d as PersonDebt['direction'])}
          options={[
            { key: 'iOwe', label: t('debts.redesign.tabIOwe') },
            { key: 'owedToMe', label: t('debts.redesign.tabOwedToMe') },
          ]}
        />
        <RedesignText variant="helper" tone="textSecondary">
          {direction === 'owedToMe' ? t('debts.redesign.lendCaption') : t('debts.redesign.borrowCaption')}
        </RedesignText>

        {/* Debt Kind */}
        <RedesignSegmented
          testID="debts-redesign-kind"
          value={kind}
          onChange={(k) => setKind(k as DebtKind)}
          options={[
            { key: 'loan', label: t('debts.redesign.kindLoan') },
            { key: 'card', label: t('debts.redesign.kindCard') },
            { key: 'person', label: t('debts.redesign.kindPerson') },
            { key: 'cooperative', label: t('debts.redesign.kindCooperative') },
            { key: 'loan_app', label: t('debts.redesign.kindLoanApp') },
          ]}
        />

        {/* Name input + contact picker */}
        <View style={{ gap: sp.xs }}>
          <RedesignField
            testID="debts-redesign-name"
            label={t('debts.redesign.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('debts.redesign.namePlaceholder')}
          />
          {contactsAvailable() ? (
            <Pressable
              testID="debts-redesign-pick-contact"
              accessibilityRole="button"
              accessibilityLabel={t('debts.pickContact')}
              onPress={async () => {
                const contact = await pickContact();
                if (contact?.name) setName(contact.name);
              }}
              style={{
                paddingHorizontal: sp.md,
                paddingVertical: sp.xs,
                borderRadius: shape['radius-pill'],
                borderWidth: 1,
                borderColor: theme.border,
                alignSelf: 'flex-start',
              }}
            >
              <RedesignText variant="helper">{t('debts.pickContact')}</RedesignText>
            </Pressable>
          ) : null}
        </View>

        {/* Amount */}
        <RedesignField
          testID="debts-redesign-amount"
          label={t('debts.redesign.amountLeft')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('debts.redesign.amountHint')}
        </RedesignText>

        {/* Interest rate (if not cooperative) */}
        {kind !== 'cooperative' ? (
          <RedesignField
            testID="debts-redesign-interest"
            label={t('debts.redesign.interestYearLabel')}
            value={interestText}
            onChangeText={setInterestText}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : (
          <RedesignText variant="helper" tone="textSecondary">
            {t('debts.redesign.cooperativeNote')}
          </RedesignText>
        )}

        {/* Real APR Reality Check callout */}
        {realApr ? (
          <View
            testID="debts-real-apr-card"
            style={{
              backgroundColor: theme.surfaceMuted,
              padding: sp.md,
              borderRadius: shape['radius-md'],
              gap: 4,
            }}
          >
            <RedesignText variant="label">{t('debts.redesign.realAprTitle')}</RedesignText>
            <RedesignText variant="helper" tone="danger">
              {t('debts.redesign.realAprValue', {
                monthly: monthlyPct,
                annual: realApr.annualAprPct,
                interest: formatNaira(realApr.totalInterestMinor),
              })}
            </RedesignText>
          </View>
        ) : null}

        {/* Monthly payment */}
        <RedesignField
          testID="debts-redesign-monthly"
          label={t('debts.redesign.monthlyPayment')}
          value={monthlyText}
          onChangeText={setMonthlyText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {/* Next payment date */}
        <RedesignField
          testID="debts-redesign-next"
          label={t('debts.redesign.nextPayment')}
          value={nextDate}
          onChangeText={setNextDate}
          placeholder={t('debts.redesign.pickDate')}
        />

        {/* Account selector */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('debts.redesign.account')}</RedesignText>
          <Pressable
            testID="debts-redesign-account-picker"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{selectedAccountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? snapshot.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      setAccountId(a.id);
                      setAccountOpen(false);
                    }}
                    style={{ padding: sp.md }}
                  >
                    <RedesignText>{a.name}</RedesignText>
                  </Pressable>
                ))
            : null}
        </View>

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

function QuickPaymentSheet({
  debt,
  snapshot,
  onClose,
  onSave,
}: {
  debt: PersonDebt;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: { amount: bigint; accountId: string; date: string }) => Promise<void>;
}) {
  const todayIso = today();
  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const defaultAccountId = debt.accountId ?? accounts[0]?.id ?? '';

  const [amountText, setAmountText] = useState(
    debt.scheduleAmountMinor ? (Number(debt.scheduleAmountMinor) / 100).toFixed(2) : '',
  );
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [accountOpen, setAccountOpen] = useState(false);
  const [dateText, setDateText] = useState(todayIso);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? t('debts.redesign.chooseOption');
  const parsed = parseAmount(amountText);

  return (
    <RedesignSheet
      testID="debt-quick-pay-sheet"
      visible
      title={t('debts.redesign.recordPaymentTitle')}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="debt-quick-pay-save"
          label={duplicateWarning ? t('debts.redesign.recordAnyway') : t('debts.redesign.savePayment')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('debts.redesign.chooseOption'));
              return;
            }

            const paymentDate = dateText.trim() || todayIso;
            if (!duplicateWarning) {
              const dup = findRecentPayment(debt.id, snapshot, parsed.minor, paymentDate);
              if (dup) {
                setDuplicateWarning(dup);
                return;
              }
            }

            setSaving(true);
            void onSave({ amount: parsed.minor, accountId, date: paymentDate }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        {duplicateWarning ? (
          <View
            testID="debt-duplicate-warning-box"
            style={{
              backgroundColor: theme.surfaceMuted,
              padding: sp.md,
              borderRadius: shape['radius-md'],
              gap: 4,
            }}
          >
            <RedesignText variant="label" tone="danger">
              {t('debts.duplicateTitle')}
            </RedesignText>
            <RedesignText variant="helper" tone="textSecondary">
              {t('debts.redesign.duplicateWarning', { date: duplicateWarning })}
            </RedesignText>
          </View>
        ) : null}

        <RedesignField
          testID="debt-quick-pay-amount"
          label={t('debts.redesign.amount')}
          value={amountText}
          onChangeText={(v) => {
            setAmountText(v);
            setDuplicateWarning(null);
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('debts.redesign.from')}</RedesignText>
          <Pressable
            testID="debt-quick-pay-from"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setAccountId(a.id);
                    setAccountOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{a.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>

        <RedesignField
          testID="debt-quick-pay-date"
          label={t('debts.redesign.date')}
          value={dateText}
          onChangeText={(v) => {
            setDateText(v);
            setDuplicateWarning(null);
          }}
          placeholder={t('debts.redesign.pickDate')}
        />

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

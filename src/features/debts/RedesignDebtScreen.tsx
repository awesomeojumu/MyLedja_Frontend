import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo, type ReactNode } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Circle } from 'react-native-svg';

import type { PersonDebt } from '@/data/workspace/model';
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
  debtInterestTotal,
  debtRows,
  findRecentPayment,
} from './helpers';
import { DebtScheduleSheet } from './DebtScheduleSheet';
import {
  addMonths,
  debtOriginalAmount,
  debtProgress,
  debtScheduleRows,
  interestDueToDate,
  nextInstallment,
  payoffByDate,
  reminderMessage,
  timelineKindLabel,
} from './schedule';

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

type DebtDetailTab = 'timeline' | 'schedule' | 'simulate';

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

function annualPercent(interest: { kind: string; percent?: number } | undefined): number | null {
  if (!interest || interest.kind === 'none') return null;
  if (interest.kind === 'percent_month' && typeof interest.percent === 'number') {
    return Math.round(interest.percent * 12 * 10) / 10;
  }
  return null;
}

function cashAccountForEvent(eventId: string, snapshot: Snapshot): string | undefined {
  const event = snapshot.events.find((e) => e.id === eventId);
  if (!event) return undefined;
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const line = event.lines.find((l) => accountIds.has(l.ledgerAccountId));
  if (!line) return undefined;
  return snapshot.accounts.find((a) => a.id === line.ledgerAccountId)?.name;
}

function estimatePayoff(balance: bigint, monthly: bigint | null, fromIso: string): string | null {
  if (!monthly || monthly <= 0n || balance <= 0n) return null;
  const months = Number(balance / monthly + (balance % monthly > 0n ? 1n : 0n));
  return addMonths(fromIso, Math.max(1, months));
}

export function RedesignDebtScreen({ embeddedId }: { embeddedId?: string } = {}) {
  const params = useLocalSearchParams<{ id?: string; payment?: string; tab?: string }>();
  const id = embeddedId ?? (typeof params.id === 'string' ? params.id : undefined);
  const router = useRouter();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const { width } = useWindowDimensions();
  const isTabletOrDesktop = width >= 768;
  const todayIso = today();

  const [activeTab, setActiveTab] = useState<DebtDetailTab>('timeline');
  const [payOpen, setPayOpen] = useState(params.payment === id);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [simExtraMonthly, setSimExtraMonthly] = useState<bigint>(0n);

  const allDebts = useMemo(() => {
    return snapshot ? debtRows(snapshot, 'all', todayIso) : [];
  }, [snapshot, todayIso]);

  const row = allDebts.find((r) => r.debt.id === id) ?? null;

  if (!snapshot || !id || !row) {
    return (
      <RedesignShell>
        <SafeAreaView testID="redesign-debt-loading" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
          <RedesignTopBar title={t('debts.detailTitle')} onBack={() => router.push('/debts')} />
        </SafeAreaView>
      </RedesignShell>
    );
  }

  const { debt, balance } = row;
  const isOwe = debt.direction === 'iOwe';
  const original = debtOriginalAmount(debt.id, snapshot);
  const paid = original > balance ? original - balance : 0n;
  const progress = debtProgress(debt.id, snapshot, balance);
  const pctPaid = Math.round(progress * 100);

  const pct = annualPercent(debt.interest);
  const monthly = debt.scheduleAmountMinor ? BigInt(debt.scheduleAmountMinor) : null;
  const next = nextInstallment(debt, snapshot, todayIso);
  const nextLabel = next
    ? `${formatNaira(next.amountMinor)} · ${dayMonth(next.dueDate)}`
    : debt.nextDueDate
    ? dayMonth(debt.nextDueDate)
    : t('debts.redesign.notSet');

  const baselinePayoff =
    payoffByDate(debt, snapshot) ?? estimatePayoff(balance, monthly && monthly > 0n ? monthly : null, todayIso);

  // Strategy Priority ranking in workspace
  const iOweDebts = allDebts.filter((d) => d.debt.direction === 'iOwe' && d.balance > 0n);
  const isAvalancheFirst =
    isOwe &&
    iOweDebts.length > 0 &&
    iOweDebts.slice().sort((a, b) => {
      const ap = annualPercent(a.debt.interest) ?? -1;
      const bp = annualPercent(b.debt.interest) ?? -1;
      if (bp !== ap) return bp - ap;
      return a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1;
    })[0]?.debt.id === debt.id;

  const isSnowballFirst =
    isOwe &&
    iOweDebts.length > 0 &&
    iOweDebts.slice().sort((a, b) => (a.balance === b.balance ? 0 : a.balance < b.balance ? -1 : 1))[0]?.debt.id ===
      debt.id;

  // Cumulative interest
  const interestTotal = debtInterestTotal(debt, snapshot);

  // Entries
  const allEntries = snapshot.debtEntries
    .filter((e) => e.debtId === debt.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Amortization schedule rows
  const scheduleRows = debtScheduleRows(debt, snapshot, todayIso);

  // What-if simulator calculations
  const baselineMonthly = monthly && monthly > 0n ? monthly : balance > 2_000_000n ? balance / 20n : balance;
  const simulatedMonthly = baselineMonthly + simExtraMonthly;
  const baselineMonths = baselineMonthly > 0n ? Number(balance / baselineMonthly + (balance % baselineMonthly > 0n ? 1n : 0n)) : 0;
  const simulatedMonths = simulatedMonthly > 0n ? Number(balance / simulatedMonthly + (balance % simulatedMonthly > 0n ? 1n : 0n)) : 0;
  const savedMonths = baselineMonths > simulatedMonths ? baselineMonths - simulatedMonths : 0;
  const simulatedPayoff = addMonths(todayIso, Math.max(1, simulatedMonths));

  const monthlyRatePct = debt.interest?.kind === 'percent_month' ? debt.interest.percent : 0;
  const baselineInterest =
    (balance * BigInt(Math.round(monthlyRatePct * 100)) * BigInt(baselineMonths)) / 10_000n;
  const simulatedInterest =
    (balance * BigInt(Math.round(monthlyRatePct * 100)) * BigInt(simulatedMonths)) / 10_000n;
  const savedInterest = baselineInterest > simulatedInterest ? baselineInterest - simulatedInterest : 0n;

  // Trajectory chart points
  const chartWidth = 300;
  const chartHeight = 110;
  const totalAmountNum = Number(original > 0n ? original : balance > 0n ? balance : 1n);

  const baselinePoints = `0,10 ${chartWidth},${chartHeight - 10}`;
  const actualY = chartHeight - 10 - Math.round(((totalAmountNum - Number(balance)) / totalAmountNum) * (chartHeight - 20));
  const actualPoints = `0,10 ${chartWidth / 2},${Math.max(10, actualY)}`;
  const simY = Math.max(10, chartHeight - 10 - (savedMonths > 0 ? 30 : 0));
  const simPoints = `0,10 ${chartWidth * 0.75},${simY}`;

  const sendReminder = async (omitAmount: boolean) => {
    const polite = reminderMessage(debt, balance, next, { omitAmount });
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void>; clipboard?: { writeText: (s: string) => Promise<void> } };
        if (nav?.share) {
          await nav.share({ text: polite });
          return;
        }
        if (nav?.clipboard) {
          await nav.clipboard.writeText(polite);
          toast.show(t('debts.reminderCopied'));
          return;
        }
      }
      const wa = `whatsapp://send?text=${encodeURIComponent(polite)}`;
      if (await Linking.canOpenURL(wa)) {
        await Linking.openURL(wa);
        return;
      }
      await Share.share({ message: polite });
    } catch {
      toast.show(t('debts.reminderCopied'));
    }
  };

  // Timeline view component
  const timelineContent = (
    <View style={{ gap: sp.sm }}>
      {allEntries.map((entry) => {
        const account = cashAccountForEvent(entry.eventId, snapshot);
        const meta = account
          ? t('debts.redesign.paymentMeta', { when: dayMonth(entry.date), account })
          : t('debts.redesign.paymentMetaDate', { when: dayMonth(entry.date) });
        const isPayment = entry.kind === 'payment';
        const isLendOrBorrow = entry.kind === 'lend' || entry.kind === 'borrow';

        return (
          <Pressable
            key={entry.id}
            testID={`debt-timeline-${entry.id}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/transactions', params: { tx: entry.eventId } })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: sp.md,
              paddingHorizontal: sp.md,
              paddingVertical: sp.md,
              backgroundColor: theme.surface,
              borderRadius: shape['radius-md'],
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                width: tokens.size.avatar,
                height: tokens.size.avatar,
                borderRadius: tokens.size.avatar / 2,
                backgroundColor: isPayment ? theme.primary : theme.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon
                name={isPayment ? 'check' : isLendOrBorrow ? 'swap' : 'more'}
                size={18}
                color={isPayment ? theme.textOnPrimary : theme.text}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <RedesignText variant="label">{timelineKindLabel(entry.kind)}</RedesignText>
              <RedesignText variant="helper" tone="textSecondary">
                {meta}
              </RedesignText>
              {entry.interestMinor ? (
                <RedesignText variant="helper" tone="textSecondary">
                  {t('debts.redesign.splitPrincipal')}: {formatNaira(BigInt(entry.amountMinor))} ·{' '}
                  {t('debts.redesign.splitInterest')}: {formatNaira(BigInt(entry.interestMinor))}
                </RedesignText>
              ) : null}
            </View>
            <RedesignAmount
              text={formatNaira(BigInt(entry.amountMinor))}
              sizeVariant="amount"
              sign={isPayment ? '−' : '+'}
            />
          </Pressable>
        );
      })}
    </View>
  );

  // Amortization schedule view component
  const scheduleContent = (
    <View testID="debt-amortization-table" style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <RedesignText variant="label">{t('debts.redesign.amortizationTitle')}</RedesignText>
        <RedesignButton
          testID="debt-edit-schedule"
          label={t('debts.menuSchedule')}
          kind="secondary"
          onPress={() => setScheduleSheetOpen(true)}
        />
      </View>

      {scheduleRows.length === 0 ? (
        <Card>
          <View style={{ padding: sp.lg, gap: sp.sm, alignItems: 'center' }}>
            <RedesignText tone="textSecondary">{t('debts.scheduleEmpty')}</RedesignText>
          </View>
        </Card>
      ) : (
        <Card>
          {scheduleRows.map((inst, index) => {
            const isPaid = inst.status === 'paid';
            const isDue = inst.status === 'due';
            const isOverdue = inst.status === 'overdue';

            return (
              <View
                key={`${inst.dueDate}-${index}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: sp.md,
                  paddingVertical: sp.md,
                  borderBottomWidth: index < scheduleRows.length - 1 ? 1 : 0,
                  borderBottomColor: theme.border,
                }}
              >
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                    <RedesignText variant="label">{dayMonth(inst.dueDate)}</RedesignText>
                    <View
                      style={{
                        paddingHorizontal: sp.xs,
                        borderRadius: shape['radius-pill'],
                        backgroundColor: isPaid
                          ? theme.primary
                          : isOverdue
                          ? 'rgba(217, 45, 32, 0.12)'
                          : theme.surfaceMuted,
                      }}
                    >
                      <RedesignText
                        variant="helper"
                        tone={isPaid ? 'textOnPrimary' : isOverdue ? 'danger' : 'textSecondary'}
                        style={{ fontSize: 10 }}
                      >
                        {isPaid
                          ? t('debts.redesign.statusPaid')
                          : isDue
                          ? t('debts.redesign.statusDue')
                          : isOverdue
                          ? t('debts.redesign.statusOverdue')
                          : t('debts.redesign.statusUpcoming')}
                      </RedesignText>
                    </View>
                  </View>
                  <RedesignText variant="helper" tone="textSecondary">
                    #{index + 1}
                  </RedesignText>
                </View>
                <RedesignAmount text={formatNaira(inst.amountMinor)} sizeVariant="amount" />
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );

  // Early payoff simulator component
  const simulatorContent = (
    <Card testID="debt-simulator-card">
      <View style={{ padding: sp.lg, gap: sp.md }}>
        <View style={{ gap: 2 }}>
          <RedesignText variant="label">{t('debts.redesign.simulateTitle')}</RedesignText>
          <RedesignText variant="helper" tone="textSecondary">
            {t('debts.redesign.simulateHint')}
          </RedesignText>
        </View>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="helper" tone="textSecondary">
            {t('debts.redesign.extraMonthlyLabel')}
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
              const on = simExtraMonthly === val;
              const testId =
                val === 1_000_000n
                  ? 'debt-simulate-10'
                  : val === 2_500_000n
                  ? 'debt-simulate-25'
                  : val === 5_000_000n
                  ? 'debt-simulate-50'
                  : 'debt-simulate-0';
              return (
                <Pressable
                  key={String(val)}
                  testID={testId}
                  accessibilityRole="button"
                  onPress={() => setSimExtraMonthly(val)}
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
        </View>

        <View
          style={{
            backgroundColor: theme.surfaceMuted,
            padding: sp.md,
            borderRadius: shape['radius-md'],
            gap: sp.xs,
          }}
        >
          {savedMonths > 0 ? (
            <>
              <RedesignText variant="label" tone="primary">
                {t('debts.redesign.timeSaved', { months: savedMonths, date: monthYear(simulatedPayoff) })}
              </RedesignText>
              {savedInterest > 0n ? (
                <RedesignText variant="helper" tone="primary">
                  {t('debts.redesign.interestSaved', { amount: formatNaira(savedInterest) })}
                </RedesignText>
              ) : null}
            </>
          ) : (
            <RedesignText variant="helper" tone="textSecondary">
              {t('debts.redesign.noSavings')}
            </RedesignText>
          )}
        </View>
      </View>
    </Card>
  );

  const mainOverview = (
    <View style={{ gap: sp.lg }}>
      {/* Priority Badge */}
      {isAvalancheFirst || isSnowballFirst ? (
        <View
          testID="debt-priority-badge"
          style={{
            backgroundColor: theme.primary,
            paddingHorizontal: sp.md,
            paddingVertical: sp.xs,
            borderRadius: shape['radius-pill'],
            alignSelf: 'flex-start',
          }}
        >
          <RedesignText variant="helper" style={{ color: theme.textOnPrimary }}>
            {isAvalancheFirst
              ? t('debts.redesign.priorityBadgeAvalanche')
              : t('debts.redesign.priorityBadgeSnowball')}
          </RedesignText>
        </View>
      ) : null}

      {/* Main Balance Card */}
      <Card testID="debt-redesign-balance">
        <View style={{ padding: sp.lg, gap: sp.sm }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('debts.redesign.leftToPay')}
          </RedesignText>
          <RedesignAmount testID="debt-redesign-left" text={formatNaira(balance)} sizeVariant="display" />
          {original > 0n ? (
            <>
              <RedesignText>
                {t('debts.redesign.paidOf', { paid: formatNaira(paid), original: formatNaira(original) })}
              </RedesignText>
              <RedesignProgress testID="debt-redesign-progress" value={Number(paid)} max={Number(original)} />
            </>
          ) : null}

          {/* Milestone Markers */}
          <View testID="debt-milestone-bar" style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: sp.xs }}>
            {[25, 50, 75, 100].map((m) => (
              <View key={m} style={{ alignItems: 'center', gap: 2 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: pctPaid >= m ? theme.primary : theme.border,
                  }}
                />
                <RedesignText variant="helper" tone={pctPaid >= m ? 'primary' : 'textSecondary'} style={{ fontSize: 9 }}>
                  {m}%
                </RedesignText>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {/* Trajectory Curve Chart */}
      {original > 0n ? (
        <Card testID="debt-trajectory-chart">
          <View style={{ padding: sp.lg, gap: sp.sm }}>
            <RedesignText variant="label">{t('debts.payoffChart')}</RedesignText>
            <Svg width={chartWidth} height={chartHeight} style={{ alignSelf: 'center' }}>
              {/* Baseline expected path (dashed) */}
              <Polyline
                points={baselinePoints}
                fill="none"
                stroke={theme.border}
                strokeWidth={2}
                strokeDasharray="4,4"
              />
              {/* Accelerated path if simulation active */}
              {simExtraMonthly > 0n ? (
                <Polyline points={simPoints} fill="none" stroke={theme.primary} strokeWidth={2} />
              ) : null}
              {/* Actual history path (solid) */}
              <Polyline points={actualPoints} fill="none" stroke={theme.text} strokeWidth={2.5} />
              <Circle cx={chartWidth / 2} cy={Math.max(10, actualY)} r={4} fill={theme.text} />
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <RedesignText variant="helper" tone="textSecondary">
                -- {t('debts.redesign.chartExpected')}
              </RedesignText>
              <RedesignText variant="helper" tone="text">
                — {t('debts.redesign.chartActual')}
              </RedesignText>
              {simExtraMonthly > 0n ? (
                <RedesignText variant="helper" tone="primary">
                  — {t('debts.redesign.chartAccelerated')}
                </RedesignText>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Details Card */}
      <Card testID="debt-redesign-details">
        {(
          [
            [
              t('debts.redesign.interest'),
              pct != null ? t('debts.redesign.interestYearValue', { pct: String(pct) }) : t('debts.redesign.noInterest'),
            ],
            [
              t('debts.redesign.monthlyPayment'),
              monthly && monthly > 0n ? formatNaira(monthly) : t('debts.redesign.notSet'),
            ],
            [t('debts.redesign.nextPayment'), nextLabel],
            [t('debts.redesign.paidOffBy'), baselinePayoff ? monthYear(baselinePayoff) : t('debts.redesign.notSet')],
          ] as const
        ).map(([label, value], i, arr) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: sp.md,
              paddingHorizontal: sp.lg,
              paddingVertical: sp.md,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
              borderBottomColor: theme.border,
            }}
          >
            <RedesignText tone="textSecondary">{label}</RedesignText>
            <RedesignText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</RedesignText>
          </View>
        ))}
      </Card>

      {/* Interest Cost / Earned Header Stat (P16-08) */}
      {interestTotal > 0n ? (
        <Card testID="debt-interest-total">
          <View style={{ padding: sp.md, alignItems: 'center' }}>
            <RedesignText variant="helper" tone="textSecondary">
              {debt.direction === 'owedToMe'
                ? t('debts.interestEarnedYou', { amount: formatNaira(interestTotal) })
                : t('debts.interestCostYou', { amount: formatNaira(interestTotal) })}
            </RedesignText>
          </View>
        </Card>
      ) : null}
    </View>
  );

  const shell = (body: ReactNode) =>
    embeddedId ? (
      <View testID="redesign-debt" style={{ flex: 1 }}>
        {body}
      </View>
    ) : (
      <RedesignShell>
        <SafeAreaView testID="redesign-debt" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
          {body}
        </SafeAreaView>
      </RedesignShell>
    );

  return shell(
    <>
      {embeddedId ? null : (
        <RedesignTopBar
          title={debt.name}
          onBack={() => router.push('/debts')}
          trailing={
            <Pressable
              testID="debt-redesign-more"
              accessibilityRole="button"
              accessibilityLabel={t('debts.redesign.more')}
              onPress={() => setMenuOpen(true)}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="more" size={22} color={theme.text} />
            </Pressable>
          }
        />
      )}

      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: 140 }}>
        {isTabletOrDesktop ? (
          /* Tablet / Desktop: Two-Column Side-by-Side */
          <View style={{ flexDirection: 'row', gap: sp.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: sp.lg }}>
              {mainOverview}
              <View style={{ gap: sp.sm }}>
                <RedesignText variant="label">{t('debts.redesign.payments')}</RedesignText>
                {timelineContent}
              </View>
            </View>
            <View style={{ flex: 1, gap: sp.lg }}>
              {simulatorContent}
              {scheduleContent}
            </View>
          </View>
        ) : (
          /* Phone: Segmented control switching between Timeline | Schedule | Simulate */
          <>
            {mainOverview}

            <View testID="debt-tabs-segmented">
              <RedesignSegmented
                value={activeTab}
                onChange={(t) => setActiveTab(t as DebtDetailTab)}
                options={[
                  { key: 'timeline', label: t('debts.redesign.tabTimeline') },
                  { key: 'schedule', label: t('debts.redesign.tabSchedule') },
                  { key: 'simulate', label: t('debts.redesign.tabSimulate') },
                ]}
              />
            </View>

            {activeTab === 'timeline' ? (
              <View style={{ gap: sp.sm }}>
                <RedesignText variant="label">{t('debts.redesign.payments')}</RedesignText>
                {timelineContent}
              </View>
            ) : null}

            {activeTab === 'schedule' ? scheduleContent : null}

            {activeTab === 'simulate' ? simulatorContent : null}
          </>
        )}
      </ScrollView>

      {/* Floating Action Bar */}
      {debt.status === 'open' ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: sp.lg,
            backgroundColor: theme.page,
            flexDirection: 'row',
            gap: sp.sm,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <View style={{ flex: 1 }}>
            <RedesignButton
              testID="debt-redesign-record"
              label={t('debts.redesign.recordPayment')}
              fullWidth
              onPress={() => setPayOpen(true)}
            />
          </View>
          {!isOwe ? (
            <View style={{ flex: 1 }}>
              <RedesignButton
                testID="debt-send-reminder-btn"
                label={t('debts.redesign.sendReminder')}
                kind="secondary"
                fullWidth
                onPress={() => setReminderOpen(true)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Record Payment Sheet with Principal vs Interest Split & Duplicate Guard */}
      {payOpen ? (
        <RecordPaymentSheet
          debt={debt}
          balance={balance}
          defaultAmount={monthly && monthly > 0n ? monthly : undefined}
          snapshot={snapshot}
          onClose={() => setPayOpen(false)}
          onSave={async (input) => {
            const r = await repo.recordDebtPayment(debt.id, {
              accountId: input.accountId,
              amount: input.principal,
              interest: input.interest,
              date: input.date,
              overpayment: input.overpayment,
            });
            if (r.ok) {
              toast.show(t('debts.redesign.paymentSaved'));
              setPayOpen(false);
            }
          }}
        />
      ) : null}

      {/* Write Off Sheet (P16-07) */}
      {writeOffOpen ? (
        <WriteOffSheet
          debt={debt}
          balance={balance}
          onClose={() => setWriteOffOpen(false)}
          onConfirm={async (reason) => {
            const r = await repo.writeOffDebt(debt.id, { amount: balance, date: todayIso, reason });
            if (r.ok) {
              toast.show(t('debts.timelineWriteOff'));
              setWriteOffOpen(false);
              router.push('/debts');
            }
          }}
        />
      ) : null}

      {/* Send Reminder Sheet with WhatsApp Deep Link (P16-06) */}
      {reminderOpen ? (
        <ReminderSheet
          debt={debt}
          balance={balance}
          next={next}
          onClose={() => setReminderOpen(false)}
          onSend={(omit) => {
            setReminderOpen(false);
            void sendReminder(omit);
          }}
        />
      ) : null}

      {/* Debt Schedule Sheet */}
      {scheduleSheetOpen ? (
        <DebtScheduleSheet
          debt={debt}
          totalMinor={original > 0n ? original : balance}
          onClose={() => setScheduleSheetOpen(false)}
          onSave={async (input) => {
            await repo.updatePersonDebt({
              ...debt,
              scheduleAmountMinor: input.amountMinor.toString(),
              scheduleEvery: input.every,
              scheduleFirstDue: input.firstDue,
              scheduleInstallmentCount: input.count,
            });
            toast.show(t('debts.scheduleSaved'));
            setScheduleSheetOpen(false);
          }}
        />
      ) : null}

      {/* More Options Modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          testID="debt-redesign-menu-scrim"
          style={{ flex: 1, backgroundColor: 'rgba(0,29,52,0.45)', justifyContent: 'flex-end' }}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: shape['radius-lg'],
              borderTopRightRadius: shape['radius-lg'],
              padding: sp.lg,
              gap: sp.sm,
            }}
          >
            <Pressable
              testID="debt-redesign-settle"
              onPress={() => {
                setMenuOpen(false);
                void repo.markPersonDebtSettled(debt.id).then((r) => {
                  if (r.ok) toast.show(t('debts.markedSettled'));
                });
              }}
              style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
            >
              <RedesignText>{t('debts.redesign.menuSettled')}</RedesignText>
            </Pressable>

            {!isOwe && debt.status === 'open' ? (
              <Pressable
                testID="debt-redesign-write-off"
                onPress={() => {
                  setMenuOpen(false);
                  setWriteOffOpen(true);
                }}
                style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
              >
                <RedesignText tone="danger">{t('debts.writeOff')}</RedesignText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setMenuOpen(false)}
              style={{ minHeight: tokens.density.touch.minTarget, justifyContent: 'center' }}
            >
              <RedesignText tone="textSecondary">{t('common.cancel')}</RedesignText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>,
  );
}

function RecordPaymentSheet({
  debt,
  balance,
  defaultAmount,
  snapshot,
  onClose,
  onSave,
}: {
  debt: PersonDebt;
  balance: bigint;
  defaultAmount?: bigint;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: {
    principal: bigint;
    interest: bigint;
    accountId: string;
    date: string;
    overpayment?: 'gift' | 'credit';
  }) => Promise<void>;
}) {
  const todayIso = today();
  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const defaultAccountId = debt.accountId ?? accounts[0]?.id ?? '';

  const next = nextInstallment(debt, snapshot, todayIso);
  const initialTotal = defaultAmount ?? next?.amountMinor ?? balance;
  const initialInterest = interestDueToDate(debt, balance, todayIso);

  const [totalText, setTotalText] = useState((Number(initialTotal) / 100).toFixed(2));
  const [interestText, setInterestText] = useState(
    initialInterest > 0n ? (Number(initialInterest) / 100).toFixed(2) : '0.00',
  );
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [accountOpen, setAccountOpen] = useState(false);
  const [dateText, setDateText] = useState(todayIso);
  const [overpayChoice, setOverpayChoice] = useState<'principal' | 'credit'>('principal');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? t('debts.redesign.chooseOption');
  const parsedTotal = parseAmount(totalText);
  const parsedInterest = parseAmount(interestText);

  const validTotal = parsedTotal.ok && parsedTotal.minor > 0n ? parsedTotal.minor : 0n;
  const parsedInt = parsedInterest.ok && parsedInterest.minor >= 0n ? parsedInterest.minor : 0n;
  const validInterest = parsedInt > validTotal ? 0n : parsedInt;
  const principalMinor = validTotal - validInterest;
  const isOverpaying = principalMinor > balance;
  const overpayAmount = isOverpaying ? principalMinor - balance : 0n;

  return (
    <RedesignSheet
      testID="debt-redesign-pay-sheet"
      visible
      title={t('debts.redesign.recordPaymentTitle')}
      onClose={onClose}
      dirty={!!totalText}
      footer={
        <RedesignButton
          testID="debt-redesign-pay-save"
          label={duplicateWarning ? t('debts.redesign.recordAnyway') : t('debts.redesign.savePayment')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!parsedTotal.ok || parsedTotal.minor <= 0n) {
              setError(t('debts.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('debts.redesign.chooseOption'));
              return;
            }

            const paymentDate = dateText.trim() || todayIso;
            if (!duplicateWarning) {
              const dup = findRecentPayment(debt.id, snapshot, principalMinor, paymentDate);
              if (dup) {
                setDuplicateWarning(dup);
                return;
              }
            }

            setSaving(true);
            void onSave({
              principal: isOverpaying && overpayChoice === 'credit' ? balance : principalMinor,
              interest: validInterest,
              accountId,
              date: paymentDate,
              overpayment: isOverpaying && overpayChoice === 'credit' ? 'credit' : undefined,
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        {duplicateWarning ? (
          <View
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
          testID="debt-redesign-pay-amount"
          label={t('debts.paymentTotal')}
          value={totalText}
          onChangeText={(v) => {
            setTotalText(v);
            setDuplicateWarning(null);
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {/* Principal vs Interest Split (P16-03) */}
        <View style={{ gap: sp.xs }}>
          <RedesignField
            testID="debt-redesign-pay-interest"
            label={t('debts.redesign.splitInterest')}
            value={interestText}
            onChangeText={setInterestText}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <RedesignText variant="helper" tone="textSecondary">
            {t('debts.redesign.splitPrincipal')}: {formatNaira(principalMinor)} · {t('debts.redesign.splitCaption')}
          </RedesignText>
        </View>

        {/* Overpayment Choice */}
        {isOverpaying ? (
          <View
            style={{
              backgroundColor: theme.surfaceMuted,
              padding: sp.md,
              borderRadius: shape['radius-md'],
              gap: sp.xs,
            }}
          >
            <RedesignText variant="label">{t('debts.redesign.overpaymentTitle')}</RedesignText>
            <RedesignText variant="helper" tone="textSecondary">
              {t('debts.redesign.overpaymentBody', { extra: formatNaira(overpayAmount) })}
            </RedesignText>
            <View style={{ flexDirection: 'row', gap: sp.sm, marginTop: sp.xs }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOverpayChoice('principal')}
                style={{
                  paddingHorizontal: sp.md,
                  paddingVertical: sp.xs,
                  borderRadius: shape['radius-pill'],
                  backgroundColor: overpayChoice === 'principal' ? theme.primary : theme.surface,
                }}
              >
                <RedesignText
                  variant="helper"
                  style={{ color: overpayChoice === 'principal' ? theme.textOnPrimary : theme.text }}
                >
                  {t('debts.redesign.overpaymentPrincipal')}
                </RedesignText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOverpayChoice('credit')}
                style={{
                  paddingHorizontal: sp.md,
                  paddingVertical: sp.xs,
                  borderRadius: shape['radius-pill'],
                  backgroundColor: overpayChoice === 'credit' ? theme.primary : theme.surface,
                }}
              >
                <RedesignText
                  variant="helper"
                  style={{ color: overpayChoice === 'credit' ? theme.textOnPrimary : theme.text }}
                >
                  {t('debts.redesign.overpaymentCredit')}
                </RedesignText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Account Selector */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('debts.redesign.from')}</RedesignText>
          <Pressable
            testID="debt-redesign-pay-from"
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
          testID="debt-redesign-pay-date"
          label={t('debts.redesign.date')}
          value={dateText}
          onChangeText={setDateText}
          placeholder={t('debts.redesign.pickDate')}
        />

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

function WriteOffSheet({
  debt,
  balance,
  onClose,
  onConfirm,
}: {
  debt: PersonDebt;
  balance: bigint;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <RedesignSheet
      testID="debt-write-off-sheet"
      visible
      title={t('debts.redesign.writeOffTitle')}
      onClose={onClose}
      dirty={!!reason}
      footer={
        <RedesignButton
          testID="debt-write-off-confirm"
          label={t('debts.redesign.writeOffConfirm')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setSaving(true);
            void onConfirm(reason.trim()).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignText tone="textSecondary">{t('debts.redesign.writeOffCaption')}</RedesignText>
        <RedesignAmount text={formatNaira(balance)} sizeVariant="amount" />
        <RedesignField
          testID="debt-write-off-reason"
          label={t('debts.redesign.writeOffReason')}
          value={reason}
          onChangeText={setReason}
          placeholder={t('debts.redesign.writeOffReasonPlaceholder')}
        />
      </View>
    </RedesignSheet>
  );
}

function ReminderSheet({
  debt,
  balance,
  next,
  onClose,
  onSend,
}: {
  debt: PersonDebt;
  balance: bigint;
  next: ReturnType<typeof nextInstallment>;
  onClose: () => void;
  onSend: (omitAmount: boolean) => void;
}) {
  const [omitAmount, setOmitAmount] = useState(false);
  const preview = reminderMessage(debt, balance, next, { omitAmount });

  return (
    <RedesignSheet
      testID="debt-reminder-sheet"
      visible
      title={t('debts.sendReminder')}
      onClose={onClose}
      footer={
        <View style={{ gap: sp.sm }}>
          <RedesignButton
            testID="debt-reminder-whatsapp"
            label={t('debts.redesign.remindWhatsApp')}
            fullWidth
            onPress={() => onSend(omitAmount)}
          />
        </View>
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignText tone="textSecondary">{t('debts.reminderCaption')}</RedesignText>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: omitAmount }}
          onPress={() => setOmitAmount((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: omitAmount ? theme.primary : theme.border,
              backgroundColor: omitAmount ? theme.primary : theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {omitAmount ? <RedesignIcon name="check" size={14} color={theme.textOnPrimary} /> : null}
          </View>
          <RedesignText>{t('debts.reminderLeaveAmountOut')}</RedesignText>
        </Pressable>

        <View
          style={{
            backgroundColor: theme.surfaceMuted,
            padding: sp.md,
            borderRadius: shape['radius-md'],
          }}
        >
          <RedesignText variant="body" tone="text">
            {preview}
          </RedesignText>
        </View>
      </View>
    </RedesignSheet>
  );
}

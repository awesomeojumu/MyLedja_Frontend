import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  budgetAssignId,
  type IncomeDeduction,
  type IncomeRecordMode,
  type IncomeStream,
  type IncomeStreamKind,
} from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignProgress,
  RedesignSegmented,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { monthOf, nextMonth, prevMonth } from '@/ledger';
import { t } from '@/i18n';
import { formatNaira, parseAmount, toInputText } from '@/money';
import { today } from '@/features/transactions/helpers';

import {
  eventIncomeAmount,
  formatStreamSchedule,
  groupStreamRows,
  incomeForMonth,
  routingSummary,
  streamDueDateInMonth,
  streamPaymentDots,
  takeHomeMinor,
  taxTotalsForYear,
  twelveMonthIncomeSeries,
  unmatchedEvents,
  TAX_CLASS_PRESETS,
  type PaymentDotStatus,
  type StreamRow,
  type TwelveMonthPoint,
} from './helpers';
import { MarkReceivedSheet } from './MarkReceivedSheet';
import type { MarkReceivedPayload } from './markReceived';

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

function monthLongName(month: string): string {
  const m = Number(month.slice(5, 7));
  const y = month.slice(0, 4);
  return `${MONTH_LONG[m] ?? month} ${y}`;
}

function shortDayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function dotColor(status: PaymentDotStatus): string {
  if (status === 'onTime') return '#10b981';
  if (status === 'partial') return '#f59e0b';
  if (status === 'late') return '#f97316';
  if (status === 'missed') return '#ef4444';
  return theme.border;
}

function sourceSubtitle(row: StreamRow, month: string): string {
  const { stream, expected, received } = row;
  if (stream.kind === 'variable' || stream.kind === 'irregular') return t('income.redesign.varies');
  if (received < expected) {
    const due = streamDueDateInMonth(stream, month);
    if (due) return t('income.redesign.expectedOn', { date: shortDayMonth(due) });
  }
  if (stream.rule.every === 'month') {
    const day = stream.rule.on === 0 || stream.rule.on === 31 ? 'last' : String(stream.rule.on);
    return t('income.redesign.everyMonthOn', { day });
  }
  return formatStreamSchedule(stream.rule);
}

function findUpcomingPayday(
  streams: IncomeStream[],
  todayIso: string,
  month: string,
): { stream: IncomeStream; daysUntil: number; due: string } | null {
  const regulars = streams.filter((s) => s.kind === 'regular');
  for (const s of regulars) {
    const due = streamDueDateInMonth(s, month);
    if (!due || due < todayIso) continue;
    const [ty, tm, td] = todayIso.split('-').map(Number) as [number, number, number];
    const [dy, dm, dd] = due.split('-').map(Number) as [number, number, number];
    const d1 = Date.UTC(ty, tm - 1, td);
    const d2 = Date.UTC(dy, dm - 1, dd);
    const daysUntil = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    if (daysUntil <= 14) {
      return { stream: s, daysUntil, due };
    }
  }
  return null;
}

function countBillsDueBefore(snapshot: Snapshot, paydayIso: string, todayIso: string): number {
  let count = 0;
  for (const r of snapshot.recurring) {
    if (r.cancelled || r.kind === 'income') continue;
    const occ = snapshot.occurrences.find(
      (o) => o.recurringId === r.id && o.dueDate >= todayIso && o.dueDate <= paydayIso && o.status !== 'paid',
    );
    if (occ) count += 1;
  }
  return count;
}

/** Modernized Income Command Center (P13 / DESIGN page 13). */
export function RedesignIncomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useGlobalSearchParams<{ stream?: string; table?: string; occurrence?: string }>();
  const { snapshot, repo } = useWorkspace();
  const [month, setMonth] = useState(() => monthOf(today()));
  const year = month.slice(0, 4);

  const addOpen = params.stream === 'new';
  const tableMode = params.table === '1';

  const summary = useMemo(() => (snapshot ? incomeForMonth(snapshot, month) : null), [snapshot, month]);
  const groupedStreams = useMemo(() => (summary ? groupStreamRows(summary.rows) : []), [summary]);
  const chartPoints = useMemo(() => {
    const all = snapshot ? twelveMonthIncomeSeries(snapshot, month) : [];
    return all.slice(-6);
  }, [snapshot, month]);
  const average =
    chartPoints.length === 0
      ? 0n
      : chartPoints.reduce((s, p) => s + p.received, 0n) / BigInt(chartPoints.length);
  const stillExpected =
    summary && summary.expected > summary.received ? summary.expected - summary.received : 0n;
  const hasStreams = (snapshot?.incomeStreams.length ?? 0) > 0;

  const unmatchedList = useMemo(() => (snapshot ? unmatchedEvents(snapshot, month) : []), [snapshot, month]);
  const taxRows = useMemo(() => (snapshot ? taxTotalsForYear(snapshot, year) : []), [snapshot, year]);

  const upcomingPayday = useMemo(
    () => (snapshot ? findUpcomingPayday(snapshot.incomeStreams, today(), month) : null),
    [snapshot, month],
  );
  const billsBeforePayday = useMemo(
    () => (snapshot && upcomingPayday ? countBillsDueBefore(snapshot, upcomingPayday.due, today()) : 0),
    [snapshot, upcomingPayday],
  );

  const editStream = useMemo(() => {
    if (!snapshot || !params.stream || params.stream === 'new') return null;
    return snapshot.incomeStreams.find((s) => s.id === params.stream) ?? null;
  }, [snapshot, params.stream]);

  // Recording / Marking Received Sheet state
  const [recordStream, setRecordStream] = useState<{
    stream: IncomeStream;
    expected: bigint;
    received: bigint;
  } | null>(null);

  // Link Unmatched Transaction state
  const [linkEventId, setLinkEventId] = useState<string | null>(null);

  const streamOptions = useMemo(
    () => snapshot?.incomeStreams.map((s) => ({ value: s.id, label: s.name })) ?? [],
    [snapshot],
  );

  const handleRecordConfirm = async (payload: MarkReceivedPayload) => {
    if (!recordStream) return;
    const { stream } = recordStream;
    const date = payload.date;
    if (payload.kind === 'match') {
      await repo.linkEventToStream(payload.eventId, stream.id);
    } else if (payload.kind === 'undo') {
      await repo.deleteTransaction(payload.eventId, date);
      toast.show(t('income.undoMarkReceivedToast'));
      setRecordStream(null);
      return;
    } else {
      const r = await repo.recordIncomeReceived(stream.id, {
        accountId: stream.accountId,
        amount: payload.amount,
        date,
      });
      if (!r.ok) return;
    }
    for (const row of payload.routing) {
      if (!row.apply) continue;
      if (row.goalId) {
        await repo.allocateToGoal(row.goalId, {
          amount: row.amount,
          date,
          fromAccountId: stream.accountId,
        });
      } else if (row.categoryId && snapshot) {
        const m = monthOf(date);
        const current = snapshot.assigns.get(budgetAssignId(row.categoryId, m)) ?? 0n;
        await repo.setAssigned(row.categoryId, m, current + row.amount);
      }
    }
    toast.show(t('income.markedReceived'));
    setRecordStream(null);
  };

  return (
    <RedesignShell>
      <SafeAreaView testID="redesign-income" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={t('income.title')}
          onBack={() => router.push('/more')}
          trailing={
            <Pressable
              testID="income-redesign-add"
              accessibilityRole="button"
              accessibilityLabel={t('income.redesign.addIncome')}
              onPress={() => router.setParams({ stream: 'new' })}
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
          {/* Month Navigation Strip */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderRadius: shape['radius-lg'],
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: sp.md,
              paddingVertical: sp.sm,
            }}
          >
            <Pressable
              testID="income-prev-month"
              accessibilityRole="button"
              accessibilityLabel={t('income.redesign.prevMonth')}
              onPress={() => setMonth((m) => prevMonth(m))}
              style={{ padding: sp.sm }}
            >
              <RedesignIcon name="chevron-left" size={20} color={theme.text} />
            </Pressable>
            <RedesignText testID="income-month-label" variant="label">
              {monthLongName(month)}
            </RedesignText>
            <Pressable
              testID="income-next-month"
              accessibilityRole="button"
              accessibilityLabel={t('income.redesign.nextMonth')}
              onPress={() => setMonth((m) => nextMonth(m))}
              style={{ padding: sp.sm }}
            >
              <RedesignIcon name="chevron-right" size={20} color={theme.text} />
            </Pressable>
          </View>

          {!hasStreams && unmatchedList.length === 0 ? (
            <Card testID="income-redesign-empty">
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
                  <RedesignIcon name="flow" size={28} color={theme.text} />
                </View>
                <RedesignText variant="headline" accessibilityRole="header">
                  {t('income.redesign.emptyTitle')}
                </RedesignText>
                <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                  {t('income.redesign.emptyBody')}
                </RedesignText>
                <RedesignButton
                  testID="income-redesign-empty-add"
                  label={t('income.redesign.addIncome')}
                  onPress={() => router.setParams({ stream: 'new' })}
                />
              </View>
            </Card>
          ) : null}

          {hasStreams && summary ? (
            <>
              {/* Predictive Days Until Payday Widget */}
              {upcomingPayday ? (
                <View
                  testID="income-payday-widget"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: shape['radius-lg'],
                    padding: sp.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.md,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: theme.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RedesignIcon name="clock" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <RedesignText variant="label">{upcomingPayday.stream.name}</RedesignText>
                    <RedesignText variant="caption" tone="textSecondary">
                      {upcomingPayday.daysUntil === 0
                        ? t('income.redesign.paydayToday')
                        : upcomingPayday.daysUntil === 1
                          ? t('income.redesign.paydayTomorrow')
                          : t('income.redesign.paydayIn', { days: String(upcomingPayday.daysUntil) })}
                      {billsBeforePayday > 0
                        ? ` · ${t('income.redesign.paydayBillsWarning', { count: String(billsBeforePayday) })}`
                        : ''}
                    </RedesignText>
                  </View>
                </View>
              ) : null}

              {/* Monthly Inflow Summary */}
              <Card testID="income-redesign-summary">
                <View style={{ padding: sp.lg, gap: sp.sm }}>
                  <RedesignText variant="label" tone="textSecondary">
                    {t('income.redesign.receivedIn', { month: MONTH_LONG[Number(month.slice(5, 7))] ?? month })}
                  </RedesignText>
                  <RedesignAmount
                    testID="income-redesign-received"
                    text={formatNaira(summary.received)}
                    sign="+"
                    sizeVariant="display"
                  />
                  <RedesignText tone="textSecondary">
                    {t('income.redesign.stillExpected', { amount: formatNaira(stillExpected) })}
                  </RedesignText>
                  <RedesignProgress
                    testID="income-redesign-progress"
                    value={Number(summary.received)}
                    max={Number(summary.expected > 0n ? summary.expected : 1n)}
                  />
                </View>
              </Card>

              {/* Income Steadiness Score Card */}
              {summary.steadiness !== null ? (
                <View
                  testID="income-steadiness-score"
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: shape['radius-lg'],
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: sp.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.md,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: theme.primarySoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RedesignText variant="label" style={{ color: theme.primary }}>
                      {`${summary.steadiness}%`}
                    </RedesignText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <RedesignText variant="label">{t('income.steadinessLabel')}</RedesignText>
                    <RedesignText testID="income-steadiness-info" variant="caption" tone="textSecondary">
                      {t('income.steadinessHint')}
                    </RedesignText>
                  </View>
                </View>
              ) : null}

              {/* 6-Month History / Chart / Table */}
              <Card testID="income-redesign-history">
                <View style={{ padding: sp.lg, gap: sp.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <RedesignText variant="label">{t('income.redesign.last6')}</RedesignText>
                    <RedesignText variant="helper" tone="textSecondary">
                      {t('income.redesign.average', { amount: formatNaira(average) })}
                    </RedesignText>
                  </View>
                  {tableMode ? (
                    <SixMonthTable points={chartPoints} />
                  ) : (
                    <SixMonthChart points={chartPoints} currentMonth={month} />
                  )}
                  <Pressable
                    testID="income-redesign-view-table"
                    accessibilityRole="button"
                    onPress={() => router.setParams({ table: tableMode ? undefined : '1' })}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <RedesignText variant="label" tone="primary" style={{ textDecorationLine: 'underline' }}>
                      {tableMode ? t('income.redesign.viewAsChart') : t('income.redesign.viewAsTable')}
                    </RedesignText>
                  </Pressable>
                </View>
              </Card>

              {/* Stream Grouping by Income Type */}
              <View style={{ gap: sp.md }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('income.redesign.sources')}
                </RedesignText>
                {groupedStreams.map(({ kind, rows }) => (
                  <View key={kind} style={{ gap: sp.xs }} testID={`income-group-${kind}`}>
                    <RedesignText variant="caption" tone="textSecondary" style={{ fontWeight: '600' }}>
                      {t(`income.kind.${kind}`)}
                    </RedesignText>
                    <Card testID="income-redesign-sources">
                      {rows.map((row) => {
                        const dots = snapshot ? streamPaymentDots(row.stream, snapshot, month) : [];
                        const route = snapshot ? routingSummary(row.stream, snapshot) : null;
                        const takeHome = takeHomeMinor(row.stream);
                        return (
                          <View
                            key={row.stream.id}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: theme.border,
                              paddingVertical: sp.sm,
                            }}
                          >
                            <RedesignListRow
                              testID={`income-row-${row.stream.id}`}
                              title={row.stream.name}
                              subtitle={sourceSubtitle(row, month)}
                              trailing={`+${formatNaira(row.expected)}`}
                              showChevron
                              onPress={() => router.setParams({ stream: row.stream.id })}
                            />
                            {/* Metadata & Actions */}
                            <View
                              style={{
                                paddingHorizontal: sp.lg,
                                paddingBottom: sp.xs,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <View style={{ gap: 2, flex: 1 }}>
                                {!row.stream.countInBudget ? (
                                  <RedesignText variant="caption" tone="textSecondary">
                                    {t('income.offBudget')}
                                  </RedesignText>
                                ) : null}
                                {row.stream.recordMode === 'gross' && row.stream.grossMinor ? (
                                  <RedesignText variant="caption" tone="textSecondary">
                                    {`${t('income.grossLabel')} ${formatNaira(BigInt(row.stream.grossMinor))} · ${t('income.takeHomeLabel')} ${formatNaira(takeHome)}`}
                                  </RedesignText>
                                ) : null}
                                {route ? (
                                  <RedesignText variant="caption" tone="textSecondary">
                                    {`→ ${route}`}
                                  </RedesignText>
                                ) : null}
                                {/* 6-Dot Payment Reliability Timeline */}
                                <View
                                  testID={`income-dots-${row.stream.id}`}
                                  accessibilityRole="text"
                                  accessibilityLabel={dots.map((d) => t(`income.dot.${d}`)).join(', ')}
                                  style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}
                                >
                                  {dots.map((d, i) => (
                                    <View
                                      key={`dot-${row.stream.id}-${i}`}
                                      testID={`income-dot-${row.stream.id}-${i}`}
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: dotColor(d),
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>

                              {/* Mark Received Action */}
                              {row.received < row.expected ? (
                                <Pressable
                                  testID={`income-record-${row.stream.id}`}
                                  onPress={() =>
                                    setRecordStream({
                                      stream: row.stream,
                                      expected: row.expected,
                                      received: row.received,
                                    })
                                  }
                                  style={{
                                    backgroundColor: theme.primarySoft,
                                    paddingHorizontal: sp.md,
                                    paddingVertical: sp.xs,
                                    borderRadius: shape['radius-pill'],
                                  }}
                                >
                                  <RedesignText variant="caption" style={{ color: theme.primary, fontWeight: '600' }}>
                                    {t('income.markReceived')}
                                  </RedesignText>
                                </Pressable>
                              ) : row.received > row.expected ? (
                                <RedesignText variant="caption" tone="textSecondary">
                                  {`${t('income.aboveExpected')} ${formatNaira(row.received - row.expected)}`}
                                </RedesignText>
                              ) : (
                                <RedesignText variant="caption" tone="textSecondary">
                                  {t('income.receivedOnTime')}
                                </RedesignText>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </Card>
                  </View>
                ))}
              </View>

              {/* Unmatched Inflow Inbox */}
              {unmatchedList.length > 0 ? (
                <View style={{ gap: sp.xs }}>
                  <RedesignText variant="label" tone="textSecondary">
                    {t('income.unmatchedTitle')}
                  </RedesignText>
                  <Card testID="income-unmatched-inbox">
                    <View style={{ padding: sp.md, gap: sp.sm }}>
                      <RedesignText variant="caption" tone="textSecondary">
                        {t('income.unmatchedHint')}
                      </RedesignText>
                      {unmatchedList.map((e) => (
                        <View
                          key={e.id}
                          style={{
                            borderTopWidth: 1,
                            borderTopColor: theme.border,
                            paddingTop: sp.sm,
                            gap: sp.xs,
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <RedesignText variant="label">{e.date}</RedesignText>
                            <RedesignText variant="label" style={{ color: '#10b981' }}>
                              {`+${formatNaira(eventIncomeAmount(snapshot!, e.id))}`}
                            </RedesignText>
                          </View>
                          <View style={{ flexDirection: 'row', gap: sp.xs, flexWrap: 'wrap' }}>
                            <Pressable
                              testID={`income-link-${e.id}`}
                              onPress={() => setLinkEventId(e.id)}
                              style={{
                                backgroundColor: theme.surfaceMuted,
                                paddingHorizontal: sp.sm,
                                paddingVertical: 2,
                                borderRadius: shape['radius-sm'],
                              }}
                            >
                              <RedesignText variant="caption">{t('income.linkToStream')}</RedesignText>
                            </Pressable>
                            <Pressable
                              testID={`income-new-stream-${e.id}`}
                              onPress={() => router.setParams({ stream: 'new' })}
                              style={{
                                backgroundColor: theme.surfaceMuted,
                                paddingHorizontal: sp.sm,
                                paddingVertical: 2,
                                borderRadius: shape['radius-sm'],
                              }}
                            >
                              <RedesignText variant="caption">{t('income.makeNewStream')}</RedesignText>
                            </Pressable>
                            <Pressable
                              testID={`income-oneoff-${e.id}`}
                              onPress={() => void repo.markIncomeOneOff(e.id)}
                              style={{ paddingHorizontal: sp.sm, paddingVertical: 2 }}
                            >
                              <RedesignText variant="caption" tone="textSecondary">
                                {t('income.markOneOff')}
                              </RedesignText>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>
              ) : null}

              {/* Annual Tax Class Summary Table */}
              {taxRows.length > 0 ? (
                <View style={{ gap: sp.xs }}>
                  <RedesignText variant="label" tone="textSecondary">
                    {t('income.taxTitle')}
                  </RedesignText>
                  <Card testID="income-tax-table">
                    <View style={{ padding: sp.md, gap: sp.sm }}>
                      {taxRows.map((r) => (
                        <View
                          key={r.label}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <RedesignText>{r.label}</RedesignText>
                          <RedesignText style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>
                            {formatNaira(r.gross)}
                          </RedesignText>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        {/* Mark Received Sheet (PU-26 / Inflow Split Confirmation) */}
        {recordStream && snapshot ? (
          <MarkReceivedSheet
            stream={recordStream.stream}
            snapshot={snapshot}
            month={month}
            expected={recordStream.expected}
            received={recordStream.received}
            onClose={() => setRecordStream(null)}
            onConfirm={handleRecordConfirm}
          />
        ) : null}

        {/* Link Unmatched Event Sheet */}
        {linkEventId && snapshot && streamOptions.length > 0 ? (
          <RedesignSheet
            testID="income-link-sheet"
            visible
            title={t('income.linkToStream')}
            onClose={() => setLinkEventId(null)}
          >
            <View style={{ padding: sp.lg, gap: sp.md }}>
              <RedesignText tone="textSecondary">{t('income.pickStream')}</RedesignText>
              {streamOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    void repo.linkEventToStream(linkEventId, opt.value);
                    setLinkEventId(null);
                    toast.show(t('income.markedReceived'));
                  }}
                  style={{
                    padding: sp.md,
                    borderRadius: shape['radius-md'],
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <RedesignText variant="label">{opt.label}</RedesignText>
                </Pressable>
              ))}
            </View>
          </RedesignSheet>
        ) : null}

        {/* Add / Edit Stream Sheet */}
        {(addOpen || editStream) && snapshot ? (
          <AddIncomeSheet
            snapshot={snapshot}
            existing={editStream}
            onClose={() => router.setParams({ stream: undefined })}
            onSave={async (data) => {
              if (editStream) {
                await repo.updateIncomeStream({ ...data, id: editStream.id });
                toast.show(t('income.streamSaved'));
              } else {
                await repo.addIncomeStream(data);
                toast.show(t('income.redesign.incomeSaved'));
              }
              router.setParams({ stream: undefined });
            }}
          />
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

function SixMonthChart({ points, currentMonth }: { points: TwelveMonthPoint[]; currentMonth: string }) {
  const max = points.reduce((m, p) => (p.received > m ? p.received : m), 0n);
  const maxN = Number(max > 0n ? max : 1n);
  return (
    <View testID="income-redesign-chart" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: sp.xs, height: 120 }}>
      {points.map((p) => {
        const h = Math.max(8, Math.round((Number(p.received) / maxN) * 100));
        const active = p.month === currentMonth;
        return (
          <View key={p.month} style={{ flex: 1, alignItems: 'center', gap: sp.xs }}>
            <View
              style={{
                width: '70%',
                height: h,
                borderTopLeftRadius: shape['radius-sm'],
                borderTopRightRadius: shape['radius-sm'],
                backgroundColor: active ? theme.primary : theme.primarySoft,
              }}
            />
            <RedesignText variant="caption" tone="textSecondary">
              {p.label}
            </RedesignText>
          </View>
        );
      })}
    </View>
  );
}

function SixMonthTable({ points }: { points: TwelveMonthPoint[] }) {
  return (
    <View testID="income-redesign-table" style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <RedesignText variant="caption" tone="textSecondary">
          {t('income.redesign.tableMonth')}
        </RedesignText>
        <RedesignText variant="caption" tone="textSecondary">
          {t('income.redesign.tableReceived')}
        </RedesignText>
      </View>
      {[...points].reverse().map((p) => (
        <View key={p.month} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <RedesignText>{p.label}</RedesignText>
          <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{formatNaira(p.received)}</RedesignText>
        </View>
      ))}
    </View>
  );
}

function AddIncomeSheet({
  snapshot,
  existing,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  existing?: IncomeStream | null;
  onClose: () => void;
  onSave: (data: Omit<IncomeStream, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<IncomeStreamKind>(existing?.kind ?? 'regular');
  const [amountText, setAmountText] = useState(existing ? toInputText(BigInt(existing.expectedMinor)) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? snapshot.accounts[0]?.id ?? '');
  const [onDay, setOnDay] = useState(
    String(existing?.rule.on && existing.rule.on !== 0 ? existing.rule.on : Number(today().slice(8, 10))),
  );
  const [recordMode, setRecordMode] = useState<IncomeRecordMode>(existing?.recordMode ?? 'takeHome');
  const [grossText, setGrossText] = useState(existing?.grossMinor ? toInputText(BigInt(existing.grossMinor)) : '');
  const [taxClass, setTaxClass] = useState(existing?.taxClass ?? 'PAYE');
  const [countInBudget, setCountInBudget] = useState(existing?.countInBudget ?? (kind !== 'passive'));
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('income.redesign.chooseOption');
  const nextPreview = (() => {
    const day = Math.min(Math.max(1, Number(onDay) || 1), 28);
    const [y, m] = today().split('-').map(Number) as [number, number];
    let iso = `${today().slice(0, 7)}-${String(day).padStart(2, '0')}`;
    if (iso < today()) {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      iso = `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return shortDayMonth(iso);
  })();

  const handleApplyDeductionPreset = (type: 'pension' | 'nhf') => {
    const parsedGross = parseAmount(grossText);
    if (!parsedGross.ok || parsedGross.minor <= 0n) return;
    if (type === 'pension') {
      // 8% pension
      const pensionMinor = (parsedGross.minor * 8n) / 100n;
      const net = parsedGross.minor - pensionMinor;
      setAmountText(toInputText(net));
    } else {
      // 2.5% NHF
      const nhfMinor = (parsedGross.minor * 25n) / 1000n;
      const net = parsedGross.minor - nhfMinor;
      setAmountText(toInputText(net));
    }
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('income.redesign.sourcePlaceholder'));
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('income.redesign.amountHint'));
      return;
    }
    if (!accountId) {
      setError(t('income.redesign.chooseOption'));
      return;
    }
    const categoryId =
      existing?.categoryId ?? snapshot.categories.find((c) => c.kind === 'income')?.id ?? '';
    if (!categoryId) {
      setError(t('income.redesign.chooseOption'));
      return;
    }
    setSaving(true);
    try {
      const day = Math.min(Math.max(1, Number(onDay) || 1), 31);
      const deductions: IncomeDeduction[] = [];
      let parsedGrossMinor: string | undefined;
      if (recordMode === 'gross') {
        const parsedGross = parseAmount(grossText);
        if (parsedGross.ok && parsedGross.minor > 0n) {
          parsedGrossMinor = parsedGross.minor.toString();
          if (parsedGross.minor > parsed.minor) {
            deductions.push({
              kind: 'paye',
              amountMinor: (parsedGross.minor - parsed.minor).toString(),
            });
          }
        }
      }
      await onSave({
        name: name.trim(),
        kind,
        expectedMinor: parsed.minor.toString(),
        accountId,
        categoryId,
        rule: { every: 'month', on: day },
        countInBudget,
        source: existing?.source,
        taxClass,
        amountKind: existing?.amountKind ?? 'exact',
        rangeMinMinor: existing?.rangeMinMinor,
        rangeMaxMinor: existing?.rangeMaxMinor,
        recordMode,
        grossMinor: parsedGrossMinor,
        deductions: deductions.length > 0 ? deductions : existing?.deductions,
        routing: existing?.routing,
        reminder: existing?.reminder,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RedesignSheet
      testID="income-redesign-add-sheet"
      visible
      title={t('income.redesign.addIncome')}
      onClose={onClose}
      dirty={!!name || !!amountText}
      footer={
        <RedesignButton
          testID="income-redesign-save"
          label={t('income.redesign.addIncome')}
          fullWidth
          disabled={saving}
          onPress={() => void save()}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="income-redesign-name"
          label={t('income.redesign.source')}
          value={name}
          onChangeText={setName}
          placeholder={t('income.redesign.sourcePlaceholder')}
        />

        {/* Kind Segmented Control */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.kind')}</RedesignText>
          <RedesignSegmented
            testID="income-redesign-kind"
            value={kind}
            onChange={(k) => setKind(k as IncomeStreamKind)}
            options={[
              { key: 'regular', label: t('income.kind.regular') },
              { key: 'variable', label: t('income.kind.variable') },
              { key: 'irregular', label: t('income.kind.irregular') },
              { key: 'passive', label: t('income.kind.passive') },
            ]}
          />
        </View>

        {/* Record Mode: Take Home vs Gross */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.recordAs')}</RedesignText>
          <RedesignSegmented
            testID="income-redesign-record-mode"
            value={recordMode}
            onChange={(m) => setRecordMode(m as IncomeRecordMode)}
            options={[
              { key: 'takeHome', label: t('income.recordMode.takeHome') },
              { key: 'gross', label: t('income.recordMode.gross') },
            ]}
          />
        </View>

        {recordMode === 'gross' ? (
          <View style={{ gap: sp.sm }}>
            <RedesignField
              testID="income-redesign-gross"
              label={t('income.grossAmount')}
              value={grossText}
              onChangeText={setGrossText}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            {/* Quick Deduction Presets */}
            <View style={{ flexDirection: 'row', gap: sp.xs }}>
              <RedesignChip
                label={t('income.redesign.pensionChip')}
                onPress={() => handleApplyDeductionPreset('pension')}
              />
              <RedesignChip
                label={t('income.redesign.nhfChip')}
                onPress={() => handleApplyDeductionPreset('nhf')}
              />
            </View>
          </View>
        ) : null}

        <RedesignField
          testID="income-redesign-amount"
          label={recordMode === 'gross' ? t('income.takeHomeLabel') : t('plan.amount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('income.redesign.amountHint')}
        </RedesignText>

        {/* Tax Classification */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.taxClass')}</RedesignText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.xs }}>
            {TAX_CLASS_PRESETS.map((tc) => (
              <RedesignChip
                key={tc}
                testID={`income-tax-class-${tc}`}
                label={tc}
                selected={taxClass === tc}
                onPress={() => setTaxClass(tc)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.redesign.repeats')}</RedesignText>
          <View
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              justifyContent: 'center',
            }}
          >
            <RedesignText>{t('income.redesign.repeatsMonthly')}</RedesignText>
          </View>
        </View>

        <RedesignField
          testID="income-redesign-day"
          label={t('income.redesign.nextExpected')}
          value={onDay}
          onChangeText={setOnDay}
          keyboardType="number-pad"
          placeholder={t('income.redesign.pickDate')}
        />
        <RedesignText variant="helper" tone="textSecondary">
          {nextPreview}
        </RedesignText>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('income.redesign.into')}</RedesignText>
          <Pressable
            testID="income-redesign-account"
            accessibilityRole="button"
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
            ? snapshot.accounts.map((a) => (
                <Pressable
                  key={a.id}
                  testID={`income-redesign-account-${a.id}`}
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

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <RedesignText>{t('income.countInBudget')}</RedesignText>
          <Switch
            testID="income-redesign-count-budget"
            value={countInBudget}
            onValueChange={setCountInBudget}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

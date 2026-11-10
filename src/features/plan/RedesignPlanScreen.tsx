import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Recurring, RecurringKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignEmpty,
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
import { useToast } from '@/design/components';
import { ledgerBalance, monthOf } from '@/ledger';
import { t } from '@/i18n';
import { formatNaira, parseAmount, toInputText } from '@/money';
import { today } from '@/features/transactions/helpers';

import { billMatchCandidates } from './match';
import {
  allScheduleRows,
  calendarDays,
  dayListTitle,
  findRecurringSuggestions,
  planRowsForMonth,
  rowsByDate,
  scheduleFrequency,
  type BillRow,
  type FindRecurringSuggestion,
} from './recurrence';

const sp = tokens.space;
const shape = tokens.shape;
const amber = '#b45309';
const amberSoft = '#fef3c7';

type Segment = 'upcoming' | 'all' | 'calendar';
type AddKind = 'out' | 'in' | 'transfer';
type GroupBy = 'status' | 'category' | 'account';

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

const NIGERIAN_TEMPLATES = [
  { name: 'EKEDC', approximate: true, amountMinor: '2500000', day: 15 },
  { name: 'IKEDC', approximate: true, amountMinor: '2500000', day: 15 },
  { name: 'MTN Broadband', approximate: false, amountMinor: '2000000', day: 1 },
  { name: 'Airtel 5G', approximate: false, amountMinor: '2000000', day: 1 },
  { name: 'Starlink', approximate: false, amountMinor: '3800000', day: 22 },
  { name: 'DSTV', approximate: false, amountMinor: '1450000', day: 5 },
  { name: 'Showmax', approximate: false, amountMinor: '320000', day: 10 },
  { name: 'Estate Dues', approximate: false, amountMinor: '1500000', day: 1 },
] as const;

/** "Sunday, 1 November" (Figma Bills rows). */
function longWeekdayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function monthEndLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return t('plan.redesign.monthEnd', { day: String(last), month: MONTH_LONG[m] ?? String(m) });
}

function ordinalDay(ruleOn: number): string {
  if (ruleOn === 0 || ruleOn === 31) return 'last';
  return String(ruleOn);
}

function laterSubtitle(row: BillRow): string {
  const on = row.recurring.rule.on;
  if (row.recurring.rule.every !== 'month') return scheduleFrequency(row.recurring);
  if (on === 0 || on === 31) return t('plan.redesign.everyMonthOn', { day: 'last' });
  if (row.recurring.approximate) return t('plan.redesign.everyMonthAround', { day: ordinalDay(on) });
  return t('plan.redesign.everyMonthOn', { day: ordinalDay(on) });
}

function soonSubtitle(row: BillRow, snapshot: Snapshot): string {
  const account = snapshot.accounts.find((a) => a.id === row.recurring.accountId)?.name;
  const date = longWeekdayDate(row.dueDate);
  return account ? t('plan.redesign.fromAccount', { date, account }) : date;
}

function amountTrailing(row: BillRow): string {
  const minor = BigInt(row.recurring.amountMinor);
  if (row.recurring.kind === 'income') return formatNaira(minor, { signed: true });
  return `${'\u2212'}${formatNaira(minor)}`;
}

function ussdCodeForAccount(accountName: string): string {
  const name = accountName.toLowerCase();
  if (name.includes('gtbank') || name.includes('gtb') || name.includes('guaranty')) return '*737#';
  if (name.includes('zenith')) return '*966#';
  if (name.includes('access')) return '*901#';
  if (name.includes('uba')) return '*919#';
  if (name.includes('first') || name.includes('fbn')) return '*894#';
  if (name.includes('fidelity')) return '*770#';
  if (name.includes('stanbic')) return '*909#';
  if (name.includes('sterling')) return '*822#';
  if (name.includes('fcmb')) return '*329#';
  if (name.includes('wema') || name.includes('alat')) return '*945#';
  return '*737#';
}

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

function SectionLabel({ label }: { label: string }) {
  return (
    <RedesignText variant="label" tone="textSecondary" style={{ marginBottom: sp.xs }}>
      {label}
    </RedesignText>
  );
}

type BufferAlert = {
  accountName: string;
  balance: bigint;
  billName: string;
  billAmount: bigint;
  daysUntil: number;
  shortfall: bigint;
};

/** Figma Mobile: Phone / Bills and recurring (4:1667) + empty / add / found / detail. */
export function RedesignPlanScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{
    tab?: string;
    schedule?: string;
    kind?: string;
    find?: string;
    bill?: string;
    day?: string;
  }>();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const month = monthOf(today());
  const dueSoonDays = snapshot?.settings.dueSoonDays ?? 7;

  const segment: Segment =
    params.tab === 'all' ? 'all' : params.tab === 'calendar' ? 'calendar' : 'upcoming';
  const setSegment = (key: string) => router.setParams({ tab: key === 'upcoming' ? undefined : key });

  const [groupBy, setGroupBy] = useState<GroupBy>('status');

  const findOpen = params.find === '1';
  const addOpen = params.schedule === 'new';
  const detailId = typeof params.bill === 'string' ? params.bill : null;

  const rows = useMemo(
    () => (snapshot ? planRowsForMonth(snapshot, month, today(), dueSoonDays) : []),
    [snapshot, month, dueSoonDays],
  );
  const unpaidBills = useMemo(() => rows.filter((r) => r.group !== 'paid' && r.recurring.kind !== 'income'), [rows]);
  const paidBills = useMemo(() => rows.filter((r) => r.group === 'paid' && r.recurring.kind !== 'income'), [rows]);
  const stillToPay = useMemo(() => unpaidBills.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n), [unpaidBills]);
  const paidTotal = useMemo(() => paidBills.reduce((s, r) => s + BigInt(r.recurring.amountMinor), 0n), [paidBills]);
  const monthBillTotal = stillToPay + paidTotal;
  const soon = useMemo(() => rows.filter((r) => (r.group === 'dueSoon' || r.group === 'overdue') && r.recurring.kind !== 'income'), [rows]);
  const later = useMemo(() => rows.filter((r) => r.group === 'later' && r.recurring.kind !== 'income'), [rows]);
  const moneyIn = useMemo(() => rows.filter((r) => r.recurring.kind === 'income' && r.group !== 'paid'), [rows]);
  const suggestions = useMemo(() => (snapshot ? findRecurringSuggestions(snapshot, month) : []), [snapshot, month]);
  const schedules = useMemo(
    () => (snapshot ? allScheduleRows(snapshot, today(), '', false) : []),
    [snapshot],
  );
  const byDate = useMemo(() => rowsByDate(rows), [rows]);
  const hasAnyBills = (snapshot?.recurring.filter((r) => !r.cancelled && r.kind !== 'income').length ?? 0) > 0;

  // Safe-to-spend calculation: Liquid cash in bank/cash accounts - still to pay
  const liquidCash = useMemo(() => {
    if (!snapshot) return 0n;
    let total = 0n;
    for (const acc of snapshot.accounts) {
      if (acc.type === 'bank' || acc.type === 'cash' || acc.type === 'savings' || acc.type === 'wallet') {
        const bal = ledgerBalance(acc.id, snapshot.events);
        if (bal > 0n) total += bal;
      }
    }
    return total;
  }, [snapshot]);
  const safeToSpend = liquidCash > stillToPay ? liquidCash - stillToPay : 0n;

  // Account Liquidity & Buffer Warning ("Will it Bounce?")
  const bufferAlerts = useMemo<BufferAlert[]>(() => {
    if (!snapshot) return [];
    const alerts: BufferAlert[] = [];
    const accountBalances = new Map<string, bigint>();
    for (const acc of snapshot.accounts) {
      accountBalances.set(acc.id, ledgerBalance(acc.id, snapshot.events));
    }
    for (const row of soon) {
      const acc = snapshot.accounts.find((a) => a.id === row.recurring.accountId);
      if (!acc) continue;
      const balance = accountBalances.get(acc.id) ?? 0n;
      const billAmount = BigInt(row.recurring.amountMinor);
      if (balance < billAmount) {
        const shortfall = billAmount - balance;
        const [ty, tm, td] = today().split('-').map(Number) as [number, number, number];
        const [dy, dm, dd] = row.dueDate.split('-').map(Number) as [number, number, number];
        const d1 = Date.UTC(ty, tm - 1, td);
        const d2 = Date.UTC(dy, dm - 1, dd);
        const daysUntil = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
        alerts.push({
          accountName: acc.name,
          balance,
          billName: row.recurring.name,
          billAmount,
          daysUntil,
          shortfall,
        });
      }
    }
    return alerts;
  }, [snapshot, soon]);

  // Subscription / Bill Price Hike Detection
  const inflationAlerts = useMemo(() => {
    if (!snapshot) return [];
    const alerts: { name: string; diff: bigint; date: string }[] = [];
    for (const r of snapshot.recurring) {
      if (r.cancelled || r.kind === 'income') continue;
      const current = BigInt(r.amountMinor);
      const pastOccs = snapshot.occurrences
        .filter((o) => o.recurringId === r.id && o.status === 'paid')
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
      const firstPast = pastOccs[0];
      if (firstPast) {
        const prev = BigInt(firstPast.amountMinor);
        if (current > prev) {
          alerts.push({
            name: r.name,
            diff: current - prev,
            date: firstPast.dueDate.slice(0, 7),
          });
        }
      }
    }
    return alerts;
  }, [snapshot]);

  const detailRecurring = useMemo(() => {
    if (!snapshot || !detailId) return null;
    return snapshot.recurring.find((r) => r.id === detailId) ?? null;
  }, [snapshot, detailId]);

  const detailRow = useMemo(() => {
    if (!detailRecurring) return null;
    return rows.find((r) => r.recurring.id === detailRecurring.id && r.group !== 'paid') ?? null;
  }, [detailRecurring, rows]);

  const openAdd = (kind: RecurringKind = 'bill') => {
    if (kind === 'income') {
      router.push('/income?stream=new');
      return;
    }
    router.setParams({ schedule: 'new', kind });
  };

  const handleQuickPay = async (row: BillRow) => {
    if (!snapshot) return;
    const due = row.dueDate;
    const result = await repo.markBillPaid(row.recurring.id, due, {
      accountId: row.recurring.accountId,
      categoryId: row.recurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id,
      amount: BigInt(row.recurring.amountMinor),
      date: due < today() ? today() : due,
      payeeId: row.recurring.payeeId,
    });
    if (result.ok) {
      toast.show(t('plan.redesign.markedPaid'));
    }
  };

  const handleQuickSnooze = (_row: BillRow) => {
    toast.show(t('plan.redesign.snoozed'));
  };

  const handleQuickSkip = async (row: BillRow) => {
    const result = await repo.skipBillOccurrence(row.recurring.id, row.dueDate);
    if (result.ok) {
      toast.show(t('plan.redesign.skipped'));
    }
  };

  const handleConfirmMatch = async (row: BillRow, eventId: string) => {
    const result = await repo.matchBillToEvent(row.recurring.id, row.dueDate, eventId);
    if (result.ok) {
      toast.show(t('plan.redesign.markedPaid'));
    }
  };

  // Grouped rows for category / account grouping modes
  const groupedSections = useMemo(() => {
    if (!snapshot || groupBy === 'status') return [];
    const map = new Map<string, BillRow[]>();
    for (const r of unpaidBills) {
      let key = '';
      if (groupBy === 'category') {
        key = snapshot.categories.find((c) => c.id === r.recurring.categoryId)?.name ?? t('redesign.accounts.group.other');
      } else {
        key = snapshot.accounts.find((a) => a.id === r.recurring.accountId)?.name ?? t('redesign.accounts.group.other');
      }
      const existing = map.get(key) ?? [];
      existing.push(r);
      map.set(key, existing);
    }
    return Array.from(map.entries()).map(([label, sectionRows]) => ({ label, sectionRows }));
  }, [snapshot, groupBy, unpaidBills]);

  if (findOpen) {
    return (
      <FoundRepeatsView
        suggestions={suggestions}
        snapshot={snapshot}
        onBack={() => router.setParams({ find: undefined })}
        onIgnore={(id) => {
          void id;
        }}
        onAdd={async (s) => {
          if (!snapshot) return;
          const accountId = snapshot.accounts[0]?.id;
          const categoryId = snapshot.categories.find((c) => c.kind === 'expense')?.id;
          if (!accountId || !categoryId) return;
          await repo.addRecurring({
            kind: 'bill',
            name: s.name,
            amountMinor: s.averageMinor.toString(),
            accountId,
            categoryId,
            payeeId: s.payeeId,
            rule: { every: 'month', on: s.dayOfMonth },
            startDate: today(),
            approximate: true,
            reminderDays: 2,
            hideAmountOnLock: true,
          });
          toast.show(t('plan.redesign.billsAdded', { count: '1' }));
        }}
      />
    );
  }

  if (detailRecurring && snapshot) {
    return (
      <BillDetailView
        snapshot={snapshot}
        recurring={detailRecurring}
        row={detailRow}
        onBack={() => router.setParams({ bill: undefined })}
        onEdit={() => router.setParams({ bill: undefined, schedule: detailRecurring.id })}
        onMarkPaid={async (customAmount) => {
          const due = detailRow?.dueDate ?? today();
          const amt = customAmount ?? BigInt(detailRecurring.amountMinor);
          const result = await repo.markBillPaid(detailRecurring.id, due, {
            accountId: detailRecurring.accountId,
            categoryId: detailRecurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id,
            amount: amt,
            date: due < today() ? today() : due,
            payeeId: detailRecurring.payeeId,
          });
          if (result.ok) {
            toast.show(t('plan.redesign.markedPaid'));
            router.setParams({ bill: undefined });
          }
        }}
      />
    );
  }

  const commitmentPercent = monthBillTotal > 0n ? Math.round((Number(paidTotal) / Number(monthBillTotal)) * 100) : 0;
  const monthName = MONTH_LONG[Number(month.slice(5, 7))] ?? month;

  return (
    <RedesignShell>
      <SafeAreaView testID="redesign-plan" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={t('plan.title')}
          onBack={() => router.push('/more')}
          trailing={
            <Pressable
              testID="plan-redesign-add"
              accessibilityRole="button"
              accessibilityLabel={t('plan.redesign.addABill')}
              onPress={() => openAdd('bill')}
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
          <RedesignSegmented
            testID="plan-redesign-segment"
            value={segment}
            onChange={setSegment}
            options={[
              { key: 'upcoming', label: t('plan.redesign.tabUpcoming') },
              { key: 'all', label: t('plan.redesign.tabAll') },
              { key: 'calendar', label: t('plan.redesign.tabCalendar') },
            ]}
          />

          {!hasAnyBills && segment === 'upcoming' ? (
            <Card testID="plan-redesign-empty">
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
                  <RedesignIcon name="calendar" size={28} color={theme.text} />
                </View>
                <RedesignText variant="headline" accessibilityRole="header">
                  {t('plan.redesign.emptyTitle')}
                </RedesignText>
                <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                  {t('plan.redesign.emptyBody')}
                </RedesignText>
                <RedesignButton
                  testID="plan-redesign-empty-add"
                  label={t('plan.redesign.addABill')}
                  onPress={() => openAdd('bill')}
                />
              </View>
            </Card>
          ) : null}

          {hasAnyBills && segment === 'upcoming' ? (
            <>
              {bufferAlerts.length > 0 && bufferAlerts[0] ? (
                <View
                  testID="plan-buffer-alert"
                  style={{
                    backgroundColor: amberSoft,
                    borderColor: amber,
                    borderWidth: 1,
                    borderRadius: shape['radius-lg'],
                    padding: sp.md,
                    gap: sp.xs,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                    <RedesignIcon name="alert" size={16} color={amber} />
                    <RedesignText variant="label" style={{ color: amber }}>
                      {t('plan.redesign.bufferAlertTitle')}
                    </RedesignText>
                  </View>
                  <RedesignText tone="text">
                    {t('plan.redesign.bufferAlertBody', {
                      account: bufferAlerts[0].accountName,
                      balance: formatNaira(bufferAlerts[0].balance),
                      name: bufferAlerts[0].billName,
                      amount: formatNaira(bufferAlerts[0].billAmount),
                      days: String(bufferAlerts[0].daysUntil),
                      shortfall: formatNaira(bufferAlerts[0].shortfall),
                    })}
                  </RedesignText>
                </View>
              ) : null}

              {inflationAlerts.length > 0 && inflationAlerts[0] ? (
                <View
                  testID="plan-inflation-alert"
                  style={{
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                    borderWidth: 1,
                    borderRadius: shape['radius-lg'],
                    padding: sp.md,
                    gap: sp.xs,
                  }}
                >
                  <RedesignText variant="caption" tone="textSecondary">
                    {t('plan.redesign.inflationAlert', {
                      name: inflationAlerts[0].name,
                      diff: formatNaira(inflationAlerts[0].diff),
                      date: inflationAlerts[0].date,
                    })}
                  </RedesignText>
                </View>
              ) : null}

              <Card testID="plan-redesign-summary">
                <View style={{ padding: sp.lg, gap: sp.sm }}>
                  <RedesignText variant="label" tone="textSecondary">
                    {t('plan.redesign.stillToPay')}
                  </RedesignText>
                  <RedesignAmount testID="plan-redesign-still-amount" text={formatNaira(stillToPay)} sizeVariant="display" />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <RedesignText>
                      {t('plan.redesign.billsBefore', {
                        count: String(unpaidBills.length),
                        date: monthEndLabel(month),
                      })}
                    </RedesignText>
                    <View
                      testID="plan-safe-to-spend"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: sp.xs,
                        backgroundColor: theme.surfaceMuted,
                        paddingHorizontal: sp.sm,
                        paddingVertical: 2,
                        borderRadius: shape['radius-pill'],
                      }}
                    >
                      <RedesignText variant="caption" tone="textSecondary">
                        {t('plan.redesign.safeToSpend')}:
                      </RedesignText>
                      <RedesignText variant="caption" style={{ fontWeight: '600' }}>
                        {formatNaira(safeToSpend)}
                      </RedesignText>
                    </View>
                  </View>
                  <RedesignProgress
                    testID="plan-redesign-progress"
                    value={Number(paidTotal)}
                    max={Number(monthBillTotal > 0n ? monthBillTotal : 1n)}
                  />
                  <RedesignText testID="plan-progress-label" variant="caption" tone="textSecondary">
                    {t('plan.redesign.progressLabel', {
                      pct: String(commitmentPercent),
                      month: monthName,
                      paid: formatNaira(paidTotal),
                      total: formatNaira(monthBillTotal),
                    })}
                  </RedesignText>
                </View>
              </Card>

              {/* Grouping View Toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }} testID="plan-group-toggle">
                <RedesignChip
                  testID="plan-group-status"
                  label={t('plan.redesign.groupStatus')}
                  selected={groupBy === 'status'}
                  onPress={() => setGroupBy('status')}
                />
                <RedesignChip
                  testID="plan-group-category"
                  label={t('plan.redesign.groupCategory')}
                  selected={groupBy === 'category'}
                  onPress={() => setGroupBy('category')}
                />
                <RedesignChip
                  testID="plan-group-account"
                  label={t('plan.redesign.groupAccount')}
                  selected={groupBy === 'account'}
                  onPress={() => setGroupBy('account')}
                />
              </View>

              {groupBy === 'status' ? (
                <>
                  {soon.length > 0 ? (
                    <View>
                      <SectionLabel label={t('plan.redesign.next7')} />
                      <Card>
                        {soon.map((row) => {
                          const candidates = snapshot ? billMatchCandidates(snapshot, row) : [];
                          return (
                            <View key={`soon-${row.recurring.id}-${row.dueDate}`}>
                              <RedesignListRow
                                testID={`plan-row-${row.recurring.id}`}
                                title={row.recurring.name}
                                subtitle={soonSubtitle(row, snapshot!)}
                                trailing={amountTrailing(row)}
                                showChevron={false}
                                onPress={() => router.setParams({ bill: row.recurring.id })}
                              />
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingHorizontal: sp.lg,
                                  paddingBottom: sp.sm,
                                  gap: sp.sm,
                                }}
                              >
                                {candidates.length > 0 && candidates[0] ? (
                                  <Pressable
                                    testID={`plan-confirm-match-${row.recurring.id}`}
                                    onPress={() => void handleConfirmMatch(row, candidates[0]!.eventId)}
                                    style={{
                                      backgroundColor: theme.primarySoft,
                                      paddingHorizontal: sp.sm,
                                      paddingVertical: 2,
                                      borderRadius: shape['radius-pill'],
                                    }}
                                  >
                                    <RedesignText testID={`plan-match-pill-${row.recurring.id}`} variant="caption" style={{ color: theme.primary }}>
                                      {t('plan.redesign.matchFoundPill', { amount: formatNaira(candidates[0]!.amount) })}
                                    </RedesignText>
                                  </Pressable>
                                ) : null}
                                <View style={{ flex: 1 }} />
                                <Pressable
                                  testID={`plan-quick-pay-${row.recurring.id}`}
                                  onPress={() => void handleQuickPay(row)}
                                  style={{ paddingHorizontal: sp.xs, paddingVertical: 2 }}
                                >
                                  <RedesignText variant="caption" style={{ color: theme.primary, fontWeight: '600' }}>
                                    {t('plan.redesign.quickPay')}
                                  </RedesignText>
                                </Pressable>
                                <Pressable
                                  testID={`plan-quick-snooze-${row.recurring.id}`}
                                  onPress={() => handleQuickSnooze(row)}
                                  style={{ paddingHorizontal: sp.xs, paddingVertical: 2 }}
                                >
                                  <RedesignText variant="caption" tone="textSecondary">
                                    {t('plan.redesign.quickSnooze')}
                                  </RedesignText>
                                </Pressable>
                                <Pressable
                                  testID={`plan-quick-skip-${row.recurring.id}`}
                                  onPress={() => void handleQuickSkip(row)}
                                  style={{ paddingHorizontal: sp.xs, paddingVertical: 2 }}
                                >
                                  <RedesignText variant="caption" tone="textSecondary">
                                    {t('plan.redesign.quickSkip')}
                                  </RedesignText>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </Card>
                    </View>
                  ) : null}

                  {later.length > 0 ? (
                    <View>
                      <SectionLabel label={t('plan.redesign.later')} />
                      <Card>
                        {later.map((row) => (
                          <RedesignListRow
                            key={`later-${row.recurring.id}-${row.dueDate}`}
                            testID={`plan-row-${row.recurring.id}`}
                            title={row.recurring.name}
                            subtitle={laterSubtitle(row)}
                            trailing={amountTrailing(row)}
                            showChevron={false}
                            onPress={() => router.setParams({ bill: row.recurring.id })}
                          />
                        ))}
                      </Card>
                    </View>
                  ) : null}

                  {moneyIn.length > 0 ? (
                    <View>
                      <SectionLabel label={t('plan.redesign.moneyIn')} />
                      <Card>
                        {moneyIn.map((row) => (
                          <RedesignListRow
                            key={`in-${row.recurring.id}-${row.dueDate}`}
                            testID={`plan-row-${row.recurring.id}`}
                            title={row.recurring.name}
                            subtitle={laterSubtitle(row)}
                            trailing={amountTrailing(row)}
                            showChevron={false}
                            onPress={() => router.push(`/income?stream=${row.recurring.id.replace(/^stream:/, '')}`)}
                          />
                        ))}
                      </Card>
                    </View>
                  ) : null}
                </>
              ) : (
                groupedSections.map(({ label, sectionRows }) => (
                  <View key={`grouped-${label}`}>
                    <SectionLabel label={label} />
                    <Card>
                      {sectionRows.map((row) => (
                        <RedesignListRow
                          key={`grp-row-${row.recurring.id}-${row.dueDate}`}
                          testID={`plan-row-${row.recurring.id}`}
                          title={row.recurring.name}
                          subtitle={soonSubtitle(row, snapshot!)}
                          trailing={amountTrailing(row)}
                          showChevron={false}
                          onPress={() => router.setParams({ bill: row.recurring.id })}
                        />
                      ))}
                    </Card>
                  </View>
                ))
              )}

              {suggestions.length > 0 ? (
                <View
                  testID="plan-redesign-suggest"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.md,
                    backgroundColor: theme.surface,
                    borderRadius: shape['radius-lg'],
                    borderWidth: 1,
                    borderColor: theme.border,
                    padding: sp.md,
                  }}
                >
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
                    <RedesignIcon name="repeat" size={20} color={theme.text} />
                  </View>
                  <RedesignText style={{ flex: 1 }}>
                    {t('plan.redesign.suggest', { count: String(suggestions.length) })}
                  </RedesignText>
                  <RedesignButton
                    testID="plan-redesign-review"
                    kind="soft"
                    label={t('plan.redesign.review')}
                    onPress={() => router.setParams({ find: '1' })}
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {segment === 'all' ? (
            <AllSchedulesView
              snapshot={snapshot}
              rows={schedules}
              onOpen={(id) => router.setParams({ bill: id })}
              onEmptyAdd={() => openAdd('bill')}
            />
          ) : null}

          {segment === 'calendar' ? (
            <CalendarView
              month={month}
              byDate={byDate}
              selected={typeof params.day === 'string' ? params.day : today()}
              onSelect={(d) => router.setParams({ day: d })}
            />
          ) : null}
        </ScrollView>

        {addOpen && snapshot ? (
          <AddBillSheet
            snapshot={snapshot}
            initialKind={(params.kind as RecurringKind) ?? 'bill'}
            onClose={() => router.setParams({ schedule: undefined, kind: undefined })}
            onSave={async (data) => {
              await repo.addRecurring(data);
              toast.show(t('plan.redesign.billSaved'));
              router.setParams({ schedule: undefined, kind: undefined });
            }}
            onChooseIncome={() => {
              router.setParams({ schedule: undefined, kind: undefined });
              router.push('/income?stream=new');
            }}
          />
        ) : null}

        {params.schedule && params.schedule !== 'new' && snapshot ? (
          <AddBillSheet
            snapshot={snapshot}
            existing={snapshot.recurring.find((r) => r.id === params.schedule) ?? null}
            initialKind="bill"
            onClose={() => router.setParams({ schedule: undefined })}
            onSave={async (data) => {
              const id = String(params.schedule);
              await repo.updateRecurring({ ...data, id });
              toast.show(t('common.saved'));
              router.setParams({ schedule: undefined });
            }}
          />
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

function AllSchedulesView({
  snapshot,
  rows,
  onOpen,
  onEmptyAdd,
}: {
  snapshot: Snapshot | null;
  rows: ReturnType<typeof allScheduleRows>;
  onOpen: (id: string) => void;
  onEmptyAdd: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const payee = r.recurring.payeeId ? snapshot?.payees.find((p) => p.id === r.recurring.payeeId)?.name : '';
    return `${r.recurring.name} ${payee}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  if (!snapshot) return null;
  if (rows.length === 0) {
    return (
      <RedesignEmpty
        title={t('plan.redesign.noSchedules')}
        body={t('plan.redesign.emptyBody')}
        actionLabel={t('plan.redesign.addABill')}
        onAction={onEmptyAdd}
      />
    );
  }
  return (
    <View style={{ gap: sp.md }}>
      <RedesignField
        testID="plan-redesign-search"
        label={t('plan.redesign.searchSchedules')}
        value={search}
        onChangeText={setSearch}
        placeholder={t('plan.redesign.searchSchedules')}
      />
      <Card>
        {filtered.map((row) => (
          <RedesignListRow
            key={row.recurring.id}
            title={row.recurring.name}
            subtitle={scheduleFrequency(row.recurring)}
            trailing={formatNaira(BigInt(row.recurring.amountMinor))}
            showChevron={false}
            onPress={() => onOpen(row.recurring.id)}
          />
        ))}
      </Card>
    </View>
  );
}

function weekDaysForDate(iso: string): string[] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = (dt.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(dt.getTime() - dayOfWeek * 86400000);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday.getTime() + i * 86400000);
    days.push(cur.toISOString().slice(0, 10));
  }
  return days;
}

function dateDotColor(dayRows: BillRow[]): string {
  if (dayRows.some((r) => r.recurring.kind === 'income')) return '#10b981';
  if (dayRows.some((r) => r.group === 'overdue')) return '#ef4444';
  if (dayRows.some((r) => r.group === 'paid')) return '#94a3b8';
  return theme.primary;
}

function CalendarView({
  month,
  byDate,
  selected,
  onSelect,
}: {
  month: string;
  byDate: Map<string, BillRow[]>;
  selected: string;
  onSelect: (iso: string) => void;
}) {
  const days = calendarDays(month);
  const firstWeekday = new Date(`${days[0]}T12:00:00Z`).getUTCDay();
  const pad = (firstWeekday + 6) % 7;
  const cells: (string | null)[] = [...Array(pad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const selectedRows = byDate.get(selected) ?? [];
  const weekDays = useMemo(() => weekDaysForDate(selected), [selected]);

  return (
    <View testID="plan-redesign-calendar" style={{ gap: sp.md }}>
      {/* 7-Day Week Strip */}
      <Card testID="plan-week-strip">
        <View style={{ flexDirection: 'row', padding: sp.sm }}>
          {weekDays.map((iso) => {
            const has = (byDate.get(iso) ?? []).length > 0;
            const isSelected = iso === selected;
            const dayNum = Number(iso.slice(8, 10));
            const dayRows = byDate.get(iso) ?? [];
            return (
              <Pressable
                key={`week-${iso}`}
                onPress={() => onSelect(iso)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: sp.xs,
                  borderRadius: shape['radius-md'],
                  backgroundColor: isSelected ? theme.primarySoft : 'transparent',
                }}
              >
                <RedesignText variant="caption" tone="textSecondary">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7]}
                </RedesignText>
                <RedesignText variant="label">{dayNum}</RedesignText>
                {has ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: dateDotColor(dayRows),
                      marginTop: 2,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={{ padding: sp.md, gap: sp.sm }}>
          <View style={{ flexDirection: 'row' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <RedesignText key={`${d}-${i}`} variant="caption" tone="textSecondary" style={{ flex: 1, textAlign: 'center' }}>
                {d}
              </RedesignText>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((iso, i) => {
              if (!iso) return <View key={`pad-${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
              const has = (byDate.get(iso) ?? []).length > 0;
              const isSelected = iso === selected;
              const isToday = iso === today();
              const dayRows = byDate.get(iso) ?? [];
              return (
                <Pressable
                  key={iso}
                  testID={`plan-cal-${iso}`}
                  accessibilityRole="button"
                  onPress={() => onSelect(iso)}
                  style={{
                    width: `${100 / 7}%`,
                    height: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: shape['radius-md'],
                    borderWidth: isToday || isSelected ? 1 : 0,
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected ? theme.primarySoft : 'transparent',
                  }}
                >
                  <RedesignText variant="label">{Number(iso.slice(8, 10))}</RedesignText>
                  {has ? (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: dateDotColor(dayRows),
                        marginTop: 2,
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>
      <View>
        <SectionLabel label={dayListTitle(selected)} />
        <Card>
          {selectedRows.length === 0 ? (
            <View style={{ padding: sp.lg }}>
              <RedesignText tone="textSecondary">{t('plan.dayEmpty')}</RedesignText>
            </View>
          ) : (
            selectedRows.map((row) => (
              <RedesignListRow
                key={`day-${row.recurring.id}`}
                title={row.recurring.name}
                trailing={amountTrailing(row)}
                showChevron={false}
              />
            ))
          )}
        </Card>
      </View>
    </View>
  );
}

function FoundRepeatsView({
  suggestions,
  snapshot,
  onBack,
  onAdd,
  onIgnore,
}: {
  suggestions: FindRecurringSuggestion[];
  snapshot: Snapshot | null;
  onBack: () => void;
  onAdd: (s: FindRecurringSuggestion) => Promise<void>;
  onIgnore: (id: string) => void;
}) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const visible = suggestions.filter((s) => !ignored.has(s.id));
  return (
    <RedesignShell>
      <SafeAreaView testID="plan-redesign-found" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar title={t('plan.redesign.foundTitle')} onBack={onBack} />
        <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.md }}>
          <RedesignText tone="textSecondary">{t('plan.redesign.foundBody')}</RedesignText>
          {visible.map((s) => (
            <Card key={s.id}>
              <View style={{ padding: sp.lg, gap: sp.md }}>
                <View style={{ gap: sp.xs }}>
                  <RedesignText variant="label">{s.name}</RedesignText>
                  <RedesignText tone="textSecondary">
                    {t('plan.redesign.foundLine', {
                      amount: formatNaira(s.averageMinor),
                      day: String(s.dayOfMonth),
                      count: String(s.count),
                    })}
                  </RedesignText>
                </View>
                <View style={{ flexDirection: 'row', gap: sp.sm }}>
                  <View style={{ flex: 1 }}>
                    <RedesignButton
                      testID={`plan-found-add-${s.id}`}
                      label={t('plan.redesign.addAsBill')}
                      fullWidth
                      onPress={() => void onAdd(s)}
                      disabled={!snapshot}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <RedesignButton
                      testID={`plan-found-ignore-${s.id}`}
                      kind="secondary"
                      label={t('plan.redesign.ignore')}
                      fullWidth
                      onPress={() => {
                        onIgnore(s.id);
                        setIgnored((prev) => new Set(prev).add(s.id));
                      }}
                    />
                  </View>
                </View>
              </View>
            </Card>
          ))}
          {visible.length === 0 ? <RedesignText tone="textSecondary">{t('plan.findEmpty')}</RedesignText> : null}
        </ScrollView>
      </SafeAreaView>
    </RedesignShell>
  );
}

function BillDetailView({
  snapshot,
  recurring,
  row,
  onBack,
  onEdit,
  onMarkPaid,
}: {
  snapshot: Snapshot;
  recurring: Recurring;
  row: BillRow | null;
  onBack: () => void;
  onEdit: () => void;
  onMarkPaid: (customAmount?: bigint) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [customAmountText, setCustomAmountText] = useState('');
  const toast = useToast();
  const accountObj = snapshot.accounts.find((a) => a.id === recurring.accountId);
  const account = accountObj?.name ?? '—';
  const category = snapshot.categories.find((c) => c.id === recurring.categoryId)?.name ?? '—';
  const reminder =
    recurring.reminderDays === undefined
      ? t('plan.redesign.reminderOff')
      : recurring.reminderDays === 0
        ? t('plan.redesign.reminderDayOf')
        : t('plan.redesign.reminderDays', { days: String(recurring.reminderDays) });
  const past = snapshot.occurrences
    .filter((o) => o.recurringId === recurring.id && o.status === 'paid')
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 6);
  const dueLabel = row ? longWeekdayDate(row.dueDate) : null;
  const ussd = accountObj ? ussdCodeForAccount(accountObj.name) : null;

  const handleCopyPayee = () => {
    const payeeName = recurring.payeeId ? snapshot.payees.find((p) => p.id === recurring.payeeId)?.name : recurring.name;
    void globalThis.navigator?.clipboard?.writeText(payeeName ?? recurring.name);
    toast.show(t('plan.redesign.payeeCopied'));
  };

  const handlePayPress = () => {
    setBusy(true);
    let amount: bigint | undefined;
    if (customAmountText.trim()) {
      const parsed = parseAmount(customAmountText);
      if (parsed.ok && parsed.minor > 0n) {
        amount = parsed.minor;
      }
    }
    void onMarkPaid(amount).finally(() => setBusy(false));
  };

  return (
    <RedesignShell>
      <SafeAreaView testID="plan-redesign-detail" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={recurring.name}
          onBack={onBack}
          trailing={
            <Pressable
              testID="plan-redesign-edit"
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              onPress={onEdit}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="edit" size={22} color={theme.text} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: 140 }}>
          <Card testID="plan-redesign-next">
            <View style={{ padding: sp.lg, gap: sp.sm }}>
              <RedesignText variant="label" tone="textSecondary">
                {t('plan.redesign.nextPayment')}
              </RedesignText>
              <RedesignAmount
                text={formatNaira(BigInt(recurring.amountMinor))}
                sign="−"
                sizeVariant="display"
              />
              {dueLabel ? <RedesignText tone="textSecondary">{t('plan.redesign.dueOn', { date: dueLabel })}</RedesignText> : null}
              {row && (row.group === 'dueSoon' || row.group === 'overdue') ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.xs,
                    backgroundColor: theme.surfaceMuted,
                    borderRadius: shape['radius-pill'],
                    paddingHorizontal: sp.md,
                    paddingVertical: sp.xs,
                  }}
                >
                  <RedesignIcon name="bell" size={14} color={theme.text} />
                  <RedesignText variant="caption">
                    {row.group === 'overdue' ? t('plan.overdue') : t('plan.redesign.dueSoon')}
                  </RedesignText>
                </View>
              ) : null}
            </View>
          </Card>

          {/* Quick Pay / Copy Payee / USSD Actions */}
          <Card>
            <View style={{ padding: sp.md, flexDirection: 'row', gap: sp.sm }}>
              <View style={{ flex: 1 }}>
                <RedesignButton
                  testID="plan-copy-payee"
                  kind="secondary"
                  label={t('plan.redesign.copyPayee')}
                  fullWidth
                  onPress={handleCopyPayee}
                />
              </View>
              {ussd ? (
                <View style={{ flex: 1 }}>
                  <RedesignButton
                    testID="plan-ussd-code"
                    kind="secondary"
                    label={t('plan.redesign.ussdPay', { code: ussd })}
                    fullWidth
                    onPress={() => toast.show(ussd)}
                  />
                </View>
              ) : null}
            </View>
          </Card>

          <Card>
            {(
              [
                [t('plan.redesign.repeatsLabel'), scheduleFrequency(recurring)],
                [t('plan.redesign.payFrom'), account],
                [t('plan.redesign.category'), category],
                [t('plan.redesign.reminder'), reminder],
              ] as const
            ).map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: sp.lg,
                  paddingVertical: sp.md,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  gap: sp.md,
                }}
              >
                <RedesignText tone="textSecondary">{label}</RedesignText>
                <RedesignText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</RedesignText>
              </View>
            ))}
          </Card>

          {past.length > 0 ? (
            <View>
              <SectionLabel label={t('plan.redesign.pastPayments')} />
              <Card>
                {past.map((o) => {
                  const isPartial = BigInt(o.amountMinor) < BigInt(recurring.amountMinor);
                  return (
                    <View
                      key={o.id}
                      style={{
                        paddingHorizontal: sp.md,
                        paddingVertical: sp.md,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                        gap: sp.xs,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <RedesignText>{t('plan.redesign.paidOnTime')}</RedesignText>
                          <RedesignText variant="helper" tone="textSecondary">
                            {longWeekdayDate(o.dueDate).replace(/^[^,]+, /, '')}
                          </RedesignText>
                        </View>
                        <RedesignText
                          variant="label"
                          style={{ fontVariant: ['tabular-nums'], textDecorationLine: 'line-through' }}
                        >
                          {`−${formatNaira(BigInt(o.amountMinor))}`}
                        </RedesignText>
                      </View>
                      {isPartial ? (
                        <RedesignText testID="plan-badge-partial" variant="caption" tone="textSecondary">
                          {t('plan.redesign.partialRemaining', {
                            paid: formatNaira(BigInt(o.amountMinor)),
                            total: formatNaira(BigInt(recurring.amountMinor)),
                            remaining: formatNaira(BigInt(recurring.amountMinor) - BigInt(o.amountMinor)),
                          })}
                        </RedesignText>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </ScrollView>

        {row && row.group !== 'paid' ? (
          <View style={{ padding: sp.lg, gap: sp.sm, backgroundColor: theme.page }}>
            <RedesignField
              testID="plan-custom-amount"
              label={t('plan.redesign.payCustomAmount')}
              value={customAmountText}
              onChangeText={setCustomAmountText}
              placeholder={formatNaira(BigInt(recurring.amountMinor))}
              keyboardType="decimal-pad"
            />
            <RedesignButton
              testID="plan-redesign-mark-paid"
              label={t('plan.redesign.markAsPaid')}
              fullWidth
              disabled={busy}
              onPress={handlePayPress}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

function AddBillSheet({
  snapshot,
  existing,
  initialKind,
  onClose,
  onSave,
  onChooseIncome,
}: {
  snapshot: Snapshot;
  existing?: Recurring | null;
  initialKind: RecurringKind;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
  onChooseIncome?: () => void;
}) {
  const kindToSeg = (k: RecurringKind): AddKind =>
    k === 'income' ? 'in' : k === 'transfer' ? 'transfer' : 'out';
  const [seg, setSeg] = useState<AddKind>(kindToSeg(existing?.kind ?? initialKind));
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? toInputText(BigInt(existing.amountMinor)) : '');
  const [accountId, setAccountId] = useState(existing?.accountId ?? snapshot.accounts[0]?.id ?? '');
  const [onDay, setOnDay] = useState(String(existing?.rule.on && existing.rule.on !== 0 ? existing.rule.on : Number(today().slice(8, 10))));
  const [remind, setRemind] = useState(existing?.reminderDays !== undefined ? existing.reminderDays !== undefined : true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const accountName = snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('plan.redesign.chooseOption');
  const nextDuePreview = (() => {
    const day = Math.min(Math.max(1, Number(onDay) || 1), 28);
    const [y, m] = today().split('-').map(Number) as [number, number];
    const iso = `${today().slice(0, 7)}-${String(day).padStart(2, '0')}`;
    if (iso >= today()) return longWeekdayDate(iso).replace(/^[^,]+, /, '');
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return longWeekdayDate(`${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`).replace(/^[^,]+, /, '');
  })();

  const handleApplyTemplate = (tmpl: (typeof NIGERIAN_TEMPLATES)[number]) => {
    setName(tmpl.name);
    setAmountText(toInputText(BigInt(tmpl.amountMinor)));
    setOnDay(String(tmpl.day));
  };

  const save = async () => {
    setError(null);
    if (seg === 'in') {
      onChooseIncome?.();
      return;
    }
    if (!name.trim()) {
      setError(t('plan.redesign.namePlaceholder'));
      return;
    }
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) {
      setError(t('plan.redesign.amountHint'));
      return;
    }
    if (!accountId) {
      setError(t('plan.redesign.chooseOption'));
      return;
    }
    const categoryId =
      existing?.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '';
    if (!categoryId) {
      setError(t('plan.redesign.chooseOption'));
      return;
    }
    setSaving(true);
    try {
      const day = Math.min(Math.max(1, Number(onDay) || 1), 31);
      await onSave({
        kind: seg === 'transfer' ? 'transfer' : 'bill',
        name: name.trim(),
        amountMinor: parsed.minor.toString(),
        accountId,
        categoryId,
        toAccountId: existing?.toAccountId,
        payeeId: existing?.payeeId,
        rule: { every: 'month', on: day },
        startDate: existing?.startDate ?? today(),
        reminderDays: remind ? 2 : undefined,
        hideAmountOnLock: existing?.hideAmountOnLock ?? true,
        approximate: existing?.approximate,
        autoCreate: existing?.autoCreate,
      });
    } finally {
      setSaving(false);
    }
  };

  const numericDay = Number(onDay) || 0;
  const isMonthEndClamped = numericDay >= 29;

  return (
    <RedesignSheet
      testID="plan-redesign-add-sheet"
      visible
      title={t('plan.redesign.addTitle')}
      onClose={onClose}
      dirty={!!name || !!amountText}
      footer={
        <RedesignButton
          testID="plan-redesign-save"
          label={t('plan.redesign.saveBill')}
          fullWidth
          disabled={saving}
          onPress={() => void save()}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignSegmented
          testID="plan-redesign-kind"
          value={seg}
          onChange={(k) => setSeg(k as AddKind)}
          options={[
            { key: 'out', label: t('plan.redesign.kindOut') },
            { key: 'in', label: t('plan.redesign.kindIn') },
            { key: 'transfer', label: t('plan.redesign.kindTransfer') },
          ]}
        />

        {/* Localized Nigerian Templates */}
        {!existing ? (
          <View style={{ gap: sp.xs }} testID="plan-template-chips">
            <RedesignText variant="caption" tone="textSecondary">
              {t('plan.redesign.templatesTitle')}
            </RedesignText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.xs }}>
              {NIGERIAN_TEMPLATES.map((tmpl) => (
                <RedesignChip
                  key={tmpl.name}
                  testID={`plan-template-${tmpl.name}`}
                  label={tmpl.name}
                  selected={name === tmpl.name}
                  onPress={() => handleApplyTemplate(tmpl)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <RedesignField
          testID="plan-redesign-name"
          label={t('plan.name')}
          value={name}
          onChangeText={setName}
          placeholder={t('plan.redesign.namePlaceholder')}
        />
        <RedesignField
          testID="plan-redesign-amount"
          label={t('plan.amount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('plan.redesign.amountHint')}
        </RedesignText>

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('plan.redesign.repeats')}</RedesignText>
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
            <RedesignText>{t('plan.redesign.repeatsMonthly')}</RedesignText>
          </View>
        </View>

        <RedesignField
          testID="plan-redesign-day"
          label={t('plan.redesign.nextDue')}
          value={onDay}
          onChangeText={setOnDay}
          keyboardType="number-pad"
          placeholder={t('plan.redesign.pickDate')}
        />
        <RedesignText variant="helper" tone="textSecondary">
          {nextDuePreview}
        </RedesignText>
        {isMonthEndClamped ? (
          <RedesignText testID="plan-last-day-hint" variant="caption" tone="textSecondary">
            {t('plan.redesign.lastDayHint')}
          </RedesignText>
        ) : null}

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('plan.redesign.payFrom')}</RedesignText>
          <Pressable
            testID="plan-redesign-account"
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
                  testID={`plan-redesign-account-${a.id}`}
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
          <RedesignText>{t('plan.redesign.remindMe')}</RedesignText>
          <Switch
            testID="plan-redesign-remind"
            value={remind}
            onValueChange={setRemind}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </View>

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

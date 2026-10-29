import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Info, MoreHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Footer,
  Icon,
  InlineError,
  Placeholder,
  Popover,
  SegmentedControl,
  Sheet,
  StatusPill,
  Text,
  TextInput,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { Recurring } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthLabel, nextMonth, prevMonth } from '@/features/budget/helpers';
import { monthOf } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { MarkPaidMatchSheet } from './MarkPaidMatchSheet';
import { billMatchCandidates, billMatchReviewCount } from './match';
import { RecurringFormSheet } from './RecurringFormSheet';
import {
  calendarDays,
  dayListTitle,
  findRecurringSuggestions,
  planSummaryStrip,
  planRowsForMonth,
  rowsByDate,
  allScheduleRows,
  scheduleFrequency,
  type BillRow,
  type FindRecurringSuggestion,
  type ScheduleRow,
} from './recurrence';

const sp = tokens.spacing;
const GROUP_ORDER: BillRow['group'][] = ['overdue', 'dueSoon', 'later', 'paid'];
const UPCOMING_OPTIONS = [3, 7, 14, 30] as const;

type ViewMode = 'list' | 'calendar';
type PlanTab = 'month' | 'all';

export function PlanScreen() {
  const router = useRouter();
  const params = useGlobalSearchParams<{
    tab?: string;
    view?: string;
    schedule?: string;
    kind?: string;
    occurrence?: string;
    find?: string;
    day?: string;
  }>();
  const toast = useToast();
  const theme = useTheme();
  const sizeClass = useSizeClass();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const calendarCompact = sizeClass === 'phone';
  const showDayColumn = sizeClass !== 'phone' && (Platform.OS === 'web' || landscape);
  const { snapshot, repo } = useWorkspace();
  const [viewMonth, setViewMonth] = useState(() => monthOf(today()));
  const month = viewMonth;
  const planTab: PlanTab = params.tab === 'all' ? 'all' : 'month';
  const view: ViewMode = params.view === 'calendar' ? 'calendar' : params.view === 'list' ? 'list' : 'list';
  const setPlanTab = (tab: PlanTab) => router.setParams({ tab });
  const setView = (v: ViewMode) => router.setParams({ view: v });
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
  const dueSoonDays = (snapshot?.settings.dueSoonDays ?? 7) as (typeof UPCOMING_OPTIONS)[number];
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [scheduleAction, setScheduleAction] = useState<Recurring | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  // Tablet landscape: calendar + day column (DESIGN D24).
  useEffect(() => {
    if (sizeClass === 'tablet' && landscape && planTab === 'month' && params.view !== 'list') {
      router.setParams({ view: 'calendar' });
    }
  }, [sizeClass, landscape, planTab, params.view, router]);

  const formOpen = !!params.schedule;
  const findOpen = params.find === '1';
  const daySheet = typeof params.day === 'string' ? params.day : null;
  const editRecurring = useMemo(() => {
    if (!snapshot || !params.schedule || params.schedule === 'new') return null;
    return snapshot.recurring.find((r) => r.id === params.schedule) ?? null;
  }, [snapshot, params.schedule]);
  const formKind = (params.kind as Recurring['kind'] | undefined) ?? 'bill';
  const matchRow = useMemo(() => {
    if (!snapshot || !params.occurrence) return null;
    const [recurringId, dueDate] = String(params.occurrence).split(':');
    if (!recurringId || !dueDate) return null;
    const rows = planRowsForMonth(snapshot, monthOf(dueDate), today(), dueSoonDays);
    return rows.find((r) => r.recurring.id === recurringId && r.dueDate === dueDate) ?? null;
  }, [snapshot, params.occurrence, dueSoonDays]);

  const rows = useMemo(
    () => (snapshot ? planRowsForMonth(snapshot, month, today(), dueSoonDays) : null),
    [snapshot, month, dueSoonDays],
  );
  const strip = useMemo(() => (snapshot && rows ? planSummaryStrip(snapshot, month, rows) : null), [snapshot, month, rows]);
  const matchReviewCount = useMemo(() => (snapshot && rows ? billMatchReviewCount(snapshot, rows) : 0), [snapshot, rows]);
  const byDate = useMemo(() => (rows ? rowsByDate(rows) : new Map<string, BillRow[]>()), [rows]);
  const suggestions = useMemo(() => (snapshot ? findRecurringSuggestions(snapshot, month) : []), [snapshot, month]);
  const schedules = useMemo(
    () => (snapshot ? allScheduleRows(snapshot, today(), scheduleSearch, showCancelled) : []),
    [snapshot, scheduleSearch, showCancelled],
  );

  const openMatch = (row: BillRow) => {
    router.setParams({ occurrence: `${row.recurring.id}:${row.dueDate}` });
  };

  const openAdd = (kind: Recurring['kind']) => {
    setAddMenuOpen(false);
    if (kind === 'income') {
      router.push('/income?stream=new');
      return;
    }
    router.setParams({ schedule: 'new', kind });
  };

  const setDueSoonDays = (days: (typeof UPCOMING_OPTIONS)[number]) => {
    if (!snapshot) return;
    void repo.updateSettings({ ...snapshot.settings, dueSoonDays: days });
  };

  return (
    <AppFrame title={t('plan.title')}>
      {planTab === 'month' ? (
        <View
          testID="plan-month-nav"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}
        >
          <Pressable
            testID="plan-prev-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.previousMonth')}
            onPress={() => setViewMonth(prevMonth(viewMonth))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={theme.textSecondary} />
          </Pressable>
          <Text variant="heading-sm" style={{ minWidth: 160, textAlign: 'center' }}>
            {monthLabel(viewMonth)}
          </Text>
          <Pressable
            testID="plan-next-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.nextMonth')}
            onPress={() => setViewMonth(nextMonth(viewMonth))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      {strip ? (
        <View
          testID="plan-summary-strip"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: sp['spacing-sm'],
            marginBottom: sp['spacing-md'],
          }}
        >
          <SummaryCell label={t('plan.comingIn')} testID="plan-coming-in" phoneHalf={calendarCompact}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/income')}>
              <Amount minor={strip.comingIn} signed />
            </Pressable>
          </SummaryCell>
          <SummaryCell label={t('plan.goingOut')} testID="plan-going-out" phoneHalf={calendarCompact}>
            <Text variant="body-tabular">{`−${formatNaira(strip.goingOut)}`}</Text>
          </SummaryCell>
          <SummaryCell label={t('plan.leftAfter')} testID="plan-left-after" phoneHalf={calendarCompact}>
            <Amount minor={strip.leftAfter} />
          </SummaryCell>
          <SummaryCell label={t('plan.missed')} testID="plan-missed" phoneHalf={calendarCompact}>
            {strip.missed > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.color.ruby }} />
                <Text>{strip.missed}</Text>
              </View>
            ) : (
              <Text>0</Text>
            )}
          </SummaryCell>
        </View>
      ) : null}

      {matchReviewCount > 0 ? (
        <Card testID="plan-match-banner" style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-sm'] }}>
          <Text>{t('plan.matchBanner', { count: String(matchReviewCount) })}</Text>
          <Button
            testID="plan-match-review"
            kind="secondary"
            label={t('plan.matchReview')}
            onPress={() => {
              const first = rows?.find((r) => r.group !== 'paid' && r.recurring.kind !== 'income');
              if (first) openMatch(first);
            }}
          />
        </Card>
      ) : null}

      <SegmentedControl
        testID="plan-tab"
        label={t('plan.mainTab')}
        value={planTab}
        onChange={setPlanTab}
        options={[
          { value: 'month', label: t('plan.tabThisMonth') },
          { value: 'all', label: t('plan.tabAllSchedules') },
        ]}
      />

      {planTab === 'all' ? (
        <AllSchedulesTable
          rows={schedules}
          snapshot={snapshot}
          search={scheduleSearch}
          onSearch={setScheduleSearch}
          showCancelled={showCancelled}
          onToggleCancelled={() => setShowCancelled((v) => !v)}
          onOpenMenu={setScheduleAction}
          onAddBill={() => openAdd('bill')}
        />
      ) : (
        <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], alignItems: 'center' }}>
        <SegmentedControl
          testID="plan-view-toggle"
          label={t('plan.viewToggle')}
          options={[
            { value: 'list', label: t('plan.viewList') },
            { value: 'calendar', label: t('plan.viewCalendar') },
          ]}
          value={view}
          onChange={setView}
        />
        <Button testID="plan-find" kind="secondary" label={t('plan.findRecurring')} onPress={() => router.setParams({ find: '1' })} />
        <Button testID="plan-upcoming" kind="link" label={t('plan.upcomingLength', { days: dueSoonDays })} onPress={() => setUpcomingOpen(true)} />
        <Button testID="plan-add-menu" label={t('plan.addMenu')} onPress={() => setAddMenuOpen(true)} />
      </View>

      {error ? <InlineError message={error} /> : null}

      {!rows ? (
        <Placeholder height={120} />
      ) : rows.length === 0 ? (
        <View testID="plan-empty-month" style={{ alignItems: 'center', gap: sp['spacing-md'], padding: sp['spacing-xl'] }}>
          <Text variant="heading-sm">{t('plan.emptyMonthTitle')}</Text>
          <Text tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('plan.emptyMonthBody')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], justifyContent: 'center' }}>
            <Button testID="plan-empty-add" label={t('plan.addBill')} onPress={() => openAdd('bill')} />
            <Button testID="plan-empty-find" kind="secondary" label={t('plan.findRecurring')} onPress={() => router.setParams({ find: '1' })} />
          </View>
        </View>
      ) : view === 'list' ? (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {GROUP_ORDER.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            if (group === 'paid' && !paidExpanded) {
              return (
                <Button
                  key={group}
                  testID="plan-paid-expand"
                  kind="link"
                  label={t('plan.group.paid') + ` (${groupRows.length})`}
                  onPress={() => setPaidExpanded(true)}
                />
              );
            }
            return (
              <View key={group} style={{ gap: sp['spacing-sm'] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
                  <Text variant="heading-sm">{t(`plan.group.${group}`)}</Text>
                  {group === 'dueSoon' ? (
                    <Pressable
                      testID="plan-due-soon-info"
                      accessibilityRole="button"
                      accessibilityLabel={t('plan.upcomingTitle')}
                      onPress={() => setUpcomingOpen(true)}
                      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Info size={16} color={theme.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
                {groupRows.map((row) => (
                  <BillRowView
                    key={`${row.recurring.id}-${row.dueDate}`}
                    row={row}
                    snapshot={snapshot!}
                    onMark={() => openMatch(row)}
                    onEdit={
                      row.recurring.id.startsWith('stream:')
                        ? () => router.push(`/income?stream=${row.recurring.id.replace(/^stream:/, '')}`)
                        : () => router.setParams({ schedule: row.recurring.id })
                    }
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: showDayColumn ? 'row' : 'column', gap: sp['spacing-md'], alignItems: 'flex-start' }}>
          <View style={{ flex: showDayColumn ? 2 : undefined, width: showDayColumn ? undefined : '100%' }}>
            <CalendarGrid
              month={month}
              today={today()}
              byDate={byDate}
              onDay={(d) => router.setParams({ day: d })}
              onHoverDay={Platform.OS === 'web' ? setHoverDay : undefined}
              hoverDay={hoverDay}
              theme={theme}
              compact={calendarCompact}
            />
          </View>
          {showDayColumn ? (
            <View testID="plan-day-column" style={{ flex: 1, minWidth: 220, gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">
                {dayListTitle(daySheet ?? hoverDay ?? today())}
              </Text>
              {(byDate.get(daySheet ?? hoverDay ?? today()) ?? []).map((row) => (
                <BillRowView
                  key={`side-${row.recurring.id}-${row.dueDate}`}
                  row={row}
                  snapshot={snapshot!}
                  onMark={() => openMatch(row)}
                  onEdit={() => router.setParams({ schedule: row.recurring.id })}
                />
              ))}
              {(byDate.get(daySheet ?? hoverDay ?? today()) ?? []).length === 0 ? (
                <Text tone="textSecondary">{t('plan.dayEmpty')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

        </>
      )}

      {formOpen && snapshot ? (
        <RecurringFormSheet
          snapshot={snapshot}
          existing={editRecurring}
          initialKind={formKind}
          visible
          onClose={() => router.setParams({ schedule: undefined, kind: undefined })}
          onChooseIncome={() => {
            router.setParams({ schedule: undefined, kind: undefined });
            router.push('/income?stream=new');
          }}
          onSave={async (data) => {
            setError(null);
            if (editRecurring) await repo.updateRecurring({ ...data, id: editRecurring.id });
            else await repo.addRecurring(data);
            toast.show(editRecurring ? t('plan.billSaved') : t('plan.billAdded'));
          }}
          onDelete={
            editRecurring
              ? async () => {
                  await repo.updateRecurring({ ...editRecurring, cancelled: true });
                  toast.show(t('plan.billDeleted'));
                }
              : undefined
          }
          onCancelSchedule={
            editRecurring
              ? async () => {
                  await repo.updateRecurring({ ...editRecurring, cancelled: true });
                  toast.show(t('plan.scheduleCancelled'));
                }
              : undefined
          }
          onRestoreSchedule={
            editRecurring?.cancelled
              ? async () => {
                  await repo.updateRecurring({ ...editRecurring, cancelled: false });
                  toast.show(t('plan.scheduleRestored'));
                }
              : undefined
          }
        />
      ) : null}

      {snapshot && params.occurrence ? (
        <MarkPaidMatchSheet
          row={matchRow}
          snapshot={snapshot}
          visible
          onClose={() => router.setParams({ occurrence: undefined })}
          onDone={(msg) => toast.show(msg ?? t('common.saved'))}
        />
      ) : null}

      <Popover visible={addMenuOpen} onClose={() => setAddMenuOpen(false)} testID="plan-add-popover">
        <Text variant="heading-sm">{t('plan.addMenu')}</Text>
        <Button testID="plan-add-bill" kind="secondary" label={t('plan.kind.bill')} onPress={() => openAdd('bill')} />
        <Button testID="plan-add-subscription" kind="secondary" label={t('plan.kind.subscription')} onPress={() => openAdd('subscription')} />
        <Button testID="plan-add-transfer" kind="secondary" label={t('plan.kind.transfer')} onPress={() => openAdd('transfer')} />
        <Button testID="plan-add-income" kind="secondary" label={t('plan.kind.income')} onPress={() => openAdd('income')} />
      </Popover>

      <Popover visible={!!scheduleAction} onClose={() => setScheduleAction(null)} testID="plan-schedule-menu">
        {scheduleAction ? (
          <>
            <Button
              testID="plan-schedule-edit"
              kind="secondary"
              label={t('plan.editRecurring')}
              onPress={() => {
                router.setParams({ schedule: scheduleAction.id });
                setScheduleAction(null);
              }}
            />
            {scheduleAction.paused ? (
              <Button
                testID="plan-schedule-resume"
                kind="secondary"
                label={t('plan.resumeSchedule')}
                onPress={() =>
                  void repo.updateRecurring({ ...scheduleAction, paused: false }).then(() => {
                    toast.show(t('plan.scheduleResumed'));
                    setScheduleAction(null);
                  })
                }
              />
            ) : (
              <Button
                testID="plan-schedule-pause"
                kind="secondary"
                label={t('plan.pauseSchedule')}
                onPress={() =>
                  void repo.updateRecurring({ ...scheduleAction, paused: true }).then(() => {
                    toast.show(t('plan.schedulePaused'));
                    setScheduleAction(null);
                  })
                }
              />
            )}
            {scheduleAction.cancelled ? (
              <Button
                testID="plan-schedule-restore"
                kind="secondary"
                label={t('plan.restoreSchedule')}
                onPress={() =>
                  void repo.updateRecurring({ ...scheduleAction, cancelled: false }).then(() => {
                    toast.show(t('plan.scheduleRestored'));
                    setScheduleAction(null);
                  })
                }
              />
            ) : (
              <Button
                testID="plan-schedule-cancel"
                kind="secondary"
                label={t('plan.cancelSchedule')}
                onPress={() =>
                  void repo.updateRecurring({ ...scheduleAction, cancelled: true }).then(() => {
                    toast.show(t('plan.scheduleCancelled'));
                    setScheduleAction(null);
                  })
                }
              />
            )}
          </>
        ) : null}
      </Popover>

      {findOpen && snapshot ? (
        <FindRecurringSheet
          suggestions={suggestions}
          onClose={() => router.setParams({ find: undefined })}
          onAddMany={async (picked) => {
            for (const s of picked) {
              await repo.addRecurring({
                kind: 'bill',
                name: s.name,
                amountMinor: s.averageMinor.toString(),
                accountId: snapshot.accounts[0]!.id,
                categoryId: snapshot.categories.find((c) => c.kind === 'expense')!.id,
                payeeId: s.payeeId,
                rule: { every: 'month', on: s.dayOfMonth },
                startDate: today(),
                reminderDays: 1,
                hideAmountOnLock: true,
              });
            }
            toast.show(t('plan.findAdded', { count: String(picked.length) }));
            router.setParams({ find: undefined });
          }}
        />
      ) : null}

      <Popover visible={upcomingOpen} onClose={() => setUpcomingOpen(false)} testID="plan-upcoming-popover">
        <Text variant="heading-sm">{t('plan.upcomingTitle')}</Text>
        <SegmentedControl
          testID="plan-upcoming-seg"
          label={t('plan.upcomingTitle')}
          value={String(dueSoonDays)}
          onChange={(v) => {
            setDueSoonDays(Number(v) as (typeof UPCOMING_OPTIONS)[number]);
            setUpcomingOpen(false);
          }}
          options={UPCOMING_OPTIONS.map((d) => ({ value: String(d), label: t('plan.upcomingDays', { days: d }) }))}
        />
      </Popover>

      {daySheet && rows && !showDayColumn ? (
        sizeClass === 'phone' ? (
          <Sheet
            visible
            title={dayListTitle(daySheet)}
            onClose={() => router.setParams({ day: undefined })}
            testID="plan-day-sheet"
          >
            {(byDate.get(daySheet) ?? []).map((row: BillRow) => (
              <BillRowView
                key={`${row.recurring.id}-${row.dueDate}`}
                row={row}
                snapshot={snapshot!}
                onMark={() => openMatch(row)}
                onEdit={() => {
                  if (row.recurring.id.startsWith('stream:')) router.push(`/income?stream=${row.recurring.id.replace(/^stream:/, '')}`);
                  else router.setParams({ schedule: row.recurring.id, day: undefined });
                }}
              />
            ))}
            {(byDate.get(daySheet) ?? []).length === 0 ? (
              <EmptyState title={t('plan.dayEmpty')} body="" actionLabel={t('plan.addBill')} onAction={() => openAdd('bill')} />
            ) : null}
          </Sheet>
        ) : (
          <Popover visible onClose={() => router.setParams({ day: undefined })} testID="plan-day-sheet">
            <Text variant="heading-sm">{dayListTitle(daySheet)}</Text>
            {(byDate.get(daySheet) ?? []).map((row: BillRow) => (
              <BillRowView
                key={`${row.recurring.id}-${row.dueDate}`}
                row={row}
                snapshot={snapshot!}
                onMark={() => openMatch(row)}
                onEdit={() => {
                  if (row.recurring.id.startsWith('stream:')) router.push(`/income?stream=${row.recurring.id.replace(/^stream:/, '')}`);
                  else router.setParams({ schedule: row.recurring.id, day: undefined });
                }}
              />
            ))}
            {(byDate.get(daySheet) ?? []).length === 0 ? (
              <EmptyState title={t('plan.dayEmpty')} body="" actionLabel={t('plan.addBill')} onAction={() => openAdd('bill')} />
            ) : null}
          </Popover>
        )
      ) : null}
    </AppFrame>
  );
}

function AllSchedulesTable({
  rows,
  snapshot,
  search,
  onSearch,
  showCancelled,
  onToggleCancelled,
  onOpenMenu,
  onAddBill,
}: {
  rows: ScheduleRow[];
  snapshot: Snapshot | null;
  search: string;
  onSearch: (q: string) => void;
  showCancelled: boolean;
  onToggleCancelled: () => void;
  onOpenMenu: (rec: Recurring) => void;
  onAddBill: () => void;
}) {
  return (
    <View testID="plan-all-schedules" style={{ gap: sp['spacing-md'] }}>
      <TextInput testID="plan-schedules-search" label={t('plan.schedulesSearch')} value={search} onChangeText={onSearch} />
      <Pressable
        testID="plan-show-cancelled"
        accessibilityRole="button"
        accessibilityLabel={t('plan.showCancelled')}
        onPress={onToggleCancelled}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}
      >
        <Icon icon={showCancelled ? ChevronDown : ChevronRight} size="row" />
        <Text tone="link">{t('plan.showCancelled')}</Text>
      </Pressable>
      {rows.length === 0 && !search.trim() ? (
        <EmptyState title={t('plan.schedulesEmptyTitle')} body={t('plan.schedulesEmptyBody')} actionLabel={t('plan.addBill')} onAction={onAddBill} />
      ) : rows.length === 0 ? (
        <Text tone="textSecondary">{t('plan.schedulesEmpty')}</Text>
      ) : (
        <ScrollView horizontal>
          <View style={{ minWidth: 820, gap: sp['spacing-xs'] }}>
            <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingBottom: sp['spacing-xs'] }}>
              <Text variant="caption" tone="textSecondary" style={{ flex: 2 }}>
                {t('plan.schedulesName')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88 }}>
                {t('plan.schedulesPayee')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88 }}>
                {t('plan.schedulesAccount')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 100 }}>
                {t('plan.schedulesNext')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 88 }}>
                {t('plan.schedulesStatus')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 100 }}>
                {t('plan.schedulesAmount')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 120 }}>
                {t('plan.schedulesOften')}
              </Text>
              <Text variant="caption" tone="textSecondary" style={{ width: 40 }}>
                {' '}
              </Text>
            </View>
            {rows.map((row) => {
              const payee = row.recurring.payeeId ? snapshot?.payees.find((p) => p.id === row.recurring.payeeId)?.name : t('common.notSet');
              const account = snapshot?.accounts.find((a) => a.id === row.recurring.accountId)?.name ?? t('common.notSet');
              return (
                <Card key={row.recurring.id} testID={`plan-schedule-${row.recurring.id}`} style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'center' }}>
                  <Text style={{ flex: 2 }}>{row.recurring.name}</Text>
                  <Text variant="caption" style={{ width: 88 }} numberOfLines={1}>
                    {payee}
                  </Text>
                  <Text variant="caption" style={{ width: 88 }} numberOfLines={1}>
                    {account}
                  </Text>
                  <Text variant="caption" style={{ width: 100 }}>
                    {row.nextDate ? formatDay(row.nextDate) : t('common.notSet')}
                  </Text>
                  <Text variant="caption" style={{ width: 88 }}>
                    {t(`plan.scheduleStatus.${row.status}`)}
                  </Text>
                  <View style={{ width: 100 }}>
                    <Amount minor={BigInt(row.recurring.amountMinor)} variant="caption" />
                  </View>
                  <Text variant="caption" tone="textSecondary" style={{ width: 120 }}>
                    {scheduleFrequency(row.recurring)}
                  </Text>
                  <Pressable
                    testID={`plan-schedule-menu-${row.recurring.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.options')}
                    onPress={() => onOpenMenu(row.recurring)}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon icon={MoreHorizontal} size="nav" />
                  </Pressable>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCell({
  label,
  testID,
  children,
  phoneHalf,
}: {
  label: string;
  testID: string;
  children: ReactNode;
  phoneHalf?: boolean;
}) {
  return (
    <Card
      testID={testID}
      style={{
        flex: 1,
        minWidth: phoneHalf ? '45%' : 140,
        maxWidth: phoneHalf ? '48%' : undefined,
        gap: sp['spacing-xxs'],
      }}
    >
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      {children}
    </Card>
  );
}

function CalendarGrid({
  month,
  today: todayIso,
  byDate,
  onDay,
  onHoverDay,
  hoverDay,
  theme,
  compact,
}: {
  month: string;
  today: string;
  byDate: Map<string, BillRow[]>;
  onDay: (iso: string) => void;
  onHoverDay?: (iso: string | null) => void;
  hoverDay?: string | null;
  theme: ReturnType<typeof useTheme>;
  compact: boolean;
}) {
  const days = calendarDays(month);
  const ink = tokens.color.ink;
  return (
    <View testID="plan-calendar" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {days.map((d) => {
        const items = byDate.get(d) ?? [];
        const isToday = d === todayIso;
        const hovered = hoverDay === d;
        return (
          <Pressable
            key={d}
            testID={`plan-cal-${d}`}
            accessibilityRole="button"
            accessibilityLabel={d}
            onPress={() => onDay(d)}
            onHoverIn={onHoverDay ? () => onHoverDay(d) : undefined}
            onHoverOut={onHoverDay ? () => onHoverDay(null) : undefined}
            style={{
              width: '13%',
              minWidth: compact ? 40 : 72,
              minHeight: compact ? undefined : 56,
              aspectRatio: compact ? 1 : undefined,
              borderWidth: 1,
              borderColor: isToday ? theme.primaryFill : hovered ? ink : theme.border,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: 4,
              backgroundColor: hovered ? theme.hover : undefined,
            }}
          >
            <Text variant="caption">{d.slice(-2)}</Text>
            {items.length > 0 ? (
              compact ? (
                <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {items.slice(0, 3).map((r) => (
                    <View
                      key={`${r.recurring.id}-${r.dueDate}`}
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor:
                          r.recurring.kind === 'income'
                            ? theme.primaryFill
                            : r.group === 'overdue' && r.occurrence?.status !== 'paid'
                              ? tokens.color.ruby
                              : ink,
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={{ gap: 2, marginTop: 2, width: '100%' }}>
                  {(hovered ? items : items.slice(0, 2)).map((r) => (
                    <View
                      key={`${r.recurring.id}-${r.dueDate}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                        backgroundColor: theme.hover,
                        borderRadius: 4,
                        paddingHorizontal: 2,
                      }}
                    >
                      {r.group === 'overdue' && r.occurrence?.status !== 'paid' ? (
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tokens.color.ruby }} />
                      ) : null}
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1, color: ink }}>
                        {r.recurring.kind === 'income' ? `+ ${r.recurring.name}` : r.recurring.name}
                      </Text>
                    </View>
                  ))}
                  {!hovered && items.length > 2 ? (
                    <Text variant="caption" tone="textSecondary">
                      +{items.length - 2}
                    </Text>
                  ) : null}
                </View>
              )
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function BillRowView({
  row,
  snapshot,
  onMark,
  onEdit,
}: {
  row: BillRow;
  snapshot: Snapshot;
  onMark: () => void;
  onEdit: () => void;
}) {
  const paid = row.occurrence?.status === 'paid';
  const income = row.recurring.kind === 'income';
  const hasMatch = !paid && !income && billMatchCandidates(snapshot, row).length > 0;
  const payee = row.recurring.payeeId ? snapshot.payees.find((p) => p.id === row.recurring.payeeId) : undefined;
  return (
    <Card testID={`bill-${row.recurring.id}`} style={{ gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'], flex: 1 }}>
          {payee?.logoUri ? (
            <Image
              testID={`bill-logo-${row.recurring.id}`}
              source={{ uri: payee.logoUri }}
              style={{ width: 28, height: 28, borderRadius: 6 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              testID={`bill-logo-placeholder-${row.recurring.id}`}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: tokens.color.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="caption">{row.recurring.name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <Text variant="heading-sm" style={{ flexShrink: 1 }}>
            {income ? '+ ' : ''}
            {row.recurring.name}
          </Text>
        </View>
        {row.group === 'overdue' && !paid ? <StatusPill label={t('plan.overdue')} kind="problem" /> : null}
        {row.group === 'dueSoon' && !paid ? <StatusPill label={t('plan.dueSoon')} kind="due-soon" /> : null}
        {paid ? <StatusPill label={income ? t('plan.received') : t('plan.paid')} kind="done" /> : null}
      </View>
      <Text tone="textSecondary">
        {formatDay(row.dueDate)} · <Amount minor={BigInt(row.recurring.amountMinor)} signed={income} variant="caption" />
        {row.recurring.approximate ? ` ${t('plan.approximate')}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
        <Button
          testID={`bill-mark-${row.recurring.id}`}
          kind="secondary"
          label={
            paid
              ? t('plan.alreadyPaidShort')
              : income
                ? t('plan.markReceived')
                : hasMatch
                  ? t('plan.match')
                  : t('plan.markPaid')
          }
          onPress={onMark}
        />
        <Button testID={`bill-edit-${row.recurring.id}`} kind="link" label={t('plan.editRecurring')} onPress={onEdit} />
      </View>
    </Card>
  );
}

function FindRecurringSheet({
  suggestions,
  onClose,
  onAddMany,
}: {
  suggestions: FindRecurringSuggestion[];
  onClose: () => void;
  onAddMany: (selected: FindRecurringSuggestion[]) => Promise<void>;
}) {
  const strongKey = suggestions.map((s) => s.id).join('|');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(suggestions.filter((s) => s.confidence === 'strong').map((s) => s.id)));
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seededFor !== strongKey) {
    setSeededFor(strongKey);
    setSelected(new Set(suggestions.filter((s) => s.confidence === 'strong').map((s) => s.id)));
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    const picks = suggestions.filter((s) => selected.has(s.id));
    if (picks.length === 0) return;
    void onAddMany(picks);
  };

  return (
    <Sheet
      visible
      title={t('plan.findTitle')}
      onClose={onClose}
      width={640}
      testID="plan-find-sheet"
      footer={
        <Footer>
          <Button testID="plan-find-cancel" kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="plan-find-add-selected"
            label={t('plan.findAddCount', { count: String(selected.size) })}
            onPress={() => void addSelected()}
            disabled={selected.size === 0}
          />
        </Footer>
      }
    >
      {suggestions.length === 0 ? (
        <Text tone="textSecondary">{t('plan.findEmpty')}</Text>
      ) : (
        suggestions.map((s) => (
          <Card key={s.id} style={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
            <Checkbox
              testID={`plan-find-check-${s.id}`}
              label={s.name}
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
            />
            <Text tone="textSecondary">
              {s.howOften} · {t(`plan.confidence.${s.confidence}`)} · <Amount minor={s.averageMinor} variant="caption" /> · {formatDay(s.lastDate)}
            </Text>
          </Card>
        ))
      )}
    </Sheet>
  );
}

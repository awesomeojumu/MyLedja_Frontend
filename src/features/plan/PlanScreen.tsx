import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  InlineError,
  Placeholder,
  Popover,
  SegmentedControl,
  Select,
  Sheet,
  StatusPill,
  Text,
  TextInput,
  AmountInput,
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
type PlanTab = 'thisMonth' | 'allSchedules';

export function PlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const sizeClass = useSizeClass();
  const calendarCompact = sizeClass === 'phone';
  const { snapshot, repo } = useWorkspace();
  const [viewMonth, setViewMonth] = useState(() => monthOf(today()));
  const month = viewMonth;
  const [view, setView] = useState<ViewMode>('list');
  const [planTab, setPlanTab] = useState<PlanTab>('thisMonth');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [paidExpanded, setPaidExpanded] = useState(false);
  const [dueSoonDays, setDueSoonDays] = useState<number>(7);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<Recurring['kind']>('bill');
  const [editRecurring, setEditRecurring] = useState<Recurring | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [matchRow, setMatchRow] = useState<BillRow | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [scheduleAction, setScheduleAction] = useState<Recurring | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => (snapshot ? planRowsForMonth(snapshot, month, today(), dueSoonDays) : null),
    [snapshot, month, dueSoonDays],
  );
  const strip = useMemo(() => (snapshot && rows ? planSummaryStrip(snapshot, month, rows) : null), [snapshot, month, rows]);
  const matchReviewCount = useMemo(() => (snapshot && rows ? billMatchReviewCount(snapshot, rows) : 0), [snapshot, rows]);
  const byDate = useMemo(() => (rows ? rowsByDate(rows) : new Map()), [rows]);
  const suggestions = useMemo(() => (snapshot ? findRecurringSuggestions(snapshot, month) : []), [snapshot, month]);
  const schedules = useMemo(
    () => (snapshot ? allScheduleRows(snapshot, today(), scheduleSearch, showCancelled) : []),
    [snapshot, scheduleSearch, showCancelled],
  );

  const openMatch = (row: BillRow) => {
    if (row.occurrence?.status === 'paid') {
      let paidOn = row.dueDate;
      if (row.occurrence.eventId && snapshot) {
        const ev = snapshot.events.find((e) => e.id === row.occurrence!.eventId);
        if (ev) paidOn = ev.date;
      }
      toast.show(t('plan.alreadyPaid', { date: formatDay(paidOn) }));
      return;
    }
    setMatchRow(row);
  };

  const openAdd = (kind: Recurring['kind']) => {
    setEditRecurring(null);
    setFormKind(kind);
    setFormOpen(true);
    setAddMenuOpen(false);
  };

  return (
    <AppFrame title={t('plan.title')}>
      <View
        testID="plan-month-nav"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}
      >
        <Pressable
          testID="plan-prev-month"
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
          accessibilityLabel={t('date.nextMonth')}
          onPress={() => setViewMonth(nextMonth(viewMonth))}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      {strip ? (
        <View testID="plan-summary-strip" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
          <SummaryCell label={t('plan.comingIn')} testID="plan-coming-in">
            <Pressable accessibilityRole="link" onPress={() => router.push('/income')}>
              <Amount minor={strip.comingIn} signed />
            </Pressable>
          </SummaryCell>
          <SummaryCell label={t('plan.goingOut')} testID="plan-going-out">
            <Text variant="body-tabular">{`−${formatNaira(strip.goingOut)}`}</Text>
          </SummaryCell>
          <SummaryCell label={t('plan.leftAfter')} testID="plan-left-after">
            <Amount minor={strip.leftAfter} />
          </SummaryCell>
          <SummaryCell label={t('plan.missed')} testID="plan-missed">
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
              if (first) setMatchRow(first);
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
          { value: 'thisMonth', label: t('plan.tabThisMonth') },
          { value: 'allSchedules', label: t('plan.tabAllSchedules') },
        ]}
      />

      {planTab === 'allSchedules' ? (
        <AllSchedulesTable
          rows={schedules}
          snapshot={snapshot}
          search={scheduleSearch}
          onSearch={setScheduleSearch}
          showCancelled={showCancelled}
          onToggleCancelled={() => setShowCancelled((v) => !v)}
          onOpenMenu={setScheduleAction}
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
        <Button testID="plan-find" kind="secondary" label={t('plan.findRecurring')} onPress={() => setFindOpen(true)} />
        <Button testID="plan-upcoming" kind="link" label={t('plan.upcomingLength', { days: dueSoonDays })} onPress={() => setUpcomingOpen(true)} />
        <Button testID="plan-add-menu" label={t('plan.addMenu')} onPress={() => setAddMenuOpen(true)} />
      </View>

      {error ? <InlineError message={error} /> : null}

      {!rows ? (
        <Placeholder height={120} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('plan.emptyTitle')} body={t('plan.emptyBody')} actionLabel={t('plan.addMenu')} onAction={() => setAddMenuOpen(true)} />
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
                <Text variant="heading-sm">{t(`plan.group.${group}`)}</Text>
                {groupRows.map((row) => (
                  <BillRowView
                    key={`${row.recurring.id}-${row.dueDate}`}
                    row={row}
                    snapshot={snapshot!}
                    onMark={() => openMatch(row)}
                    onEdit={
                      row.recurring.id.startsWith('stream:')
                        ? () => router.push('/income')
                        : () => {
                            const rec = snapshot!.recurring.find((r) => r.id === row.recurring.id);
                            if (rec) {
                              setEditRecurring(rec);
                              setFormOpen(true);
                            }
                          }
                    }
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <CalendarGrid month={month} today={today()} byDate={byDate} onDay={(d) => setDaySheet(d)} theme={theme} compact={calendarCompact} />
      )}

        </>
      )}

      {formOpen && snapshot ? (
        <RecurringFormSheet
          snapshot={snapshot}
          existing={editRecurring}
          initialKind={formKind}
          visible
          onClose={() => {
            setFormOpen(false);
            setEditRecurring(null);
          }}
          onSave={async (data) => {
            setError(null);
            if (editRecurring) await repo.updateRecurring({ ...data, id: editRecurring.id });
            else await repo.addRecurring(data);
          }}
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

      {snapshot && matchRow ? (
        <MarkPaidMatchSheet
          row={matchRow}
          snapshot={snapshot}
          visible
          onClose={() => setMatchRow(null)}
          onDone={() => toast.show(t('common.saved'))}
        />
      ) : null}

      <Popover visible={addMenuOpen} onClose={() => setAddMenuOpen(false)} testID="plan-add-popover">
        <Text variant="heading-sm">{t('plan.addMenu')}</Text>
        <Button testID="plan-add-bill" kind="secondary" label={t('plan.kind.bill')} onPress={() => openAdd('bill')} />
        <Button testID="plan-add-subscription" kind="secondary" label={t('plan.kind.subscription')} onPress={() => openAdd('subscription')} />
        <Button testID="plan-add-transfer" kind="secondary" label={t('plan.kind.transfer')} onPress={() => openAdd('transfer')} />
        <Button testID="plan-add-income" kind="secondary" label={t('plan.kind.income')} onPress={() => { setAddMenuOpen(false); router.push('/income'); }} />
      </Popover>

      <Popover visible={!!scheduleAction} onClose={() => setScheduleAction(null)} testID="plan-schedule-menu">
        {scheduleAction ? (
          <>
            <Button
              testID="plan-schedule-edit"
              kind="secondary"
              label={t('plan.editRecurring')}
              onPress={() => {
                setEditRecurring(scheduleAction);
                setFormOpen(true);
                setScheduleAction(null);
              }}
            />
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
          onClose={() => setFindOpen(false)}
          onAddMany={async (picked) => {
            for (const s of picked) {
              await repo.addRecurring({
                kind: 'bill',
                name: s.name,
                amountMinor: s.averageMinor.toString(),
                accountId: snapshot.accounts[0]!.id,
                categoryId: snapshot.categories.find((c) => c.kind === 'expense')!.id,
                rule: { every: 'month', on: 1 },
                startDate: today(),
              });
            }
            setFindOpen(false);
          }}
        />
      ) : null}

      <Popover visible={upcomingOpen} onClose={() => setUpcomingOpen(false)} testID="plan-upcoming-popover">
        <Text variant="heading-sm">{t('plan.upcomingTitle')}</Text>
        {UPCOMING_OPTIONS.map((d) => (
          <Button
            key={d}
            testID={`plan-upcoming-${d}`}
            kind={dueSoonDays === d ? 'primary-pill' : 'secondary'}
            label={t('plan.upcomingDays', { days: d })}
            onPress={() => {
              setDueSoonDays(d);
              setUpcomingOpen(false);
            }}
          />
        ))}
      </Popover>

      {daySheet && rows ? (
        <Sheet visible title={formatDay(daySheet)} onClose={() => setDaySheet(null)} testID="plan-day-sheet">
          {(byDate.get(daySheet) ?? []).map((row: BillRow) => (
            <BillRowView
              key={`${row.recurring.id}-${row.dueDate}`}
              row={row}
              snapshot={snapshot!}
              onMark={() => openMatch(row)}
              onEdit={() => {
                if (row.recurring.id.startsWith('stream:')) router.push('/income');
                else {
                  const rec = snapshot!.recurring.find((r) => r.id === row.recurring.id);
                  if (rec) {
                    setEditRecurring(rec);
                    setFormOpen(true);
                  }
                }
              }}
            />
          ))}
          {(byDate.get(daySheet) ?? []).length === 0 ? <Text tone="textSecondary">{t('plan.dayEmpty')}</Text> : null}
        </Sheet>
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
  onEdit,
  onOpenMenu,
}: {
  rows: ScheduleRow[];
  snapshot: Snapshot | null;
  search: string;
  onSearch: (q: string) => void;
  showCancelled: boolean;
  onToggleCancelled: () => void;
  onEdit: (rec: Recurring) => void;
  onOpenMenu: (rec: Recurring) => void;
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
      {rows.length === 0 ? (
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

function SummaryCell({ label, testID, children }: { label: string; testID: string; children: ReactNode }) {
  return (
    <Card testID={testID} style={{ flex: 1, minWidth: 140, gap: sp['spacing-xxs'] }}>
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
  theme,
  compact,
}: {
  month: string;
  today: string;
  byDate: Map<string, BillRow[]>;
  onDay: (iso: string) => void;
  theme: ReturnType<typeof useTheme>;
  compact: boolean;
}) {
  const days = calendarDays(month);
  return (
    <View testID="plan-calendar" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {days.map((d) => {
        const items = byDate.get(d) ?? [];
        const overdue = items.some((r) => r.group === 'overdue' && r.occurrence?.status !== 'paid');
        const isToday = d === todayIso;
        return (
          <Pressable
            key={d}
            testID={`plan-cal-${d}`}
            accessibilityRole="button"
            accessibilityLabel={d}
            onPress={() => onDay(d)}
            style={{
              width: compact ? '13%' : '13%',
              minWidth: compact ? 40 : 72,
              minHeight: compact ? undefined : 56,
              aspectRatio: compact ? 1 : undefined,
              borderWidth: 1,
              borderColor: isToday ? theme.primaryFill : theme.border,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: 4,
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
                        backgroundColor: r.recurring.kind === 'income' ? theme.primaryFill : overdue ? tokens.color.ruby : theme.textSecondary,
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={{ gap: 2, marginTop: 2, width: '100%' }}>
                  {items.slice(0, 2).map((r) => (
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
                      <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                        {r.recurring.kind === 'income' ? `+ ${r.recurring.name}` : r.recurring.name}
                      </Text>
                    </View>
                  ))}
                  {items.length > 2 ? (
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
  return (
    <Card testID={`bill-${row.recurring.id}`} style={{ gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading-sm">
          {income ? '+ ' : ''}
          {row.recurring.name}
        </Text>
        {row.group === 'overdue' && !paid ? <StatusPill label={t('plan.overdue')} kind="pending" /> : null}
        {row.group === 'dueSoon' && !paid ? <StatusPill label={t('plan.dueSoon')} kind="pending" /> : null}
        {paid ? <StatusPill label={income ? t('plan.received') : t('plan.paid')} kind="done" /> : null}
      </View>
      <Text tone="textSecondary">
        {formatDay(row.dueDate)} · <Amount minor={BigInt(row.recurring.amountMinor)} signed={income} variant="caption" />
        {row.recurring.approximate ? ` ${t('plan.approximate')}` : ''}
      </Text>
      {paid ? null : (
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
          <Button
            testID={`bill-mark-${row.recurring.id}`}
            kind="secondary"
            label={income ? t('plan.markReceived') : hasMatch ? t('plan.match') : t('plan.markPaid')}
            onPress={onMark}
          />
          <Button testID={`bill-edit-${row.recurring.id}`} kind="link" label={t('plan.editRecurring')} onPress={onEdit} />
        </View>
      )}
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

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
    void onAddMany(picks).then(onClose);
  };

  return (
    <Sheet
      visible
      title={t('plan.findTitle')}
      onClose={onClose}
      testID="plan-find-sheet"
      footer={
        <Button
          testID="plan-find-add-selected"
          label={t('plan.findAddSelected')}
          onPress={() => void addSelected()}
          disabled={selected.size === 0}
        />
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
              {t(`plan.confidence.${s.confidence}`)} · <Amount minor={s.averageMinor} variant="caption" />
            </Text>
            <Button testID={`plan-find-add-${s.id}`} kind="secondary" label={t('plan.findAdd')} onPress={() => void onAddMany([s]).then(onClose)} />
          </Card>
        ))
      )}
    </Sheet>
  );
}

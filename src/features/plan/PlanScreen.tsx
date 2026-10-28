import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
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
import { useTheme } from '@/design/ThemeProvider';
import type { Recurring } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthOf } from '@/ledger';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import {
  billsForMonth,
  calendarDays,
  findRecurringSuggestions,
  planSummaryStrip,
  rowsByDate,
  type BillRow,
  type FindRecurringSuggestion,
} from './recurrence';

const sp = tokens.spacing;
const GROUP_ORDER: BillRow['group'][] = ['overdue', 'dueSoon', 'later', 'paid'];
const UPCOMING_OPTIONS = [3, 7, 14, 30] as const;

type ViewMode = 'list' | 'calendar';

export function PlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const theme = useTheme();
  const { snapshot, repo } = useWorkspace();
  const month = monthOf(today());
  const [view, setView] = useState<ViewMode>('list');
  const [dueSoonDays, setDueSoonDays] = useState<number>(7);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => (snapshot ? billsForMonth(snapshot, month, today(), dueSoonDays) : null),
    [snapshot, month, dueSoonDays],
  );
  const strip = useMemo(() => (snapshot && rows ? planSummaryStrip(snapshot, month, rows) : null), [snapshot, month, rows]);
  const byDate = useMemo(() => (rows ? rowsByDate(rows) : new Map()), [rows]);
  const suggestions = useMemo(() => (snapshot ? findRecurringSuggestions(snapshot, month) : []), [snapshot, month]);

  const markPaid = async (row: BillRow) => {
    if (!snapshot) return;
    if (row.occurrence?.status === 'paid') {
      toast.show(t('plan.alreadyPaid', { date: formatDay(row.dueDate) }));
      return;
    }
    setError(null);
    const categoryId = row.recurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id;
    const r = await repo.markBillPaid(row.recurring.id, row.dueDate, {
      accountId: row.recurring.accountId,
      categoryId,
      amount: BigInt(row.recurring.amountMinor),
      date: today(),
    });
    if (!r.ok) setError(ledgerMessage(r.error));
  };

  return (
    <AppFrame title={t('plan.title')}>
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
        <Button testID="plan-add" label={t('plan.addBill')} onPress={() => setAddOpen(true)} />
      </View>

      {error ? <InlineError message={error} /> : null}

      {!rows ? (
        <Placeholder height={120} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('plan.emptyTitle')} body={t('plan.emptyBody')} actionLabel={t('plan.addBill')} onAction={() => setAddOpen(true)} />
      ) : view === 'list' ? (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {GROUP_ORDER.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            return (
              <View key={group} style={{ gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm">{t(`plan.group.${group}`)}</Text>
                {groupRows.map((row) => (
                  <BillRowView key={`${row.recurring.id}-${row.dueDate}`} row={row} onMarkPaid={() => void markPaid(row)} />
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <CalendarGrid month={month} today={today()} byDate={byDate} onDay={(d) => setDaySheet(d)} theme={theme} />
      )}

      {addOpen && snapshot ? (
        <AddBillSheet
          snapshot={snapshot}
          onClose={() => setAddOpen(false)}
          onSave={async (data) => {
            setError(null);
            await repo.addRecurring(data);
            setAddOpen(false);
          }}
        />
      ) : null}

      {findOpen && snapshot ? (
        <FindRecurringSheet
          suggestions={suggestions}
          onClose={() => setFindOpen(false)}
          onAdd={async (s) => {
            await repo.addRecurring({
              kind: 'bill',
              name: s.name,
              amountMinor: s.averageMinor.toString(),
              accountId: snapshot.accounts[0]!.id,
              categoryId: snapshot.categories.find((c) => c.kind === 'expense')!.id,
              rule: { every: 'month', on: 1 },
              startDate: today(),
            });
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
            <BillRowView key={`${row.recurring.id}-${row.dueDate}`} row={row} onMarkPaid={() => void markPaid(row)} />
          ))}
          {(byDate.get(daySheet) ?? []).length === 0 ? <Text tone="textSecondary">{t('plan.dayEmpty')}</Text> : null}
        </Sheet>
      ) : null}
    </AppFrame>
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
}: {
  month: string;
  today: string;
  byDate: Map<string, BillRow[]>;
  onDay: (iso: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const days = calendarDays(month);
  return (
    <View testID="plan-calendar" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {days.map((d) => {
        const items = byDate.get(d) ?? [];
        const overdue = items.some((r) => r.group === 'overdue');
        const isToday = d === todayIso;
        return (
          <Pressable
            key={d}
            testID={`plan-cal-${d}`}
            accessibilityRole="button"
            accessibilityLabel={d}
            onPress={() => onDay(d)}
            style={{
              width: '13%',
              minWidth: 40,
              aspectRatio: 1,
              borderWidth: 1,
              borderColor: isToday ? theme.primaryFill : theme.border,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 2,
            }}
          >
            <Text variant="caption">{d.slice(-2)}</Text>
            {items.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                {overdue ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: tokens.color.ruby }} /> : null}
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textSecondary }} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function BillRowView({ row, onMarkPaid }: { row: BillRow; onMarkPaid: () => void }) {
  const paid = row.occurrence?.status === 'paid';
  return (
    <Card testID={`bill-${row.recurring.id}`} style={{ gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading-sm">{row.recurring.name}</Text>
        {row.group === 'overdue' && !paid ? <StatusPill label={t('plan.overdue')} kind="pending" /> : null}
        {paid ? <StatusPill label={t('plan.paid')} kind="done" /> : null}
      </View>
      <Text tone="textSecondary">
        {formatDay(row.dueDate)} · <Amount minor={BigInt(row.recurring.amountMinor)} variant="caption" />
        {row.recurring.approximate ? ` ${t('plan.approximate')}` : ''}
      </Text>
      {paid ? null : <Button testID={`bill-mark-${row.recurring.id}`} kind="secondary" label={t('plan.markPaid')} onPress={onMarkPaid} />}
    </Card>
  );
}

function FindRecurringSheet({
  suggestions,
  onClose,
  onAdd,
}: {
  suggestions: FindRecurringSuggestion[];
  onClose: () => void;
  onAdd: (s: FindRecurringSuggestion) => Promise<void>;
}) {
  return (
    <Sheet visible title={t('plan.findTitle')} onClose={onClose} testID="plan-find-sheet">
      {suggestions.length === 0 ? (
        <Text tone="textSecondary">{t('plan.findEmpty')}</Text>
      ) : (
        suggestions.map((s) => (
          <Card key={s.id} style={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{s.name}</Text>
            <Text tone="textSecondary">
              {t(`plan.confidence.${s.confidence}`)} · <Amount minor={s.averageMinor} variant="caption" />
            </Text>
            <Button testID={`plan-find-add-${s.id}`} kind="secondary" label={t('plan.findAdd')} onPress={() => void onAdd(s)} />
          </Card>
        ))
      )}
    </Sheet>
  );
}

function AddBillSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [day, setDay] = useState('1');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  return (
    <Sheet visible title={t('plan.addBillTitle')} onClose={onClose} testID="plan-add-sheet" footer={
      <Button
        testID="plan-save"
        label={t('panel.save')}
        disabled={!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId || !categoryId}
        onPress={() =>
          void onSave({
            kind: 'bill',
            name: name.trim(),
            amountMinor: amountMinor!.toString(),
            accountId,
            categoryId,
            rule: { every: 'month', on: Math.min(31, Math.max(1, Number(day) || 1)) },
            startDate: today(),
          })
        }
      />
    }>
      <TextInput testID="plan-name" label={t('plan.name')} value={name} onChangeText={setName} />
      <AmountInput testID="plan-amount" label={t('plan.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="plan-account" label={t('plan.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Select testID="plan-category" label={t('plan.category')} options={categories} value={categoryId} onChange={setCategoryId} />
      <TextInput testID="plan-day" label={t('plan.dayOfMonth')} value={day} onChangeText={setDay} keyboardType="number-pad" />
    </Sheet>
  );
}

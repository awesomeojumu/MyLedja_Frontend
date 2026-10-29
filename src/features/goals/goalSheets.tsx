import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GraduationCap, Home, Laptop, PiggyBank, Plane, Target } from 'lucide-react-native';

import {
  AmountInput,
  Button,
  Confirm,
  DatePicker,
  Footer,
  Icon,
  InlineError,
  SegmentedControl,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Goal } from '@/data/workspace/model';
import type { Snapshot, WorkspaceRepository } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { goalProgress, goalSaved, monthlyNeeded, reachesByDate } from './helpers';

type SnapshotNonNull = NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;

const GOAL_ICONS = [
  { key: 'target', icon: Target },
  { key: 'piggy', icon: PiggyBank },
  { key: 'home', icon: Home },
  { key: 'laptop', icon: Laptop },
  { key: 'plane', icon: Plane },
  { key: 'school', icon: GraduationCap },
] as const;

/** PU-31 Add / edit goal — account required, already-saved, live monthly need, icon chips. */
export function AddGoalSheet({
  snapshot,
  existing,
  initialName,
  onClose,
  onSave,
}: {
  snapshot: SnapshotNonNull;
  existing?: Goal;
  initialName?: string;
  onClose: () => void;
  onSave: (input: {
    name: string;
    targetMinor: bigint;
    accountId: string;
    targetDate?: string;
    categoryId?: string;
    icon?: string;
    notes?: string;
    alreadySavedMinor?: bigint;
  }) => Promise<void>;
}) {
  const theme = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(existing?.name ?? initialName ?? '');
  const [amountText, setAmountText] = useState(existing ? formatNaira(BigInt(existing.targetMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(existing ? BigInt(existing.targetMinor) : null);
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'target');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [alreadyText, setAlreadyText] = useState('');
  const [alreadyMinor, setAlreadyMinor] = useState<bigint | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.deleted).map((c) => ({ value: c.id, label: c.name }));
  const categoryOptions = [{ value: '__none__' as const, label: t('goals.noCategory') }, ...categories];

  const monthly = useMemo(() => {
    if (amountMinor === null || amountMinor <= 0n || !targetDate) return null;
    const saved = existing ? goalSaved(existing.id, snapshot) : alreadyMinor ?? 0n;
    return monthlyNeeded(saved, amountMinor, today, targetDate);
  }, [amountMinor, alreadyMinor, existing, snapshot, targetDate, today]);

  const dirty = name !== (existing?.name ?? initialName ?? '') || amountText !== '' || Boolean(accountId) || Boolean(targetDate);
  const valid = Boolean(name.trim() && accountId && amountMinor !== null && amountMinor > 0n && !dateError);

  const requestClose = () => (dirty ? setDiscardOpen(true) : onClose());

  const trySave = () => {
    if (!accountId) {
      setAccountError(t('goals.accountRequired'));
      return;
    }
    if (targetDate && targetDate <= today) {
      setDateError(t('goals.targetDateFuture'));
      return;
    }
    if (!valid || amountMinor === null) return;
    setBusy(true);
    void onSave({
      name: name.trim(),
      targetMinor: amountMinor,
      accountId,
      targetDate: targetDate || undefined,
      categoryId: categoryId && categoryId !== '__none__' ? categoryId : undefined,
      icon,
      notes: notes.trim() || undefined,
      alreadySavedMinor: existing ? undefined : alreadyMinor && alreadyMinor > 0n ? alreadyMinor : undefined,
    }).finally(() => setBusy(false));
  };

  return (
    <>
      <Sheet
        visible
        title={existing ? t('goals.editTitle') : t('goals.addTitle')}
        onClose={requestClose}
        testID="goal-add-sheet"
        footer={
          <Footer>
            <Button kind="secondary" testID="goal-cancel" label={t('common.cancel')} onPress={requestClose} />
            <Button
              testID="goal-save"
              label={existing ? t('panel.save') : t('goals.add')}
              disabled={!name.trim() || !accountId || amountMinor === null || amountMinor <= 0n || busy}
              onPress={trySave}
            />
          </Footer>
        }
      >
        <View style={{ gap: spGap() }}>
          <TextInput testID="goal-name" label={t('goals.name')} value={name} onChangeText={setName} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing['spacing-sm'] }}>
            {GOAL_ICONS.map((item) => (
              <Pressable
                key={item.key}
                testID={`goal-icon-${item.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: icon === item.key }}
                onPress={() => setIcon(item.key)}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: tokens.radius['rounded-md'] ?? 8,
                  borderWidth: icon === item.key ? 2 : 1,
                  borderColor: icon === item.key ? theme.primaryFill : theme.border,
                }}
              >
                <Icon icon={item.icon} size="nav" color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>
          <AmountInput
            testID="goal-target"
            label={t('goals.target')}
            value={amountText}
            onChange={(text, minor) => {
              setAmountText(text);
              setAmountMinor(minor);
            }}
          />
          <Select
            testID="goal-account"
            label={t('goals.account')}
            options={accounts}
            value={accountId}
            onChange={(v) => {
              setAccountId(v);
              setAccountError(null);
            }}
          />
          {accountError ? <InlineError testID="goal-account-error" message={accountError} /> : null}
          <Select
            testID="goal-category"
            label={t('goals.budgetCategory')}
            options={categoryOptions}
            value={categoryId || '__none__'}
            onChange={(v) => setCategoryId(v === '__none__' ? '' : v)}
          />
          <DatePicker
            testID="goal-date"
            label={t('goals.targetDate')}
            value={targetDate || today}
            onChange={(v) => {
              setTargetDate(v);
              setDateError(v <= today ? t('goals.targetDateFuture') : null);
            }}
          />
          {dateError ? <InlineError testID="goal-date-error" message={dateError} /> : null}
          {!existing ? (
            <AmountInput
              testID="goal-already-saved"
              label={t('goals.alreadySaved')}
              value={alreadyText}
              onChange={(text, minor) => {
                setAlreadyText(text);
                setAlreadyMinor(minor);
              }}
            />
          ) : null}
          {monthly !== null ? (
            <Text testID="goal-monthly-needed" tone="textSecondary">
              {t('goals.perMonth', { amount: formatNaira(monthly) })}
              {targetDate ? ` · ${t('goals.byDate', { date: targetDate })}` : ''}
            </Text>
          ) : null}
          <TextInput testID="goal-notes" label={t('goals.notesOptional')} value={notes} onChangeText={setNotes} multiline />
        </View>
      </Sheet>
      <Confirm
        visible={discardOpen}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

function spGap() {
  return tokens.spacing['spacing-md'];
}

/** PU-32 Add money (allocate) — before→after preview, transfer caption when from ≠ goal account. */
export function AllocateSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: SnapshotNonNull;
  onClose: () => void;
  onSave: (amount: bigint, date: string, fromAccountId?: string) => Promise<void>;
}) {
  const toast = useToast();
  const scheduleDefault = goal.scheduleAmountMinor ? BigInt(goal.scheduleAmountMinor) : null;
  const [amountText, setAmountText] = useState(scheduleDefault ? formatNaira(scheduleDefault) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(scheduleDefault);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromId, setFromId] = useState(goal.accountId);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const saved = goalSaved(goal.id, snapshot);
  const target = BigInt(goal.targetMinor);
  const preview = useMemo(() => {
    if (amountMinor === null || amountMinor <= 0n) return null;
    const before = Math.round(goalProgress(saved, target) * 100);
    const after = Math.round(goalProgress(saved + amountMinor, target) * 100);
    return { before, after };
  }, [amountMinor, saved, target]);
  const fromOther = fromId !== goal.accountId;
  const dirty = amountText !== '' || fromId !== goal.accountId;
  const valid = amountMinor !== null && amountMinor > 0n;

  return (
    <>
      <Sheet
        visible
        title={t('goals.allocateTitle')}
        onClose={() => (dirty ? setDiscardOpen(true) : onClose())}
        testID="goal-allocate-sheet"
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={() => (dirty ? setDiscardOpen(true) : onClose())} />
            <Button
              testID="goal-allocate-save"
              label={t('goals.addMoney')}
              disabled={!valid || busy}
              onPress={async () => {
                if (!valid || amountMinor === null) return;
                setBusy(true);
                try {
                  await onSave(amountMinor, date, fromOther ? fromId : undefined);
                  toast.show(t('goals.allocateSavedNamed', { amount: formatNaira(amountMinor), name: goal.name }));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Footer>
        }
      >
        <Text tone="textSecondary">{t('goals.allocateCaption')}</Text>
        {fromOther ? (
          <Text testID="goal-allocate-transfer-caption" tone="textSecondary">
            {t('goals.allocateTransferCaption')}
          </Text>
        ) : null}
        <AmountInput
          testID="goal-allocate-amount"
          label={t('add.amount')}
          value={amountText}
          onChange={(text, minor) => {
            setAmountText(text);
            setAmountMinor(minor);
          }}
        />
        <DatePicker testID="goal-allocate-date" label={t('add.date')} value={date} onChange={setDate} />
        <Select testID="goal-from-account" label={t('goals.fromAccount')} options={accounts} value={fromId} onChange={setFromId} />
        {preview !== null ? (
          <Text variant="caption" tone="textSecondary" testID="goal-allocate-preview">
            {t('goals.allocatePreviewRange', { before: String(preview.before), after: String(preview.after) })}
          </Text>
        ) : null}
      </Sheet>
      <Confirm
        visible={discardOpen}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  );
}

/** PU-33 Goal schedule — weekly/monthly, reaches-by line, auto-allocate switch. */
export function GoalScheduleSheet({
  goal,
  snapshot,
  repo,
  onClose,
}: {
  goal: Goal;
  snapshot: Snapshot;
  repo: WorkspaceRepository;
  onClose: () => void;
}) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [amountText, setAmountText] = useState(goal.scheduleAmountMinor ? formatNaira(BigInt(goal.scheduleAmountMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(goal.scheduleAmountMinor ? BigInt(goal.scheduleAmountMinor) : null);
  const [every, setEvery] = useState<'week' | 'month'>(goal.scheduleEvery ?? 'month');
  const [day, setDay] = useState(goal.scheduleDayOfMonth ? String(goal.scheduleDayOfMonth) : String(new Date().getUTCDate()));
  const [starts, setStarts] = useState(goal.scheduleStarts ?? today);
  const [autoAllocate, setAutoAllocate] = useState(goal.scheduleAutoAllocate ?? false);
  const [busy, setBusy] = useState(false);

  const saved = goalSaved(goal.id, snapshot);
  const target = BigInt(goal.targetMinor);
  const reaches = amountMinor && amountMinor > 0n ? reachesByDate(saved, target, amountMinor, every, starts) : null;

  return (
    <Sheet
      visible
      title={t('goals.schedulePopupTitle')}
      onClose={onClose}
      testID="goal-schedule-sheet"
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="goal-schedule-save"
            label={t('goals.scheduleSave')}
            disabled={amountMinor === null || amountMinor <= 0n || !day.trim() || busy}
            onPress={() => {
              if (amountMinor === null) return;
              setBusy(true);
              void repo
                .updateGoal({
                  ...goal,
                  scheduleAmountMinor: amountMinor.toString(),
                  scheduleDayOfMonth: Math.min(31, Math.max(1, Number(day) || 1)),
                  scheduleEvery: every,
                  scheduleStarts: starts,
                  scheduleAutoAllocate: autoAllocate,
                })
                .then(() => {
                  toast.show(t('goals.scheduleSaved'));
                  onClose();
                })
                .finally(() => setBusy(false));
            }}
          />
        </Footer>
      }
    >
      <AmountInput
        testID="goal-schedule-amount"
        label={t('goals.scheduleAmount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <SegmentedControl
        testID="goal-schedule-every"
        label={t('goals.scheduleEvery')}
        value={every}
        onChange={setEvery}
        options={[
          { value: 'week', label: t('goals.scheduleWeekly') },
          { value: 'month', label: t('goals.scheduleMonthly') },
        ]}
      />
      <TextInput testID="goal-schedule-day" label={t('goals.scheduleDay')} value={day} onChangeText={setDay} keyboardType="number-pad" />
      <DatePicker testID="goal-schedule-starts" label={t('goals.scheduleStarts')} value={starts} onChange={setStarts} />
      <Switch testID="goal-schedule-auto" label={t('goals.scheduleAuto')} value={autoAllocate} onChange={setAutoAllocate} />
      {reaches ? (
        <Text testID="goal-schedule-reaches" tone="textSecondary">
          {t('goals.scheduleReaches', { amount: formatNaira(target), date: reaches })}
        </Text>
      ) : (
        <Text tone="textSecondary">{t('goals.scheduleHint')}</Text>
      )}
    </Sheet>
  );
}

export function SpendFromGoalSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: { accountId: string; categoryId: string; amount: bigint; date: string }) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(goal.accountId);
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  return (
    <Sheet
      visible
      title={t('goals.spendTitle')}
      onClose={onClose}
      testID="goal-spend-sheet"
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="goal-spend-save"
            label={t('panel.save')}
            disabled={amountMinor === null || amountMinor <= 0n || !categoryId}
            onPress={() => void onSave({ accountId, categoryId, amount: amountMinor!, date })}
          />
        </Footer>
      }
    >
      <Text tone="textSecondary">{t('goals.spendCaption')}</Text>
      <AmountInput
        testID="goal-spend-amount"
        label={t('add.amount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <DatePicker testID="goal-spend-date" label={t('add.date')} value={date} onChange={setDate} />
      <Select testID="goal-spend-category" label={t('goals.spendCategory')} options={categories} value={categoryId} onChange={setCategoryId} />
      <Select testID="goal-spend-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}

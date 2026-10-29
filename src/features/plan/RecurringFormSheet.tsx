import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  AmountInput,
  Button,
  Confirm,
  Footer,
  SegmentedControl,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type { RecurrenceRule, Recurring, RecurringKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf, nextMonth } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { toInputText } from '@/money';

import { dueDatesInMonth } from './recurrence';

const sp = tokens.spacing;

const REMINDER_OPTIONS = ['off', '0', '1', '3', '7'] as const;
type EndMode = 'never' | 'onDate' | 'afterCount';
type FreqMode = 'week' | 'month' | 'year' | 'custom';
type AmountMode = 'exact' | 'about';

function endDateAfterOccurrences(start: string, rule: RecurrenceRule, count: number): string {
  let month = monthOf(start);
  let seen = 0;
  for (let i = 0; i < 240 && seen < count; i++) {
    for (const d of dueDatesInMonth(rule, month, start)) {
      seen += 1;
      if (seen === count) return d;
    }
    month = nextMonth(month);
  }
  return start;
}

/** PU-25 — Add / edit recurring (bill · subscription · transfer). */
export function RecurringFormSheet({
  snapshot,
  existing,
  initialKind = 'bill',
  visible,
  onClose,
  onSave,
  onDelete,
  onCancelSchedule,
  onRestoreSchedule,
  onChooseIncome,
}: {
  snapshot: Snapshot;
  existing?: Recurring | null;
  initialKind?: RecurringKind;
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancelSchedule?: () => Promise<void>;
  onRestoreSchedule?: () => Promise<void>;
  /** Choosing Income switches to PU-29. */
  onChooseIncome?: () => void;
}) {
  const [kind, setKind] = useState<RecurringKind>('bill');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [amountMode, setAmountMode] = useState<AmountMode>('exact');
  const [payeeId, setPayeeId] = useState('');
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState('');
  const [toError, setToError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [freqMode, setFreqMode] = useState<FreqMode>('month');
  const [everyN, setEveryN] = useState('1');
  const [customUnit, setCustomUnit] = useState<'day' | 'week' | 'month'>('week');
  const [lastDayOfMonth, setLastDayOfMonth] = useState(false);
  const [onDay, setOnDay] = useState(String(Number(today().slice(8, 10))));
  const [monthOfYear, setMonthOfYear] = useState(String(Number(today().slice(5, 7))));
  const [startDate, setStartDate] = useState(today());
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [endDate, setEndDate] = useState('');
  const [endAfterCount, setEndAfterCount] = useState('6');
  const [autoCreate, setAutoCreate] = useState(false);
  const [reminder, setReminder] = useState<(typeof REMINDER_OPTIONS)[number]>('1');
  const [hideAmountOnLock, setHideAmountOnLock] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const markDirty = () => setDirty(true);

  const openKey = visible ? `${existing?.id ?? 'new'}:${initialKind}` : null;
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey) {
      setDirty(false);
      setNameError(null);
      setToError(null);
      setSaving(false);
      if (existing) {
        setKind(existing.kind === 'income' ? 'bill' : existing.kind);
        setName(existing.name);
        setAmountMode(existing.approximate ? 'about' : 'exact');
        setPayeeId(existing.payeeId ?? '');
        setAccountId(existing.accountId);
        setToAccountId(existing.toAccountId ?? '');
        setCategoryId(existing.categoryId ?? '');
        const interval = existing.rule.interval ?? 1;
        if (existing.rule.every === 'year') setFreqMode('year');
        else if (existing.rule.every === 'week' && interval === 1) setFreqMode('week');
        else if (existing.rule.every === 'month' && interval === 1) setFreqMode('month');
        else {
          setFreqMode('custom');
          const unit = existing.rule.every === 'day' || existing.rule.every === 'week' ? existing.rule.every : 'month';
          setCustomUnit(unit);
        }
        setEveryN(String(interval));
        setLastDayOfMonth(existing.rule.every === 'month' && existing.rule.on === 31);
        setOnDay(String(existing.rule.every === 'month' && existing.rule.on === 31 ? 1 : existing.rule.on));
        setMonthOfYear(String(existing.rule.monthOfYear ?? Number(existing.startDate.slice(5, 7))));
        setStartDate(existing.startDate);
        setEndMode(existing.endAfterCount ? 'afterCount' : existing.endDate ? 'onDate' : 'never');
        setEndDate(existing.endDate ?? '');
        setEndAfterCount(String(existing.endAfterCount ?? 6));
        setAutoCreate(!!existing.autoCreate);
        setReminder(existing.reminderDays === undefined ? 'off' : (String(existing.reminderDays) as (typeof REMINDER_OPTIONS)[number]));
        setHideAmountOnLock(existing.hideAmountOnLock !== false);
        setAmountMinor(BigInt(existing.amountMinor));
        setAmountText(toInputText(BigInt(existing.amountMinor)));
      } else {
        setKind(initialKind === 'income' ? 'bill' : initialKind);
        setName('');
        setAmountText('');
        setAmountMinor(null);
        setAmountMode('exact');
        setPayeeId('');
        setToAccountId('');
        setFreqMode('month');
        setEveryN('1');
        setLastDayOfMonth(false);
        setOnDay(String(Number(today().slice(8, 10))));
        setStartDate(today());
        setEndMode('never');
        setEndDate('');
        setEndAfterCount('6');
        setAutoCreate(false);
        setReminder('1');
        setHideAmountOnLock(true);
      }
    }
  }

  const accounts = useMemo(
    () => snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
    [snapshot],
  );
  const payees = useMemo(
    () => [{ value: '', label: t('plan.payeeNone') }, ...snapshot.payees.map((p) => ({ value: p.id, label: p.name }))],
    [snapshot],
  );
  const categories = useMemo(
    () => snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name })),
    [snapshot],
  );

  const dayCaption =
    freqMode === 'month' && !lastDayOfMonth && Number(onDay) >= 29
      ? t('plan.shortMonthCaption')
      : null;

  const buildRule = (): RecurrenceRule => {
    if (freqMode === 'week') return { every: 'week', on: Math.min(6, Math.max(0, Number(onDay) || 0)), interval: 1 };
    if (freqMode === 'year') {
      return {
        every: 'year',
        on: Math.min(31, Math.max(1, Number(onDay) || 1)),
        monthOfYear: Math.min(12, Math.max(1, Number(monthOfYear) || 1)),
        interval: 1,
      };
    }
    if (freqMode === 'custom') {
      const interval = Math.max(1, Number(everyN) || 1);
      if (customUnit === 'day') return { every: 'day', on: 0, interval };
      if (customUnit === 'week') return { every: 'week', on: Math.min(6, Math.max(0, Number(onDay) || 0)), interval };
      const day = lastDayOfMonth ? 31 : Math.min(31, Math.max(1, Number(onDay) || 1));
      return { every: 'month', on: day, interval };
    }
    const day = lastDayOfMonth ? 31 : Math.min(31, Math.max(1, Number(onDay) || 1));
    return { every: 'month', on: day, interval: 1 };
  };

  const valid =
    name.trim().length > 0 &&
    amountMinor !== null &&
    amountMinor > 0n &&
    !!accountId &&
    (kind !== 'transfer' || (!!toAccountId && toAccountId !== accountId)) &&
    !existing?.cancelled;

  const requestClose = () => {
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  const save = () => {
    if (!name.trim()) {
      setNameError(t('errors.workspaceNameRequired'));
      return;
    }
    if (kind === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setToError(t('plan.transferSameAccount'));
      return;
    }
    if (!valid || amountMinor === null || saving) return;
    const rule = buildRule();
    let resolvedEnd: string | undefined;
    let resolvedAfter: number | undefined;
    if (endMode === 'onDate') resolvedEnd = endDate.trim() || undefined;
    else if (endMode === 'afterCount') {
      const n = Math.max(1, Number(endAfterCount) || 1);
      resolvedAfter = n;
      resolvedEnd = endDateAfterOccurrences(startDate, rule, n);
    }
    setSaving(true);
    void onSave({
      kind,
      name: name.trim(),
      amountMinor: amountMinor.toString(),
      approximate: amountMode === 'about',
      payeeId: payeeId || undefined,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      categoryId: kind === 'transfer' ? undefined : categoryId,
      rule,
      startDate,
      endDate: resolvedEnd,
      endAfterCount: resolvedAfter,
      autoCreate,
      reminderDays: reminder === 'off' ? undefined : Number(reminder),
      hideAmountOnLock,
      paused: existing?.paused,
      cancelled: existing?.cancelled,
    })
      .then(onClose)
      .finally(() => setSaving(false));
  };

  const primaryLabel = existing ? t('plan.saveChanges') : kind === 'subscription' ? t('plan.addSubscription') : kind === 'transfer' ? t('plan.addTransfer') : t('plan.addBill');

  return (
    <>
      <Sheet
        visible={visible}
        title={existing ? t('plan.editRecurringTitle') : t('plan.addRecurringTitle')}
        onClose={requestClose}
        testID="plan-recurring-sheet"
        footer={
          <Footer>
            <Button testID="plan-recurring-cancel" kind="secondary" label={t('common.cancel')} onPress={requestClose} />
            <Button testID="plan-recurring-save" label={primaryLabel} onPress={save} disabled={!valid || saving} />
          </Footer>
        }
      >
        <SegmentedControl
          testID="plan-recurring-kind"
          label={t('plan.recurringKind')}
          value={kind}
          onChange={(v) => {
            if (v === 'income') {
              onChooseIncome?.();
              return;
            }
            markDirty();
            setKind(v as RecurringKind);
          }}
          options={[
            { value: 'bill', label: t('plan.kind.bill') },
            { value: 'subscription', label: t('plan.kind.subscription') },
            { value: 'transfer', label: t('plan.kind.transfer') },
            ...(onChooseIncome ? [{ value: 'income' as const, label: t('plan.kind.income') }] : []),
          ]}
        />
        <TextInput
          testID="plan-name"
          label={t('plan.name')}
          value={name}
          error={nameError}
          onChangeText={(v) => {
            markDirty();
            setName(v);
            setNameError(null);
          }}
          onBlur={() => {
            if (!name.trim()) setNameError(t('errors.workspaceNameRequired'));
          }}
        />
        <Select
          testID="plan-payee"
          label={t('plan.payee')}
          value={payeeId}
          onChange={(v) => {
            markDirty();
            setPayeeId(v);
            const payee = snapshot.payees.find((p) => p.id === v);
            if (payee && !name.trim()) setName(payee.name);
          }}
          options={payees}
        />
        <AmountInput
          testID="plan-amount"
          label={t('plan.amount')}
          value={amountText}
          onChange={(text, minor) => {
            markDirty();
            setAmountText(text);
            setAmountMinor(minor);
          }}
        />
        <SegmentedControl
          testID="plan-amount-mode"
          label={t('plan.amountExactAbout')}
          value={amountMode}
          onChange={(v) => {
            markDirty();
            setAmountMode(v);
          }}
          options={[
            { value: 'exact', label: t('plan.amountExact') },
            { value: 'about', label: t('plan.amountAbout') },
          ]}
        />
        <Select
          testID="plan-account"
          label={kind === 'transfer' ? t('plan.accountFrom') : t('plan.account')}
          options={accounts}
          value={accountId}
          onChange={(v) => {
            markDirty();
            setAccountId(v);
            setToError(null);
          }}
        />
        {kind === 'transfer' ? (
          <Select
            testID="plan-account-to"
            label={t('plan.accountTo')}
            options={accounts}
            value={toAccountId}
            onChange={(v) => {
              markDirty();
              setToAccountId(v);
              setToError(null);
            }}
          />
        ) : null}
        {toError ? (
          <Text variant="caption" accessibilityRole="alert" testID="plan-to-error">
            {toError}
          </Text>
        ) : null}
        {kind !== 'transfer' ? (
          <Select
            testID="plan-category"
            label={t('plan.category')}
            options={categories}
            value={categoryId}
            onChange={(v) => {
              markDirty();
              setCategoryId(v);
            }}
          />
        ) : null}
        <SegmentedControl
          testID="plan-frequency"
          label={t('plan.howOften')}
          value={freqMode}
          onChange={(v) => {
            markDirty();
            setFreqMode(v);
          }}
          options={[
            { value: 'week', label: t('plan.freqWeeklyShort') },
            { value: 'month', label: t('plan.freqMonthlyShort') },
            { value: 'year', label: t('plan.freqYearlyShort') },
            { value: 'custom', label: t('plan.freqCustom') },
          ]}
        />
        {freqMode === 'custom' ? (
          <View style={{ gap: sp['spacing-sm'] }}>
            <TextInput
              testID="plan-every-n"
              label={t('plan.everyN')}
              value={everyN}
              onChangeText={(v) => {
                markDirty();
                setEveryN(v);
              }}
              keyboardType="number-pad"
            />
            <SegmentedControl
              testID="plan-custom-unit"
              label={t('plan.customUnit')}
              value={customUnit}
              onChange={(v) => {
                markDirty();
                setCustomUnit(v);
              }}
              options={[
                { value: 'day', label: t('plan.freqUnitDay') },
                { value: 'week', label: t('plan.freqUnitWeek') },
                { value: 'month', label: t('plan.freqUnitMonth') },
              ]}
            />
          </View>
        ) : null}
        {freqMode === 'month' || (freqMode === 'custom' && customUnit === 'month') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{t('plan.lastDayOfMonth')}</Text>
            <Switch
              testID="plan-last-day"
              label={t('plan.lastDayOfMonth')}
              value={lastDayOfMonth}
              onChange={(v) => {
                markDirty();
                setLastDayOfMonth(v);
              }}
            />
          </View>
        ) : null}
        {freqMode === 'year' ? (
          <TextInput
            testID="plan-month-of-year"
            label={t('plan.monthOfYear')}
            value={monthOfYear}
            onChangeText={(v) => {
              markDirty();
              setMonthOfYear(v);
            }}
            keyboardType="number-pad"
          />
        ) : null}
        {(freqMode === 'month' && !lastDayOfMonth) ||
        freqMode === 'week' ||
        freqMode === 'year' ||
        (freqMode === 'custom' && customUnit !== 'day' && !(customUnit === 'month' && lastDayOfMonth)) ? (
          <TextInput
            testID="plan-day"
            label={freqMode === 'week' || (freqMode === 'custom' && customUnit === 'week') ? t('plan.dayOfWeek') : t('plan.dayOfMonth')}
            value={onDay}
            caption={dayCaption ?? undefined}
            onChangeText={(v) => {
              markDirty();
              setOnDay(v);
            }}
            keyboardType="number-pad"
          />
        ) : null}
        <TextInput
          testID="plan-start"
          label={t('plan.startDate')}
          value={startDate}
          onChangeText={(v) => {
            markDirty();
            setStartDate(v);
          }}
        />
        <SegmentedControl
          testID="plan-end-mode"
          label={t('plan.endMode')}
          value={endMode}
          onChange={(v) => {
            markDirty();
            setEndMode(v);
          }}
          options={[
            { value: 'never', label: t('plan.endNever') },
            { value: 'afterCount', label: t('plan.endAfter') },
            { value: 'onDate', label: t('plan.endOnDate') },
          ]}
        />
        {endMode === 'onDate' ? (
          <TextInput
            testID="plan-end"
            label={t('plan.endDate')}
            value={endDate}
            onChangeText={(v) => {
              markDirty();
              setEndDate(v);
            }}
          />
        ) : null}
        {endMode === 'afterCount' ? (
          <TextInput
            testID="plan-end-count"
            label={t('plan.endAfterCount')}
            value={endAfterCount}
            onChangeText={(v) => {
              markDirty();
              setEndAfterCount(v);
            }}
            keyboardType="number-pad"
          />
        ) : null}
        <View style={{ gap: sp['spacing-xxs'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{t('plan.autoCreate')}</Text>
            <Switch
              testID="plan-auto-create"
              label={t('plan.autoCreate')}
              value={autoCreate}
              onChange={(v) => {
                markDirty();
                setAutoCreate(v);
              }}
            />
          </View>
          {autoCreate ? (
            <Text variant="caption" tone="textSecondary">
              {t('plan.autoCreateCaption')}
            </Text>
          ) : null}
        </View>
        <Select
          testID="plan-reminder"
          label={t('plan.reminder')}
          value={reminder}
          onChange={(v) => {
            markDirty();
            setReminder(v as (typeof REMINDER_OPTIONS)[number]);
          }}
          options={REMINDER_OPTIONS.map((d) => ({
            value: d,
            label:
              d === 'off'
                ? t('plan.reminderOff')
                : d === '0'
                  ? t('plan.reminderOnDay')
                  : t('plan.reminderDaysBefore', { days: d }),
          }))}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>{t('plan.hideAmountLock')}</Text>
          <Switch
            testID="plan-hide-amount"
            label={t('plan.hideAmountLock')}
            value={hideAmountOnLock}
            onChange={(v) => {
              markDirty();
              setHideAmountOnLock(v);
            }}
          />
        </View>
        {existing && onDelete ? (
          <Button testID="plan-recurring-delete" kind="link" label={t('plan.deleteBill')} onPress={() => setDeleteOpen(true)} />
        ) : null}
        {existing && !existing.cancelled && onCancelSchedule ? (
          <Button testID="plan-recurring-cancel-schedule" kind="link" label={t('plan.cancelSchedule')} onPress={() => void onCancelSchedule().then(onClose)} />
        ) : null}
        {existing?.cancelled && onRestoreSchedule ? (
          <Button testID="plan-recurring-restore" kind="link" label={t('plan.restoreSchedule')} onPress={() => void onRestoreSchedule().then(onClose)} />
        ) : null}
      </Sheet>

      <Confirm
        visible={discardOpen}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
      <Confirm
        visible={deleteOpen}
        title={t('plan.deleteBillTitle', { name: existing?.name ?? '' })}
        body={t('plan.deleteBillBody')}
        confirmLabel={t('plan.deleteBill')}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void onDelete?.().then(onClose);
        }}
      />
    </>
  );
}

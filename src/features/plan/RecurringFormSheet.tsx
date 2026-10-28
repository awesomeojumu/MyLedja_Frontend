import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Select, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { RecurrenceRule, Recurring, RecurringKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf, nextMonth } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { toInputText } from '@/money';

import { dueDatesInMonth } from './recurrence';

const sp = tokens.spacing;

const KINDS: RecurringKind[] = ['bill', 'subscription', 'transfer'];
const REMINDER_OPTIONS = [0, 1, 3, 7] as const;
type EndMode = 'never' | 'onDate' | 'afterCount';

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

/** DESIGN popup #25 — Add / edit recurring. */
export function RecurringFormSheet({
  snapshot,
  existing,
  initialKind = 'bill',
  visible,
  onClose,
  onSave,
  onCancelSchedule,
  onRestoreSchedule,
}: {
  snapshot: Snapshot;
  existing?: Recurring | null;
  initialKind?: RecurringKind;
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
  onCancelSchedule?: () => Promise<void>;
  onRestoreSchedule?: () => Promise<void>;
}) {
  const [kind, setKind] = useState<RecurringKind>('bill');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [approximate, setApproximate] = useState(false);
  const [payeeId, setPayeeId] = useState('');
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [every, setEvery] = useState<RecurrenceRule['every']>('month');
  const [everyN, setEveryN] = useState('1');
  const [lastDayOfMonth, setLastDayOfMonth] = useState(false);
  const [onDay, setOnDay] = useState('1');
  const [monthOfYear, setMonthOfYear] = useState('1');
  const [startDate, setStartDate] = useState(today());
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [endDate, setEndDate] = useState('');
  const [endAfterCount, setEndAfterCount] = useState('12');
  const [autoCreate, setAutoCreate] = useState(false);
  const [reminderDays, setReminderDays] = useState<number>(0);
  const [hideAmountOnLock, setHideAmountOnLock] = useState(true);

  // Fill the form when it opens, or when it switches to another item.
  const openKey = visible ? `${existing?.id ?? 'new'}:${initialKind}` : null;
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey) {
      if (existing) {
        setKind(existing.kind);
        setName(existing.name);
        setApproximate(!!existing.approximate);
        setPayeeId(existing.payeeId ?? '');
        setAccountId(existing.accountId);
        setCategoryId(existing.categoryId ?? '');
        setEvery(existing.rule.every);
        setEveryN(String(existing.rule.interval ?? 1));
        setLastDayOfMonth(existing.rule.every === 'month' && existing.rule.on === 31);
        setOnDay(String(existing.rule.every === 'month' && existing.rule.on === 31 ? 1 : existing.rule.on));
        setMonthOfYear(String(existing.rule.monthOfYear ?? Number(existing.startDate.slice(5, 7))));
        setStartDate(existing.startDate);
        setEndMode(existing.endAfterCount ? 'afterCount' : existing.endDate ? 'onDate' : 'never');
        setEndDate(existing.endDate ?? '');
        setEndAfterCount(String(existing.endAfterCount ?? 12));
        setAutoCreate(!!existing.autoCreate);
        setReminderDays(existing.reminderDays ?? 0);
        setHideAmountOnLock(existing.hideAmountOnLock !== false);
        setAmountMinor(BigInt(existing.amountMinor));
        setAmountText(toInputText(BigInt(existing.amountMinor)));
      } else {
        setKind(initialKind);
        setEndMode('never');
        setEndDate('');
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

  const buildRule = (): RecurrenceRule => {
    const interval = Math.max(1, Number(everyN) || 1);
    if (every === 'day') return { every: 'day', on: 0, interval };
    if (every === 'week') return { every: 'week', on: Math.min(6, Math.max(0, Number(onDay) || 0)), interval };
    if (every === 'year') {
      return {
        every: 'year',
        on: Math.min(31, Math.max(1, Number(onDay) || 1)),
        monthOfYear: Math.min(12, Math.max(1, Number(monthOfYear) || 1)),
        interval,
      };
    }
    const day = lastDayOfMonth ? 31 : Math.min(31, Math.max(1, Number(onDay) || 1));
    return { every: 'month', on: day, interval };
  };

  const save = () => {
    if (!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId) return;
    const rule = buildRule();
    let resolvedEnd: string | undefined;
    let resolvedAfter: number | undefined;
    if (endMode === 'onDate') resolvedEnd = endDate.trim() || undefined;
    else if (endMode === 'afterCount') {
      const n = Math.max(1, Number(endAfterCount) || 1);
      resolvedAfter = n;
      resolvedEnd = endDateAfterOccurrences(startDate, rule, n);
    }
    void onSave({
      kind,
      name: name.trim(),
      amountMinor: amountMinor.toString(),
      approximate,
      payeeId: payeeId || undefined,
      accountId,
      categoryId: kind === 'transfer' ? undefined : categoryId,
      rule,
      startDate,
      endDate: resolvedEnd,
      endAfterCount: resolvedAfter,
      autoCreate,
      reminderDays,
      hideAmountOnLock,
    }).then(onClose);
  };

  return (
    <Sheet
      visible={visible}
      title={existing ? t('plan.editRecurringTitle') : t('plan.addRecurringTitle')}
      onClose={onClose}
      testID="plan-recurring-sheet"
      footer={
        <View style={{ gap: sp['spacing-sm'] }}>
          {existing && !existing.cancelled && onCancelSchedule ? (
            <Button testID="plan-recurring-cancel" kind="secondary" label={t('plan.cancelSchedule')} onPress={() => void onCancelSchedule().then(onClose)} />
          ) : null}
          {existing?.cancelled && onRestoreSchedule ? (
            <Button testID="plan-recurring-restore" kind="secondary" label={t('plan.restoreSchedule')} onPress={() => void onRestoreSchedule().then(onClose)} />
          ) : null}
          <Button testID="plan-recurring-save" label={t('panel.save')} onPress={save} disabled={!name.trim() || amountMinor === null || amountMinor <= 0n || !!existing?.cancelled} />
        </View>
      }
    >
      <Select
        testID="plan-recurring-kind"
        label={t('plan.recurringKind')}
        value={kind}
        onChange={(v) => setKind(v as RecurringKind)}
        options={KINDS.map((k) => ({ value: k, label: t(`plan.kind.${k}`) }))}
      />
      <TextInput testID="plan-name" label={t('plan.name')} value={name} onChangeText={setName} />
      <Select testID="plan-payee" label={t('plan.payee')} value={payeeId} onChange={setPayeeId} options={payees} />
      <AmountInput testID="plan-amount" label={t('plan.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('plan.amountApproximate')}</Text>
        <Switch testID="plan-approximate" label={t('plan.amountApproximate')} value={approximate} onChange={setApproximate} />
      </View>
      <Select testID="plan-account" label={t('plan.account')} options={accounts} value={accountId} onChange={setAccountId} />
      {kind !== 'transfer' ? (
        <Select testID="plan-category" label={t('plan.category')} options={categories} value={categoryId} onChange={setCategoryId} />
      ) : null}
      <Select
        testID="plan-frequency"
        label={t('plan.howOften')}
        value={every}
        onChange={(v) => setEvery(v as RecurrenceRule['every'])}
        options={[
          { value: 'day', label: t('plan.freqUnitDay') },
          { value: 'week', label: t('plan.freqUnitWeek') },
          { value: 'month', label: t('plan.freqUnitMonth') },
          { value: 'year', label: t('plan.freqUnitYear') },
        ]}
      />
      {every !== 'year' ? (
        <TextInput testID="plan-every-n" label={t('plan.everyN')} value={everyN} onChangeText={setEveryN} keyboardType="number-pad" />
      ) : null}
      {every === 'month' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>{t('plan.lastDayOfMonth')}</Text>
          <Switch testID="plan-last-day" label={t('plan.lastDayOfMonth')} value={lastDayOfMonth} onChange={setLastDayOfMonth} />
        </View>
      ) : null}
      {every === 'year' ? (
        <TextInput testID="plan-month-of-year" label={t('plan.monthOfYear')} value={monthOfYear} onChangeText={setMonthOfYear} keyboardType="number-pad" />
      ) : null}
      {(every === 'month' && !lastDayOfMonth) || every === 'week' || every === 'year' ? (
        <TextInput
          testID="plan-day"
          label={every === 'week' ? t('plan.dayOfWeek') : t('plan.dayOfMonth')}
          value={onDay}
          onChangeText={setOnDay}
          keyboardType="number-pad"
        />
      ) : null}
      <TextInput testID="plan-start" label={t('plan.startDate')} value={startDate} onChangeText={setStartDate} />
      <Select
        testID="plan-end-mode"
        label={t('plan.endMode')}
        value={endMode}
        onChange={(v) => setEndMode(v as EndMode)}
        options={[
          { value: 'never', label: t('plan.endNever') },
          { value: 'afterCount', label: t('plan.endAfter') },
          { value: 'onDate', label: t('plan.endOnDate') },
        ]}
      />
      {endMode === 'onDate' ? (
        <TextInput testID="plan-end" label={t('plan.endDate')} value={endDate} onChangeText={setEndDate} />
      ) : null}
      {endMode === 'afterCount' ? (
        <TextInput testID="plan-end-count" label={t('plan.endAfterCount')} value={endAfterCount} onChangeText={setEndAfterCount} keyboardType="number-pad" />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('plan.autoCreate')}</Text>
        <Switch testID="plan-auto-create" label={t('plan.autoCreate')} value={autoCreate} onChange={setAutoCreate} />
      </View>
      <Select
        testID="plan-reminder"
        label={t('plan.reminder')}
        value={String(reminderDays)}
        onChange={(v) => setReminderDays(Number(v))}
        options={REMINDER_OPTIONS.map((d) => ({
          value: String(d),
          label: d === 0 ? t('plan.reminderOnDay') : t('plan.reminderDaysBefore', { days: d }),
        }))}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('plan.hideAmountLock')}</Text>
        <Switch testID="plan-hide-amount" label={t('plan.hideAmountLock')} value={hideAmountOnLock} onChange={setHideAmountOnLock} />
      </View>
    </Sheet>
  );
}

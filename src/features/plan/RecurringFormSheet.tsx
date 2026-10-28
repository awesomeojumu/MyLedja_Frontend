import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Select, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Recurring, RecurringKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { monthOf, nextMonth } from '@/ledger';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { dueDateInMonth } from './recurrence';

const sp = tokens.spacing;

const KINDS: RecurringKind[] = ['bill', 'subscription', 'transfer'];
const REMINDER_OPTIONS = [0, 1, 3, 7] as const;
type EndMode = 'never' | 'onDate' | 'afterCount';

function endDateAfterOccurrences(start: string, rule: Recurring['rule'], count: number): string {
  let month = monthOf(start);
  let lastDue = start;
  for (let i = 0; i < count; i++) {
    const due = dueDateInMonth(rule, month);
    if (due && due >= start) lastDue = due;
    month = nextMonth(month);
  }
  return lastDue;
}

/** DESIGN popup #25 — Add / edit recurring. */
export function RecurringFormSheet({
  snapshot,
  existing,
  initialKind = 'bill',
  visible,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  existing?: Recurring | null;
  initialKind?: RecurringKind;
  visible: boolean;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
}) {
  const [kind, setKind] = useState<RecurringKind>('bill');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [approximate, setApproximate] = useState(false);
  const [payeeId, setPayeeId] = useState('');
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [every, setEvery] = useState<'month' | 'week'>('month');
  const [lastDayOfMonth, setLastDayOfMonth] = useState(false);
  const [onDay, setOnDay] = useState('1');
  const [startDate, setStartDate] = useState(today());
  const [endMode, setEndMode] = useState<EndMode>('never');
  const [endDate, setEndDate] = useState('');
  const [endAfterCount, setEndAfterCount] = useState('12');
  const [autoCreate, setAutoCreate] = useState(false);
  const [reminderDays, setReminderDays] = useState<number>(0);
  const [hideAmountOnLock, setHideAmountOnLock] = useState(true);

  useEffect(() => {
    if (existing) {
      setKind(existing.kind);
      setName(existing.name);
      setApproximate(!!existing.approximate);
      setPayeeId(existing.payeeId ?? '');
      setAccountId(existing.accountId);
      setCategoryId(existing.categoryId ?? '');
      setEvery(existing.rule.every);
      setLastDayOfMonth(existing.rule.every === 'month' && existing.rule.on === 31);
      setOnDay(String(existing.rule.on === 31 ? 1 : existing.rule.on));
      setStartDate(existing.startDate);
      setEndMode(existing.endAfterCount ? 'afterCount' : existing.endDate ? 'onDate' : 'never');
      setEndDate(existing.endDate ?? '');
      setEndAfterCount(String(existing.endAfterCount ?? 12));
      setAutoCreate(!!existing.autoCreate);
      setReminderDays(existing.reminderDays ?? 0);
      setHideAmountOnLock(existing.hideAmountOnLock !== false);
      setAmountMinor(BigInt(existing.amountMinor));
      setAmountText((Number(existing.amountMinor) / 100).toString());
    } else {
      setKind(initialKind);
      setEndMode('never');
      setEndDate('');
      setHideAmountOnLock(true);
    }
  }, [existing, initialKind, visible]);

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

  const save = () => {
    if (!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId) return;
    const ruleOn =
      every === 'month'
        ? lastDayOfMonth
          ? 31
          : Math.min(31, Math.max(1, Number(onDay) || 1))
        : Math.min(6, Math.max(0, Number(onDay) || 0));
    const rule = { every, on: ruleOn };
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
      footer={<Button testID="plan-recurring-save" label={t('panel.save')} onPress={save} disabled={!name.trim() || amountMinor === null || amountMinor <= 0n} />}
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
        onChange={(v) => setEvery(v as 'month' | 'week')}
        options={[
          { value: 'month', label: t('plan.freqEveryMonth') },
          { value: 'week', label: t('plan.freqEveryWeek') },
        ]}
      />
      {every === 'month' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text>{t('plan.lastDayOfMonth')}</Text>
          <Switch testID="plan-last-day" label={t('plan.lastDayOfMonth')} value={lastDayOfMonth} onChange={setLastDayOfMonth} />
        </View>
      ) : null}
      {!lastDayOfMonth || every !== 'month' ? (
        <TextInput
          testID="plan-day"
          label={every === 'month' ? t('plan.dayOfMonth') : t('plan.dayOfWeek')}
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

import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Select, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Recurring, RecurringKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

const sp = tokens.spacing;

const KINDS: RecurringKind[] = ['bill', 'subscription', 'transfer'];

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
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [every, setEvery] = useState<'month' | 'week'>('month');
  const [onDay, setOnDay] = useState('1');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [autoCreate, setAutoCreate] = useState(false);

  useEffect(() => {
    if (existing) {
      setKind(existing.kind);
      setName(existing.name);
      setApproximate(!!existing.approximate);
      setAccountId(existing.accountId);
      setCategoryId(existing.categoryId ?? '');
      setEvery(existing.rule.every);
      setOnDay(String(existing.rule.on));
      setStartDate(existing.startDate);
      setEndDate(existing.endDate ?? '');
      setAutoCreate(!!existing.autoCreate);
      setAmountMinor(BigInt(existing.amountMinor));
      setAmountText((Number(existing.amountMinor) / 100).toString());
    } else {
      setKind(initialKind);
    }
  }, [existing, initialKind, visible]);

  const accounts = useMemo(
    () => snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name })),
    [snapshot],
  );
  const categories = useMemo(
    () => snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name })),
    [snapshot],
  );

  const save = () => {
    if (!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId) return;
    const ruleOn = every === 'month' ? Math.min(31, Math.max(1, Number(onDay) || 1)) : Math.min(6, Math.max(0, Number(onDay) || 0));
    void onSave({
      kind,
      name: name.trim(),
      amountMinor: amountMinor.toString(),
      approximate,
      accountId,
      categoryId: kind === 'transfer' ? undefined : categoryId,
      rule: { every, on: ruleOn },
      startDate,
      endDate: endDate.trim() || undefined,
      autoCreate,
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
      <TextInput
        testID="plan-day"
        label={every === 'month' ? t('plan.dayOfMonth') : t('plan.dayOfWeek')}
        value={onDay}
        onChangeText={setOnDay}
        keyboardType="number-pad"
      />
      <TextInput testID="plan-start" label={t('plan.startDate')} value={startDate} onChangeText={setStartDate} />
      <TextInput testID="plan-end" label={t('plan.endDate')} value={endDate} onChangeText={setEndDate} placeholder={t('plan.endNever')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>{t('plan.autoCreate')}</Text>
        <Switch testID="plan-auto-create" label={t('plan.autoCreate')} value={autoCreate} onChange={setAutoCreate} />
      </View>
    </Sheet>
  );
}

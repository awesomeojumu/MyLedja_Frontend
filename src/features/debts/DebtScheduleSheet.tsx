import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, formatDay, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { formatNaira } from '@/money';
import type { PersonDebt } from '@/data/workspace/model';
import { t } from '@/i18n';

import { debtSchedulePreview } from './schedule';

const sp = tokens.spacing;

type Every = 'week' | 'month';

export function DebtScheduleSheet({
  debt,
  onClose,
  onSave,
}: {
  debt: PersonDebt;
  onClose: () => void;
  onSave: (input: { count: number; amountMinor: bigint; every: Every; firstDue: string }) => Promise<void>;
}) {
  const [countText, setCountText] = useState(debt.scheduleInstallmentCount ? String(debt.scheduleInstallmentCount) : '3');
  const [amountText, setAmountText] = useState(debt.scheduleAmountMinor ? formatNaira(BigInt(debt.scheduleAmountMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(debt.scheduleAmountMinor ? BigInt(debt.scheduleAmountMinor) : null);
  const [every, setEvery] = useState<Every>(debt.scheduleEvery ?? 'month');
  const [firstDue, setFirstDue] = useState(debt.scheduleFirstDue ?? '');

  const count = Math.min(120, Math.max(1, Number(countText) || 1));
  const preview = useMemo(() => {
    if (!firstDue || amountMinor === null || amountMinor <= 0n) return [];
    return debtSchedulePreview({ count, amountMinor, every, firstDue });
  }, [amountMinor, count, every, firstDue]);

  const everyOptions: { value: Every; label: string }[] = [
    { value: 'week', label: t('debts.scheduleEveryWeek') },
    { value: 'month', label: t('debts.scheduleEveryMonth') },
  ];

  return (
    <Sheet
      visible
      title={t('debts.scheduleTitle')}
      onClose={onClose}
      testID="debt-schedule-sheet"
      footer={
        <Button
          testID="debt-schedule-save"
          label={t('panel.save')}
          disabled={!firstDue || amountMinor === null || amountMinor <= 0n}
          onPress={() => void onSave({ count, amountMinor: amountMinor!, every, firstDue })}
        />
      }
    >
      <Text tone="textSecondary">{t('debts.scheduleCaption')}</Text>
      <TextInput testID="debt-schedule-count" label={t('debts.scheduleCount')} value={countText} onChangeText={setCountText} keyboardType="number-pad" />
      <AmountInput
        testID="debt-schedule-amount"
        label={t('debts.scheduleAmount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <Select testID="debts-schedule-every" label={t('debts.scheduleEvery')} options={everyOptions} value={every} onChange={setEvery} />
      <TextInput testID="debt-schedule-first" label={t('debts.scheduleFirstDue')} value={firstDue} onChangeText={setFirstDue} placeholder="YYYY-MM-DD" />
      {preview.length > 0 ? (
        <View testID="debt-schedule-preview" style={{ gap: sp['spacing-xs'], marginTop: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('debts.schedulePreview')}</Text>
          {preview.slice(0, 6).map((row) => (
            <Text key={row.dueDate} variant="caption" tone="textSecondary">
              {formatDay(row.dueDate)} · <Amount minor={row.amountMinor} variant="caption" />
            </Text>
          ))}
          {preview.length > 6 ? (
            <Text variant="caption" tone="textSecondary">
              {t('debts.scheduleMore', { count: preview.length - 6 })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

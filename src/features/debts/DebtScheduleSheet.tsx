import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Confirm, DatePicker, Footer, formatDay, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { formatNaira } from '@/money';
import type { PersonDebt } from '@/data/workspace/model';
import { t } from '@/i18n';

import { debtSchedulePreview } from './schedule';

const sp = tokens.spacing;

type Every = 'week' | 'month';

/** PU-36 Debt schedule — equal split with last-absorb when totalMinor is known. */
export function DebtScheduleSheet({
  debt,
  totalMinor,
  onClose,
  onSave,
}: {
  debt: PersonDebt;
  /** Outstanding or original principal used so instalments always add up (TECH-SPEC 6.5). */
  totalMinor?: bigint;
  onClose: () => void;
  onSave: (input: { count: number; amountMinor: bigint; every: Every; firstDue: string }) => Promise<void>;
}) {
  const [countText, setCountText] = useState(debt.scheduleInstallmentCount ? String(debt.scheduleInstallmentCount) : '3');
  const [amountText, setAmountText] = useState(debt.scheduleAmountMinor ? formatNaira(BigInt(debt.scheduleAmountMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(debt.scheduleAmountMinor ? BigInt(debt.scheduleAmountMinor) : null);
  const [every, setEvery] = useState<Every>(debt.scheduleEvery ?? 'month');
  const [firstDue, setFirstDue] = useState(debt.scheduleFirstDue ?? new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const count = Math.min(120, Math.max(2, Number(countText) || 2));
  const preview = useMemo(() => {
    if (!firstDue || amountMinor === null || amountMinor <= 0n) return [];
    return debtSchedulePreview({
      count,
      amountMinor,
      every,
      firstDue,
      totalMinor: totalMinor && totalMinor > 0n ? totalMinor : undefined,
    });
  }, [amountMinor, count, every, firstDue, totalMinor]);

  const previewTotal = preview.reduce((s, r) => s + r.amountMinor, 0n);
  const everyOptions: { value: Every; label: string }[] = [
    { value: 'week', label: t('debts.scheduleEveryWeek') },
    { value: 'month', label: t('debts.scheduleEveryMonth') },
  ];

  const dirty = Boolean(countText || amountText || firstDue);
  const valid = Boolean(firstDue && amountMinor !== null && amountMinor > 0n);

  return (
    <>
      <Sheet
        visible
        title={t('debts.scheduleTitle')}
        onClose={() => (dirty ? setDiscardOpen(true) : onClose())}
        testID="debt-schedule-sheet"
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={() => (dirty ? setDiscardOpen(true) : onClose())} />
            <Button
              testID="debt-schedule-save"
              label={t('panel.save')}
              disabled={!valid || busy}
              onPress={() => {
                if (!valid || amountMinor === null) return;
                setBusy(true);
                void onSave({ count, amountMinor, every, firstDue }).finally(() => setBusy(false));
              }}
            />
          </Footer>
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
        <DatePicker testID="debt-schedule-first" label={t('debts.scheduleFirstDue')} value={firstDue} onChange={setFirstDue} />
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
            <Text testID="debt-schedule-total" variant="caption" tone="textSecondary">
              {t('debts.of')} <Amount minor={previewTotal} variant="caption" />
            </Text>
          </View>
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

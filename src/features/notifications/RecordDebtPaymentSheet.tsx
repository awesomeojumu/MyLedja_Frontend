import { useState } from 'react';
import { View } from 'react-native';

import { Amount, AmountInput, Button, Select, Sheet, Text } from '@/design/components';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

export function RecordDebtPaymentSheet({
  max,
  snapshot,
  onClose,
  onSave,
}: {
  max: bigint;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: { accountId: string; principal: bigint; interest: bigint }) => Promise<void>;
}) {
  const [totalText, setTotalText] = useState('');
  const [totalMinor, setTotalMinor] = useState<bigint | null>(null);
  const [interestText, setInterestText] = useState('');
  const [interestMinor, setInterestMinor] = useState<bigint>(0n);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const principal = totalMinor === null ? 0n : totalMinor > interestMinor ? totalMinor - interestMinor : 0n;

  return (
    <Sheet
      visible
      title={t('debts.paymentTitle')}
      onClose={onClose}
      testID="notification-debt-payment-sheet"
      footer={
        <Button
          testID="notification-debt-payment-save"
          label={t('panel.save')}
          disabled={totalMinor === null || totalMinor <= 0n || !accountId || principal <= 0n}
          onPress={() => void onSave({ accountId, principal: principal > max ? max : principal, interest: interestMinor })}
        />
      }
    >
      <Text tone="textSecondary">{t('debts.paymentSplitCaption')}</Text>
      <AmountInput testID="notification-debt-payment-total" label={t('debts.paymentTotal')} value={totalText} onChange={(text, minor) => { setTotalText(text); setTotalMinor(minor); }} />
      <AmountInput
        testID="notification-debt-payment-interest"
        label={t('debts.interestAmount')}
        value={interestText}
        onChange={(text, minor) => {
          setInterestText(text);
          setInterestMinor(minor ?? 0n);
        }}
      />
      <View>
        <Text variant="caption" tone="textSecondary">
          {t('debts.principalAmount')}: <Amount minor={principal > max ? max : principal} variant="caption" />
        </Text>
      </View>
      <Select testID="notification-debt-payment-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}

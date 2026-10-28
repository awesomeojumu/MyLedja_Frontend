import { useState } from 'react';

import { Amount, Button, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

export function DebtsPaymentSheet({
  max,
  snapshot,
  onClose,
  onSave,
}: {
  max: bigint;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (input: { accountId: string; principal: bigint; interest: bigint; force?: boolean }) => Promise<void>;
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
      testID="debt-payment-sheet"
      footer={
        <Button
          testID="debt-payment-save"
          label={t('panel.save')}
          disabled={totalMinor === null || totalMinor <= 0n || !accountId || principal <= 0n}
          onPress={() => void onSave({ accountId, principal: principal > max ? max : principal, interest: interestMinor, force: false })}
        />
      }
    >
      <Text tone="textSecondary">{t('debts.paymentSplitCaption')}</Text>
      <AmountInput testID="debt-payment-total" label={t('debts.paymentTotal')} value={totalText} onChange={(text, minor) => { setTotalText(text); setTotalMinor(minor); }} />
      <AmountInput
        testID="debt-payment-interest"
        label={t('debts.interestAmount')}
        value={interestText}
        onChange={(text, minor) => {
          setInterestText(text);
          setInterestMinor(minor ?? 0n);
        }}
      />
      <Text variant="caption" tone="textSecondary">
        {t('debts.principalAmount')}: <Amount minor={principal > max ? max : principal} variant="caption" />
      </Text>
      <Select testID="debt-payment-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}

export function DebtEditSheet({
  debt,
  onClose,
  onSave,
}: {
  debt: { name: string; notes?: string };
  onClose: () => void;
  onSave: (input: { name: string; notes: string }) => Promise<void>;
}) {
  const [name, setName] = useState(debt.name);
  const [notes, setNotes] = useState(debt.notes ?? '');
  return (
    <Sheet
      visible
      title={t('debts.editTitle')}
      onClose={onClose}
      testID="debt-edit-sheet"
      footer={<Button testID="debt-edit-save" label={t('panel.save')} disabled={!name.trim()} onPress={() => void onSave({ name: name.trim(), notes: notes.trim() })} />}
    >
      <TextInput testID="debt-edit-name" label={t('debts.personName')} value={name} onChangeText={setName} />
      <TextInput testID="debt-edit-notes" label={t('debts.notes')} value={notes} onChangeText={setNotes} multiline />
    </Sheet>
  );
}

import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Amount, Button, Card, InlineError, Placeholder, Select, Sheet, Text, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { debtRows } from './helpers';

const sp = tokens.spacing;

export function DebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, repo } = useWorkspace();
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = useMemo(() => {
    if (!snapshot || !id) return null;
    return debtRows(snapshot, 'all', today()).find((r) => r.debt.id === id) ?? null;
  }, [snapshot, id]);

  const entries = useMemo(() => {
    if (!snapshot || !id) return [];
    return snapshot.debtEntries.filter((e) => e.debtId === id).sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshot, id]);

  if (!row) {
    return (
      <AppFrame title={t('debts.detailTitle')}>
        <Placeholder height={120} />
      </AppFrame>
    );
  }

  const { debt, balance } = row;

  return (
    <AppFrame title={debt.name}>
      <Card style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-xs'] }}>
        <Text tone="textSecondary">{debt.status === 'settled' ? t('debts.settled') : t('debts.remaining')}</Text>
        <Amount minor={balance} variant="heading-sm" />
      </Card>
      {error ? <InlineError message={error} /> : null}
      {debt.status === 'open' ? (
        <Button testID="debt-record-payment" label={t('debts.recordPayment')} onPress={() => setPayOpen(true)} style={{ marginBottom: sp['spacing-md'] }} />
      ) : null}
      <ScrollView contentContainerStyle={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{t('debts.timeline')}</Text>
        {entries.map((entry) => (
          <Text key={entry.id} variant="caption" tone="textSecondary">
            {entry.date} · {entry.kind} · <Amount minor={BigInt(entry.amountMinor)} variant="caption" />
          </Text>
        ))}
      </ScrollView>
      {payOpen && snapshot ? (
        <PaymentSheet
          max={balance}
          snapshot={snapshot}
          onClose={() => setPayOpen(false)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.recordDebtPayment(debt.id, input);
            if (!r.ok) setError(ledgerMessage(r.error));
            else setPayOpen(false);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function PaymentSheet({
  max,
  snapshot,
  onClose,
  onSave,
}: {
  max: bigint;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (input: { accountId: string; amount: bigint; date: string; interest?: bigint }) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

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
          disabled={amountMinor === null || amountMinor <= 0n || !accountId}
          onPress={() => void onSave({ accountId, amount: amountMinor! > max ? max : amountMinor!, date: today() })}
        />
      }
    >
      <Text tone="textSecondary">{t('debts.paymentCaption')}</Text>
      <AmountInput testID="debt-payment-amount" label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="debt-payment-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}

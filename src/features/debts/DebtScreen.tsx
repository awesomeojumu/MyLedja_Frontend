import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Amount, Button, Card, Confirm, InlineError, Placeholder, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { debtInterestTotal, debtRows, findRecentPayment } from './helpers';

const sp = tokens.spacing;

export function DebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, repo } = useWorkspace();
  const [payOpen, setPayOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ accountId: string; principal: bigint; interest: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const row = useMemo(() => {
    if (!snapshot || !id) return null;
    return debtRows(snapshot, 'all', today()).find((r) => r.debt.id === id) ?? null;
  }, [snapshot, id]);

  const entries = useMemo(() => {
    if (!snapshot || !id) return [];
    return snapshot.debtEntries.filter((e) => e.debtId === id).sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshot, id]);

  const interestTotal = row && snapshot ? debtInterestTotal(row.debt, snapshot) : 0n;

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
        {interestTotal > 0n ? (
          <Text variant="caption" tone="textSecondary">
            {debt.direction === 'owedToMe' ? t('debts.interestEarned') : t('debts.interestPaid')}: <Amount minor={interestTotal} variant="caption" />
          </Text>
        ) : null}
      </Card>
      {error ? <InlineError message={error} /> : null}
      {debt.status === 'open' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
          <Button testID="debt-record-payment" label={t('debts.recordPayment')} onPress={() => setPayOpen(true)} />
          {debt.direction === 'owedToMe' ? (
            <Button testID="debt-write-off" kind="secondary" label={t('debts.writeOff')} onPress={() => setWriteOffOpen(true)} />
          ) : null}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ gap: sp['spacing-sm'] }}>
        <Text variant="heading-sm">{t('debts.timeline')}</Text>
        {entries.map((entry) => (
          <Text key={entry.id} variant="caption" tone="textSecondary">
            {entry.date} · {entry.kind} · <Amount minor={BigInt(entry.amountMinor)} variant="caption" />
            {entry.interestMinor ? (
              <>
                {' '}
                ({t('debts.interestLine')} <Amount minor={BigInt(entry.interestMinor)} variant="caption" />)
              </>
            ) : null}
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
            const dup = findRecentPayment(debt.id, snapshot, input.principal, today());
            if (dup && !input.force) {
              setDuplicateConfirm(input);
              return;
            }
            const r = await repo.recordDebtPayment(debt.id, { accountId: input.accountId, amount: input.principal, date: today(), interest: input.interest });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setPayOpen(false);
          }}
        />
      ) : null}
      {writeOffOpen && snapshot ? (
        <WriteOffSheet
          max={balance}
          onClose={() => setWriteOffOpen(false)}
          onSave={async (reason) => {
            setError(null);
            const r = await repo.writeOffDebt(debt.id, { amount: balance, date: today(), reason });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setWriteOffOpen(false);
          }}
        />
      ) : null}
      <Confirm
        visible={duplicateConfirm !== null}
        title={t('debts.duplicateTitle')}
        body={t('debts.duplicateBody', { date: today() })}
        confirmLabel={t('debts.duplicateConfirm')}
        onConfirm={() => {
          if (!duplicateConfirm) return;
          void repo
            .recordDebtPayment(debt.id, {
              accountId: duplicateConfirm.accountId,
              amount: duplicateConfirm.principal,
              date: today(),
              interest: duplicateConfirm.interest,
            })
            .then((r) => {
              if (!r.ok) setError(ledgerMessage(r.error));
              else setPayOpen(false);
            });
          setDuplicateConfirm(null);
        }}
        onCancel={() => setDuplicateConfirm(null)}
      />
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

function WriteOffSheet({ max, onClose, onSave }: { max: bigint; onClose: () => void; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet
      visible
      title={t('debts.writeOffTitle')}
      onClose={onClose}
      testID="debt-writeoff-sheet"
      footer={<Button testID="debt-writeoff-save" label={t('debts.writeOffConfirm')} disabled={!reason.trim()} onPress={() => void onSave(reason)} />}
    >
      <Text tone="textSecondary">{t('debts.writeOffCaption')}</Text>
      <Amount minor={max} />
      <TextInput testID="debt-writeoff-reason" label={t('debts.writeOffReason')} value={reason} onChangeText={setReason} />
    </Sheet>
  );
}

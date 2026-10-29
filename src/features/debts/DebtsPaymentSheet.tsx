import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Confirm,
  DatePicker,
  Footer,
  Select,
  Sheet,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type { PersonDebt } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { formatNaira } from '@/money';
import { t } from '@/i18n';

import { interestDueToDate, nextInstallment } from './schedule';

const sp = tokens.spacing;

export type DebtPaymentSave = {
  accountId: string;
  principal: bigint;
  interest: bigint;
  date: string;
  force?: boolean;
  /** TECH-SPEC 6.9 when total principal would exceed outstanding. */
  overpayment?: 'gift' | 'credit';
};

/**
 * PU-35 Record payment — next instalment default, interest due, editable split, overpayment gift/credit.
 */
export function DebtsPaymentSheet({
  debt,
  max,
  snapshot,
  onClose,
  onSave,
}: {
  debt?: PersonDebt;
  max: bigint;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (input: DebtPaymentSave) => Promise<void>;
}) {
  const onDate = new Date().toISOString().slice(0, 10);
  const next = debt ? nextInstallment(debt, snapshot, onDate) : null;
  const interestDefault = debt ? interestDueToDate(debt, max, onDate) : 0n;
  const defaultTotal = next?.amountMinor ?? max;

  const [totalText, setTotalText] = useState(formatNaira(defaultTotal));
  const [totalMinor, setTotalMinor] = useState<bigint | null>(defaultTotal);
  const [interestText, setInterestText] = useState(interestDefault > 0n ? formatNaira(interestDefault) : '');
  const [interestMinor, setInterestMinor] = useState<bigint>(interestDefault);
  const [splitOpen, setSplitOpen] = useState(false);
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [date, setDate] = useState(onDate);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [overpayChoice, setOverpayChoice] = useState<{ principal: bigint; interest: bigint; extra: bigint } | null>(null);

  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const principal = totalMinor === null ? 0n : totalMinor > interestMinor ? totalMinor - interestMinor : 0n;
  const interestCapOk = interestMinor <= (totalMinor ?? 0n);
  const valid = totalMinor !== null && totalMinor > 0n && Boolean(accountId) && principal > 0n && interestCapOk;

  const header = useMemo(() => {
    if (!debt) return null;
    const owed =
      debt.direction === 'owedToMe'
        ? t('debts.paymentHeaderOwesYou', { name: debt.name, amount: formatNaira(max) })
        : t('debts.paymentHeaderYouOwe', { name: debt.name, amount: formatNaira(max) });
    if (next) {
      return `${owed} · ${t('debts.paymentHeaderNext', { amount: formatNaira(next.amountMinor), date: next.dueDate })}`;
    }
    return owed;
  }, [debt, max, next]);

  const caption =
    debt?.direction === 'iOwe' ? t('debts.interestSpendsCaption') : t('debts.interestIncomeCaption');

  const requestClose = () => setDiscardOpen(true);

  const submit = async (overpayment?: 'gift' | 'credit') => {
    if (!valid || totalMinor === null) return;
    const interest = interestMinor > totalMinor ? totalMinor : interestMinor;
    const rawPrincipal = totalMinor - interest;
    if (rawPrincipal > max && !overpayment) {
      setOverpayChoice({ principal: max, interest, extra: rawPrincipal - max });
      return;
    }
    setBusy(true);
    try {
      await onSave({
        accountId,
        // Pass uncapped principal when overpayment is chosen so the repo can gift/credit the extra (TECH-SPEC 6.9).
        principal: overpayment ? rawPrincipal : rawPrincipal > max ? max : rawPrincipal,
        interest,
        date,
        force: false,
        overpayment,
      });
    } finally {
      setBusy(false);
      setOverpayChoice(null);
    }
  };

  return (
    <>
      <Sheet
        visible
        title={t('debts.paymentTitle')}
        onClose={requestClose}
        testID="debt-payment-sheet"
        footer={
          <Footer>
            <Button kind="secondary" testID="debt-payment-cancel" label={t('common.cancel')} onPress={requestClose} />
            <Button
              testID="debt-payment-save"
              label={t('debts.recordPayment')}
              disabled={!valid || busy}
              onPress={() => void submit()}
            />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-md'] }}>
          {header ? (
            <Text testID="debt-payment-header" tone="textSecondary">
              {header}
            </Text>
          ) : null}
          <Text tone="textSecondary">{caption}</Text>
          <AmountInput
            testID="debt-payment-total"
            label={t('debts.paymentTotal')}
            value={totalText}
            onChange={(text, minor) => {
              setTotalText(text);
              setTotalMinor(minor);
            }}
          />
          {splitOpen ? (
            <AmountInput
              testID="debt-payment-interest"
              label={t('debts.interestAmount')}
              value={interestText}
              onChange={(text, minor) => {
                setInterestText(text);
                setInterestMinor(minor ?? 0n);
              }}
            />
          ) : (
            <Text variant="caption" tone="textSecondary" testID="debt-payment-interest-readonly">
              {t('debts.interestAmount')}: <Amount minor={interestMinor} variant="caption" />
            </Text>
          )}
          <Button
            testID="debt-payment-change-split"
            kind="secondary"
            label={splitOpen ? t('debts.hideSplit') : t('debts.changeSplit')}
            onPress={() => setSplitOpen((v) => !v)}
          />
          <Text variant="caption" tone="textSecondary" testID="debt-payment-principal">
            {t('debts.principalAmount')}: <Amount minor={principal} variant="caption" />
          </Text>
          <Select testID="debt-payment-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
          <DatePicker testID="debt-payment-date" label={t('add.date')} value={date} onChange={setDate} />
        </View>
      </Sheet>

      <Confirm
        visible={discardOpen}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setDiscardOpen(false)}
      />

      {overpayChoice ? (
        <Sheet
          visible
          testID="debt-overpay-choice"
          title={t('debts.overpayTitle')}
          onClose={() => setOverpayChoice(null)}
          footer={
            <Footer>
              <Button testID="debt-overpay-credit" kind="secondary" label={t('debts.overpayCredit')} onPress={() => void submit('credit')} />
              <Button testID="debt-overpay-gift" label={t('debts.overpayGift')} onPress={() => void submit('gift')} />
            </Footer>
          }
        >
          <Text>{t('debts.overpayBody', { amount: formatNaira(overpayChoice.extra) })}</Text>
        </Sheet>
      ) : null}
    </>
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
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="debt-edit-save" label={t('panel.save')} disabled={!name.trim()} onPress={() => void onSave({ name: name.trim(), notes: notes.trim() })} />
        </Footer>
      }
    >
      <TextInput testID="debt-edit-name" label={t('debts.personName')} value={name} onChangeText={setName} />
      <TextInput testID="debt-edit-notes" label={t('debts.notes')} value={notes} onChangeText={setNotes} multiline />
    </Sheet>
  );
}

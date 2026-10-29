import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AmountInput,
  Button,
  Confirm,
  DatePicker,
  Footer,
  SegmentedControl,
  Select,
  Sheet,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type { DebtInterest, PersonDebt } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

import { contactsAvailable, pickContact } from './contacts';

const sp = tokens.spacing;

export type OpenDebtInput = {
  name: string;
  direction: PersonDebt['direction'];
  accountId: string;
  amount: bigint;
  date: string;
  payeeName?: string;
  bankNames?: string[];
  notes?: string;
  interest?: DebtInterest;
  dueDate?: string;
  /** After save, open PU-36 when instalments. */
  payBack: 'none' | 'by_date' | 'instalments';
};

type InterestKind = 'none' | 'fixed' | 'percent_month';
type PayBack = OpenDebtInput['payBack'];

/**
 * PU-34 Lend / borrow — interest, pay-back modes, bank-name chips, notes, date, direction segmented.
 * Contacts picker is phone-only (Phase 2 polish); web types the person name.
 */
export function OpenDebtSheet({
  direction: initialDirection,
  snapshot,
  onClose,
  onSave,
}: {
  direction: PersonDebt['direction'];
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: OpenDebtInput) => Promise<void>;
}) {
  const [direction, setDirection] = useState(initialDirection);
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts.find((a) => !a.archived)?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [interestKind, setInterestKind] = useState<InterestKind>('none');
  const [interestAmountText, setInterestAmountText] = useState('');
  const [interestAmountMinor, setInterestAmountMinor] = useState<bigint | null>(null);
  const [interestPercent, setInterestPercent] = useState('1');
  const [payBack, setPayBack] = useState<PayBack>('none');
  const [dueDate, setDueDate] = useState('');
  const [bankDraft, setBankDraft] = useState('');
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [showInterest, setShowInterest] = useState(false);

  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const title = direction === 'owedToMe' ? t('debts.lendTitle') : t('debts.borrowTitle');
  const caption = direction === 'owedToMe' ? t('debts.lendCaption') : t('debts.borrowCaption');
  const accountLabel = direction === 'owedToMe' ? t('debts.moneyLeftFrom') : t('debts.moneyWentInto');

  const dirty = useMemo(
    () =>
      name.trim() !== '' ||
      amountText !== '' ||
      notes.trim() !== '' ||
      bankNames.length > 0 ||
      interestKind !== 'none' ||
      payBack !== 'none',
    [name, amountText, notes, bankNames, interestKind, payBack],
  );

  const interestValid =
    interestKind === 'none' ||
    (interestKind === 'fixed' && interestAmountMinor !== null && interestAmountMinor > 0n) ||
    (interestKind === 'percent_month' && Number(interestPercent) >= 0 && Number(interestPercent) <= 100);

  const payBackValid = payBack !== 'by_date' || Boolean(dueDate);
  const valid = Boolean(name.trim() && accountId && amountMinor !== null && amountMinor > 0n && interestValid && payBackValid);

  const requestClose = () => (dirty ? setDiscardOpen(true) : onClose());

  const addBankName = () => {
    const chip = bankDraft.trim().toUpperCase();
    if (!chip || bankNames.includes(chip)) return;
    setBankNames([...bankNames, chip]);
    setBankDraft('');
  };

  const buildInterest = (): DebtInterest | undefined => {
    if (interestKind === 'none') return { kind: 'none' };
    if (interestKind === 'fixed' && interestAmountMinor !== null) {
      return { kind: 'fixed', amountMinor: interestAmountMinor.toString() };
    }
    if (interestKind === 'percent_month') {
      return { kind: 'percent_month', percent: Math.max(0, Math.min(100, Number(interestPercent) || 0)) };
    }
    return { kind: 'none' };
  };

  return (
    <>
      <Sheet
        visible
        title={title}
        onClose={requestClose}
        testID="debt-open-sheet"
        footer={
          <Footer>
            <Button kind="secondary" testID="debt-open-cancel" label={t('common.cancel')} onPress={requestClose} />
            <Button
              testID="debt-open-save"
              label={t('debts.recordLoan')}
              disabled={!valid || busy}
              onPress={() => {
                if (!valid || amountMinor === null) return;
                setBusy(true);
                void onSave({
                  name: name.trim(),
                  direction,
                  accountId,
                  amount: amountMinor,
                  date,
                  payeeName: name.trim(),
                  bankNames: bankNames.length ? bankNames : [name.trim().toUpperCase()],
                  notes: notes.trim() || undefined,
                  interest: buildInterest(),
                  dueDate: payBack === 'by_date' ? dueDate : undefined,
                  payBack,
                }).finally(() => setBusy(false));
              }}
            />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-md'] }}>
          <Text tone="textSecondary">{caption}</Text>
          <SegmentedControl
            testID="debt-direction"
            label={t('debts.direction')}
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'owedToMe', label: t('debts.iLent') },
              { value: 'iOwe', label: t('debts.iBorrowed') },
            ]}
          />
          <TextInput testID="debt-name" label={t('debts.personName')} value={name} onChangeText={setName} />
          {contactsAvailable() ? (
            <Button
              testID="debt-pick-contact"
              kind="secondary"
              label={t('debts.pickContact')}
              onPress={() => {
                void pickContact().then((c) => {
                  if (c?.name) setName(c.name);
                });
              }}
            />
          ) : null}
          <AmountInput
            testID="debt-amount"
            label={t('add.amount')}
            value={amountText}
            onChange={(text, minor) => {
              setAmountText(text);
              setAmountMinor(minor);
            }}
          />
          <Select testID="debt-account" label={accountLabel} options={accounts} value={accountId} onChange={setAccountId} />
          <DatePicker testID="debt-date" label={t('add.date')} value={date} onChange={setDate} />

          <Button
            testID="debt-interest-toggle"
            kind="secondary"
            label={showInterest ? t('debts.hideInterest') : t('debts.addInterest')}
            onPress={() => setShowInterest((v) => !v)}
          />
          {showInterest ? (
            <View style={{ gap: sp['spacing-sm'] }}>
              <SegmentedControl
                testID="debt-interest-kind"
                label={t('debts.interest')}
                value={interestKind}
                onChange={setInterestKind}
                options={[
                  { value: 'none', label: t('debts.interestNone') },
                  { value: 'fixed', label: t('debts.interestFixed') },
                  { value: 'percent_month', label: t('debts.interestPercent') },
                ]}
              />
              {interestKind === 'fixed' ? (
                <AmountInput
                  testID="debt-interest-fixed"
                  label={t('debts.interestAmount')}
                  value={interestAmountText}
                  onChange={(text, minor) => {
                    setInterestAmountText(text);
                    setInterestAmountMinor(minor);
                  }}
                />
              ) : null}
              {interestKind === 'percent_month' ? (
                <TextInput
                  testID="debt-interest-percent"
                  label={t('debts.interestPercentLabel')}
                  value={interestPercent}
                  onChangeText={setInterestPercent}
                  keyboardType="decimal-pad"
                />
              ) : null}
            </View>
          ) : null}

          <SegmentedControl
            testID="debt-payback"
            label={t('debts.payBack')}
            value={payBack}
            onChange={setPayBack}
            options={[
              { value: 'none', label: t('debts.payBackNone') },
              { value: 'by_date', label: t('debts.payBackByDate') },
              { value: 'instalments', label: t('debts.payBackInstalments') },
            ]}
          />
          {payBack === 'by_date' ? (
            <DatePicker testID="debt-due-date" label={t('debts.dueDate')} value={dueDate || date} onChange={setDueDate} />
          ) : null}

          <View style={{ gap: sp['spacing-xs'] }}>
            <TextInput
              testID="debt-bank-draft"
              label={t('debts.bankNames')}
              value={bankDraft}
              onChangeText={setBankDraft}
              placeholder={t('debts.bankNamesHint')}
              onSubmitEditing={addBankName}
            />
            <Button testID="debt-bank-add" kind="secondary" label={t('debts.addBankName')} onPress={addBankName} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
              {bankNames.map((chip) => (
                <Pressable
                  key={chip}
                  testID={`debt-bank-chip-${chip}`}
                  accessibilityRole="button"
                  onPress={() => setBankNames(bankNames.filter((c) => c !== chip))}
                  style={{
                    paddingHorizontal: sp['spacing-sm'],
                    paddingVertical: sp['spacing-xs'],
                    borderRadius: tokens.radius['rounded-pill'],
                    borderWidth: 1,
                    borderColor: tokens.color['ink-mute-2'],
                  }}
                >
                  <Text variant="caption">{chip} ×</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            testID="debt-notes"
            label={t('debts.notesOptional')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
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
    </>
  );
}

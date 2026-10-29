import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Footer,
  InlineError,
  Select,
  Sheet,
  Text,
  TextInput,
  formatDay,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { toInputText } from '@/money';

import { billMatchCandidates, type BillMatchCandidate } from './match';
import type { BillRow } from './recurrence';

const sp = tokens.spacing;

/** PU-26 — Mark paid / match. */
export function MarkPaidMatchSheet({
  row,
  snapshot,
  visible,
  onClose,
  onDone,
}: {
  row: BillRow | null;
  snapshot: Snapshot;
  visible: boolean;
  onClose: () => void;
  onDone: (message?: string) => void;
}) {
  const theme = useTheme();
  const { repo } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    if (!row || row.recurring.kind === 'income') return [];
    return billMatchCandidates(snapshot, row).slice(0, 5);
  }, [snapshot, row]);

  const paidOn = useMemo(() => {
    if (!row?.occurrence || row.occurrence.status !== 'paid') return null;
    if (row.occurrence.eventId) {
      const ev = snapshot.events.find((e) => e.id === row.occurrence!.eventId);
      if (ev) return ev.date;
    }
    return row.dueDate;
  }, [row, snapshot]);

  const openKey = visible && row ? `${row.recurring.id}:${row.dueDate}` : null;
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey && row) {
      setError(null);
      setSelectedId(null);
      setCreateNew(candidates.length === 0);
      setAmountMinor(BigInt(row.recurring.amountMinor));
      setAmountText(toInputText(BigInt(row.recurring.amountMinor)));
      setAccountId(row.recurring.accountId);
      setDate(today());
      setSaving(false);
    }
  }

  if (!row) return null;

  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const isIncome = row.recurring.kind === 'income';
  const alreadyPaid = row.occurrence?.status === 'paid';

  const matchExisting = async (c: BillMatchCandidate) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const r = await repo.matchBillToEvent(row.recurring.id, row.dueDate, c.eventId);
    setSaving(false);
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      onDone(t('plan.markedPaidToast'));
      onClose();
    }
  };

  const createNewTxn = async () => {
    if (saving || amountMinor === null || amountMinor <= 0n || !accountId) return;
    setSaving(true);
    setError(null);
    if (isIncome) {
      const streamId = row.recurring.id.startsWith('stream:') ? row.recurring.id.slice(7) : row.recurring.id;
      const r = await repo.recordIncomeReceived(streamId, {
        accountId,
        amount: amountMinor,
        date,
      });
      setSaving(false);
      if (!r.ok) setError(ledgerMessage(r.error));
      else {
        onDone(t('plan.markedReceivedToast'));
        onClose();
      }
      return;
    }
    const categoryId = row.recurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id;
    const r = await repo.markBillPaid(row.recurring.id, row.dueDate, {
      accountId,
      categoryId,
      amount: amountMinor,
      date,
      payeeId: row.recurring.payeeId,
    });
    setSaving(false);
    if (!r.ok) {
      if (r.error === 'already_reversed') setError(t('plan.alreadyPaid', { date: formatDay(paidOn ?? row.dueDate) }));
      else setError(ledgerMessage(r.error));
    } else {
      onDone(t('plan.markedPaidToast'));
      onClose();
    }
  };

  const savePrimary = () => {
    if (createNew) void createNewTxn();
    else if (selectedId) {
      const c = candidates.find((x) => x.eventId === selectedId);
      if (c) void matchExisting(c);
    }
  };

  const undoPaid = async () => {
    setSaving(true);
    const r = await repo.unmarkBillPaid(row.recurring.id, row.dueDate);
    setSaving(false);
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      onDone(t('plan.undoMarkPaidToast'));
      onClose();
    }
  };

  if (alreadyPaid) {
    return (
      <Sheet
        visible={visible}
        title={t('plan.matchTitle', { name: row.recurring.name })}
        onClose={onClose}
        testID="plan-match-sheet"
        footer={
          <Footer>
            <Button testID="plan-match-cancel" kind="secondary" label={t('common.cancel')} onPress={onClose} />
            <Button testID="plan-match-undo" label={t('plan.undoMarkPaid')} onPress={() => void undoPaid()} disabled={saving} />
          </Footer>
        }
      >
        <Text testID="plan-already-paid">{t('plan.alreadyPaid', { date: formatDay(paidOn ?? row.dueDate) })}</Text>
        {row.occurrence?.eventId ? (
          <Button
            testID="plan-see-transaction"
            kind="link"
            label={t('plan.seeTransaction')}
            onPress={onClose}
          />
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </Sheet>
    );
  }

  const canSave = createNew ? amountMinor !== null && amountMinor > 0n && !!accountId : !!selectedId;

  return (
    <Sheet
      visible={visible}
      title={t('plan.matchTitle', { name: row.recurring.name })}
      onClose={onClose}
      testID="plan-match-sheet"
      footer={
        <Footer>
          <Button testID="plan-match-cancel" kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="plan-match-save"
            label={isIncome ? t('plan.markReceived') : t('plan.markPaid')}
            onPress={savePrimary}
            disabled={!canSave || saving}
          />
        </Footer>
      }
    >
      <Text tone="textSecondary" testID="plan-match-summary">
        {row.recurring.name} · {t('plan.matchDue', { date: formatDay(row.dueDate) })} ·{' '}
        <Amount minor={BigInt(row.recurring.amountMinor)} variant="caption" />
      </Text>
      {error ? <InlineError message={error} /> : null}

      <Text variant="heading-sm">{t('plan.matchSuggestions')}</Text>
      {candidates.length === 0 ? (
        <Text tone="textSecondary">{t('plan.matchNone')}</Text>
      ) : (
        <View style={{ gap: sp['spacing-sm'] }}>
          {candidates.map((c) => (
            <Pressable
              key={c.eventId}
              testID={`plan-match-pick-${c.eventId}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedId === c.eventId && !createNew }}
              onPress={() => {
                setCreateNew(false);
                setSelectedId(c.eventId);
              }}
              style={{
                borderWidth: 1,
                borderColor: selectedId === c.eventId && !createNew ? theme.primaryFill : theme.border,
                borderRadius: tokens.radius['rounded-sm'],
                padding: sp['spacing-sm'],
                gap: sp['spacing-xs'],
              }}
            >
              <Text>{c.title}</Text>
              <Text variant="caption" tone="textSecondary">
                {formatDay(c.date)} · <Amount minor={c.amount} variant="caption" />
              </Text>
              {c.amountNote ? (
                <Text variant="caption" tone="textSecondary">
                  {c.amountNote}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        testID="plan-match-create"
        accessibilityRole="radio"
        accessibilityState={{ selected: createNew }}
        onPress={() => {
          setCreateNew(true);
          setSelectedId(null);
        }}
        style={{
          borderWidth: 1,
          borderColor: createNew ? theme.primaryFill : theme.border,
          borderRadius: tokens.radius['rounded-sm'],
          padding: sp['spacing-sm'],
          gap: sp['spacing-sm'],
          marginTop: sp['spacing-sm'],
        }}
      >
        <Text variant="heading-sm">{t('plan.matchCreateNew')}</Text>
        {createNew ? (
          <>
            <AmountInput
              testID="plan-match-amount"
              label={t('plan.amount')}
              value={amountText}
              onChange={(text, minor) => {
                setAmountText(text);
                setAmountMinor(minor);
              }}
            />
            <Select testID="plan-match-account" label={t('plan.account')} options={accounts} value={accountId} onChange={setAccountId} />
            <TextInput testID="plan-match-date" label={t('plan.date')} value={date} onChangeText={setDate} />
          </>
        ) : null}
      </Pressable>
    </Sheet>
  );
}

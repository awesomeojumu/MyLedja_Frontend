import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Amount, AmountInput, Button, DatePicker, InlineError, Panel, PillTag, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Snapshot, TransactionInput, TxEvent } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { purchaseCost, refundedSoFar } from '@/ledger';
import { formatNaira } from '@/money';

import { ledgerMessage, today } from './helpers';

const sp = tokens.spacing;

/** The versions a transaction went through, oldest first (P11-05). */
export function historyOf(snapshot: Snapshot, event: TxEvent): TxEvent[] {
  const byId = new Map(snapshot.events.map((e) => [e.id, e]));
  const chain: TxEvent[] = [event];
  let current = event;
  while (current.correctionOf) {
    const previous = byId.get(current.correctionOf);
    if (!previous) break;
    chain.unshift(previous);
    current = previous;
  }
  return chain;
}

function moneyLine(snapshot: Snapshot, e: TxEvent) {
  const accounts = new Set(snapshot.accounts.map((a) => a.id));
  return e.lines.filter((l) => accounts.has(l.ledgerAccountId));
}

function amountOf(snapshot: Snapshot, e: TxEvent): bigint {
  if (e.type === 'transfer') return moneyLine(snapshot, e).find((l) => l.amountMinor > 0n)?.amountMinor ?? 0n;
  return moneyLine(snapshot, e).reduce((s, l) => s + l.amountMinor, 0n);
}

export function TransactionPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { repo, snapshot } = useWorkspace();
  const toast = useToast();
  const theme = useTheme();
  const router = useRouter();
  const event = snapshot?.events.find((e) => e.id === id);
  const [editing, setEditing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!snapshot || !event) return null;
  const names = new Map([...snapshot.accounts.map((a) => [a.id, a.name] as const), ...snapshot.categories.map((c) => [c.id, c.name] as const)]);
  const money = moneyLine(snapshot, event);
  const others = event.lines.filter((l) => !money.includes(l));
  const amount = amountOf(snapshot, event);
  const payee = snapshot.payees.find((p) => p.id === event.payeeId)?.name;
  const refunds = snapshot.events.filter((e) => e.refundOf === id && e.status === 'posted');
  const left = event.type === 'expense' ? purchaseCost(snapshot.chart, event) - refundedSoFar(event, snapshot.events) : 0n;
  const history = historyOf(snapshot, event);
  const field = (label: string, value: string | undefined) =>
    value ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
        <Text tone="textSecondary">{label}</Text>
        <Text style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
      </View>
    ) : null;

  const remove = async () => {
    const r = await repo.deleteTransaction(event.id, today());
    if (!r.ok) return setError(ledgerMessage(r.error));
    onClose();
    toast.show(t('tx.deleted'), () => void repo.restore(event));
  };

  return (
    <Panel visible title={t('panel.title')} onClose={onClose} testID="tx-panel">
      <View style={{ gap: sp['spacing-lg'] }}>
        <View style={{ gap: sp['spacing-xs'] }}>
          <Amount minor={amount} variant="display-md" signed={event.type !== 'transfer'} testID="panel-amount" />
          <View style={{ flexDirection: 'row', gap: sp['spacing-xs'] }}>
            <PillTag label={t(`panel.type.${event.type}`)} />
            {event.correctionOf ? <PillTag label={t('panel.edited')} /> : null}
          </View>
        </View>

        <View style={{ gap: sp['spacing-sm'] }}>
          {field(t('add.payee'), payee)}
          {field(
            t('add.category'),
            others
              .map((l) => names.get(l.ledgerAccountId) ?? '')
              .filter(Boolean)
              .join(', '),
          )}
          {field(t('add.account'), money.map((l) => names.get(l.ledgerAccountId) ?? '').join(' → '))}
          {field(t('add.date'), event.date)}
          {field(t('panel.status'), t(event.status === 'reversed' ? 'panel.status.reversed' : 'panel.status.posted'))}
        </View>

        {event.reconciledBy ? (
          <View style={{ gap: sp['spacing-sm'] }} testID="panel-locked">
            <PillTag label={t('panel.locked')} />
            <Button
              kind="secondary"
              testID="panel-unlock"
              label={t('panel.unlock')}
              onPress={() => void repo.unlockEvent(event.id).then(() => toast.show(t('panel.unlockDone')))}
            />
          </View>
        ) : null}

        {event.status === 'posted' && !event.reconciledBy && (event.type === 'expense' || event.type === 'income' || event.type === 'transfer') ? (
          editing ? (
            <EditForm
              snapshot={snapshot}
              event={event}
              amount={amount}
              onDone={() => setEditing(false)}
              onError={setError}
              onSaved={(nextId) => {
                setEditing(false);
                // A correction replaces this event; keep the panel open on the new version.
                router.setParams({ tx: nextId });
              }}
            />
          ) : (
            <Button kind="secondary" testID="panel-edit" label={t('panel.edit')} onPress={() => setEditing(true)} />
          )
        ) : null}

        <NotesField key={event.id} event={event} />

        {event.notes?.startsWith('receipt:') || event.notes?.startsWith('http') ? (
          <Button kind="link" testID="panel-receipt" label={t('panel.viewReceipt')} onPress={() => setReceiptOpen(true)} />
        ) : null}

        {event.type === 'expense' ? (
          <View style={{ gap: sp['spacing-sm'] }} testID="panel-connected">
            <Text variant="heading-sm" accessibilityRole="header">
              {t('panel.connected')}
            </Text>
            {refunds.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t('panel.refundOn', { date: r.date })}</Text>
                <Amount minor={amountOf(snapshot, r)} signed />
              </View>
            ))}
            {refunding ? (
              <RefundForm event={event} left={left} onDone={() => setRefunding(false)} />
            ) : left > 0n && event.status === 'posted' ? (
              <Button kind="link" testID="panel-add-refund" label={t('panel.addRefund')} onPress={() => setRefunding(true)} />
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: sp['spacing-xs'] }} testID="panel-history">
          <Text variant="heading-sm" accessibilityRole="header">
            {t('panel.history')}
          </Text>
          {history.map((h, i) => (
            <View
              key={h.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderTopWidth: i ? 1 : 0,
                borderTopColor: theme.border,
                paddingTop: i ? sp['spacing-xs'] : 0,
              }}
            >
              <Text tone={h.id === event.id ? 'text' : 'textSecondary'}>{t(i === 0 ? 'panel.historyCreated' : 'panel.historyEdited', { date: h.date })}</Text>
              <Amount minor={amountOf(snapshot, h)} signed={h.type !== 'transfer'} />
            </View>
          ))}
          {event.status === 'reversed' ? <Text tone="textSecondary">{t('panel.historyDeleted')}</Text> : null}
        </View>

        {error ? <InlineError testID="panel-error" message={error} /> : null}
        {event.status === 'posted' && !event.reconciledBy ? (
          <Button kind="secondary" testID="panel-delete" label={t('tx.delete')} onPress={() => void remove()} />
        ) : null}
      </View>
      <Sheet visible={receiptOpen} title={t('panel.receiptTitle')} onClose={() => setReceiptOpen(false)} testID="panel-receipt-sheet">
        <Text>{event.notes?.replace(/^receipt:/, '') ?? t('panel.receiptEmpty')}</Text>
      </Sheet>
    </Panel>
  );
}

function NotesField({ event }: { event: TxEvent }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [notes, setNotes] = useState(event.notes ?? '');
  return (
    <TextInput
      testID="panel-notes"
      label={t('add.notes')}
      value={notes}
      onChangeText={setNotes}
      onBlur={() => {
        if ((event.notes ?? '') === notes.trim()) return;
        void repo.updateNotes(event.id, notes).then(() => toast.show(t('common.saved')));
      }}
    />
  );
}

function EditForm({
  snapshot,
  event,
  amount,
  onDone,
  onError,
  onSaved,
}: {
  snapshot: Snapshot;
  event: TxEvent;
  amount: bigint;
  onDone: () => void;
  onError: (m: string | null) => void;
  onSaved: (nextId: string) => void;
}) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const money = event.lines.filter((l) => accountIds.has(l.ledgerAccountId));
  const parts = event.lines.filter((l) => !accountIds.has(l.ledgerAccountId));
  const abs = amount < 0n ? -amount : amount;
  const [text, setText] = useState(formatNaira(abs).replace('₦', ''));
  const [minor, setMinor] = useState<bigint | null>(abs);
  const [date, setDate] = useState(event.date);
  const [accountId, setAccountId] = useState<string | null>(money.find((l) => l.amountMinor < 0n)?.ledgerAccountId ?? money[0]?.ledgerAccountId ?? null);
  const [toId, setToId] = useState<string | null>(money.find((l) => l.amountMinor > 0n)?.ledgerAccountId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(parts.length === 1 ? (parts[0]?.ledgerAccountId ?? null) : null);
  const split = parts.length > 1;
  const kind = event.type as 'expense' | 'income' | 'transfer';
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')).map((c) => ({ value: c.id, label: c.name }));

  const save = async () => {
    if (minor === null || !accountId) return;
    let input: TransactionInput;
    if (kind === 'transfer') input = { kind, fromId: accountId, toId: toId!, amount: minor, date };
    else if (kind === 'income') input = { kind, accountId: money[0]!.ledgerAccountId, categoryId: categoryId!, amount: minor, date };
    else {
      // A split keeps its parts in proportion only when the total is unchanged; otherwise edit it as one category.
      const expenseParts =
        split && minor === abs
          ? parts.map((p) => ({ categoryId: p.ledgerAccountId, amount: p.amountMinor }))
          : [{ categoryId: categoryId ?? parts[0]!.ledgerAccountId, amount: minor }];
      input = { kind, accountId, parts: expenseParts, date };
    }
    const r = await repo.correctTransaction(event.id, input);
    if (!r.ok) return onError(ledgerMessage(r.error));
    onError(null);
    toast.show(t('common.saved'));
    onSaved(r.value.id);
  };

  return (
    <View style={{ gap: sp['spacing-sm'] }} testID="panel-edit-form">
      <AmountInput
        testID="panel-edit-amount"
        label={t('add.amount')}
        value={text}
        onChange={(v, m) => {
          setText(v);
          setMinor(m);
        }}
      />
      {kind === 'transfer' ? (
        <>
          <Select label={t('add.from')} options={accounts} value={accountId} onChange={setAccountId} />
          <Select label={t('add.to')} options={accounts.filter((a) => a.value !== accountId)} value={toId} onChange={setToId} />
        </>
      ) : (
        <>
          {!split || minor !== abs ? (
            <Select testID="panel-edit-category" label={t('add.category')} options={categories} value={categoryId} onChange={setCategoryId} />
          ) : null}
          {kind === 'expense' ? <Select label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} /> : null}
        </>
      )}
      <DatePicker label={t('add.date')} value={date} onChange={setDate} />
      <Text variant="caption" tone="textSecondary">
        {t('panel.correctionNote')}
      </Text>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
        <Button kind="secondary" label={t('common.cancel')} onPress={onDone} />
        <Button testID="panel-save" label={t('panel.save')} disabled={minor === null || minor <= 0n} onPress={() => void save()} />
      </View>
    </View>
  );
}

function RefundForm({ event, left, onDone }: { event: TxEvent; left: bigint; onDone: () => void }) {
  const { repo, snapshot } = useWorkspace();
  const toast = useToast();
  const accountIds = new Set((snapshot?.accounts ?? []).map((a) => a.id));
  const [text, setText] = useState('');
  const [minor, setMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState<string | null>(event.lines.find((l) => accountIds.has(l.ledgerAccountId))?.ledgerAccountId ?? null);
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const too = minor !== null && minor > left;

  const save = async () => {
    if (minor === null || !accountId) return;
    const r = await repo.addRefund(event.id, { accountId, amount: minor, date });
    if (!r.ok) return setError(r.error === 'refund_too_large' ? t('ledger.error.refund_too_large', { amount: formatNaira(left) }) : ledgerMessage(r.error));
    toast.show(t('panel.refundSaved'));
    onDone();
  };

  return (
    <View style={{ gap: sp['spacing-sm'] }} testID="refund-form">
      <AmountInput
        testID="refund-amount"
        label={t('panel.refundAmount')}
        value={text}
        onChange={(v, m) => {
          setText(v);
          setMinor(m);
        }}
      />
      {too ? <InlineError testID="refund-error" message={t('ledger.error.refund_too_large', { amount: formatNaira(left) })} /> : null}
      <Select
        label={t('panel.refundInto')}
        options={(snapshot?.accounts ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      <DatePicker label={t('add.date')} value={date} onChange={setDate} />
      {error ? <InlineError message={error} /> : null}
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
        <Button kind="secondary" label={t('common.cancel')} onPress={onDone} />
        <Button testID="refund-save" label={t('panel.saveRefund')} disabled={minor === null || minor <= 0n || too} onPress={() => void save()} />
      </View>
    </View>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Amount, AmountInput, Button, DatePicker, InlineError, Panel, PillTag, Select, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Snapshot, TransactionInput, TxEvent } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { purchaseCost, refundedSoFar } from '@/ledger';
import { formatNaira } from '@/money';

import { ruleFromTransaction } from '@/features/rules/helpers';

import { ledgerMessage, today } from './helpers';
import { duplicateInput } from './duplicate';
import { connectedLines } from './panelConnected';
import { ReceiptViewer } from './ReceiptViewer';
import { parseReceipt, stripReceiptLine, withReceipt } from './receiptMeta';
import { parseTags, stripTagsLine, withTags } from './tags';

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
  const [error, setError] = useState<string | null>(null);
  const waiting = snapshot?.waiting.has(id) ?? false;

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

  const connected = connectedLines(snapshot, event);
  const splitParts = event.type === 'expense' && others.length > 1 ? others : [];

  const duplicate = async () => {
    const input = duplicateInput(snapshot, event);
    if (!input) return setError(t('panel.duplicateUnsupported'));
    const r = await repo.addTransaction(input);
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      toast.show(t('panel.duplicated'));
      onClose();
    }
  };
  const remove = async () => {
    const r = await repo.deleteTransaction(event.id, today());
    if (!r.ok) return setError(ledgerMessage(r.error));
    onClose();
    toast.show(t('tx.deleted'), () => void repo.restore(event));
  };

  return (
    <Panel visible title={t('panel.title')} onClose={onClose} testID="tx-panel" width={440}>
      <View style={{ gap: sp['spacing-lg'] }}>
        <View style={{ gap: sp['spacing-xs'] }}>
          <Amount minor={amount} variant="display-md" signed={event.type !== 'transfer'} testID="panel-amount" />
          <View style={{ flexDirection: 'row', gap: sp['spacing-xs'], flexWrap: 'wrap' }}>
            <PillTag label={t(`panel.type.${event.type}`)} />
            {event.correctionOf ? <PillTag label={t('panel.edited')} /> : null}
            {waiting ? <PillTag label={t('tx.waiting')} /> : null}
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
          {field(
            t('panel.status'),
            t(event.status === 'reversed' ? 'panel.status.reversed' : waiting ? 'tx.waiting' : 'panel.status.posted'),
          )}
        </View>

        {event.reconciledBy ? (
          <View style={{ gap: sp['spacing-sm'] }} testID="panel-locked">
            <PillTag label={t('panel.locked')} />
            <Text tone="textSecondary">{t('panel.unlockBody')}</Text>
            <Button
              kind="secondary"
              testID="panel-unlock"
              label={t('panel.unlockConfirm')}
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
                router.setParams({ tx: nextId, txn: nextId });
              }}
            />
          ) : (
            <Button kind="secondary" testID="panel-edit" label={t('panel.edit')} onPress={() => setEditing(true)} />
          )
        ) : null}

        <NotesField key={event.id} event={event} />
        <TagsField key={`tags-${event.id}`} event={event} />
        <ReceiptField event={event} />

        {splitParts.length > 0 ? (
          <View testID="panel-split" style={{ gap: sp['spacing-xs'] }}>
            <Text variant="heading-sm">{t('panel.splitTitle')}</Text>
            {splitParts.map((p) => (
              <View key={p.ledgerAccountId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text tone="textSecondary">{names.get(p.ledgerAccountId)}</Text>
                <Amount minor={p.amountMinor} variant="caption" />
              </View>
            ))}
          </View>
        ) : null}

        {connected.length > 0 ? (
          <View style={{ gap: sp['spacing-xs'] }} testID="panel-connected-links">
            <Text variant="heading-sm">{t('panel.connected')}</Text>
            {connected.map((line) => (
              <Text key={line.key} tone="textSecondary">
                {line.label}
                {line.detail ? `: ${line.detail}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {event.type === 'expense' ? (
          <View style={{ gap: sp['spacing-sm'] }} testID="panel-connected">
            <Text variant="heading-sm" accessibilityRole="header">
              {t('panel.refundsTitle')}
            </Text>
            {refunds.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{t('panel.refundOn', { date: r.date })}</Text>
                <Amount minor={amountOf(snapshot, r)} signed />
              </View>
            ))}
            {left > 0n && event.status === 'posted' ? (
              <Button kind="link" testID="panel-add-refund" label={t('panel.addRefund')} onPress={() => router.setParams({ refund: event.id })} />
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <Button kind="secondary" testID="panel-duplicate" label={t('panel.duplicate')} onPress={() => void duplicate()} />
          {event.status === 'posted' && (event.type === 'expense' || event.type === 'income') ? (
            <Button
              kind="secondary"
              testID="panel-new-rule"
              label={t('panel.newRuleFromThis')}
              onPress={() => {
                void (async () => {
                  const draft = ruleFromTransaction({
                    payeeName: payee,
                    description: event.notes,
                    categoryId: others[0]?.ledgerAccountId,
                  });
                  const rule = await repo.createRule({ ...draft, order: snapshot.rules.length });
                  onClose();
                  router.push(`/rules?rule=${rule.id}`);
                })();
              }}
            />
          ) : null}
          {event.status === 'posted' && !event.reconciledBy ? (
            <Button kind="secondary" testID="panel-delete" label={t('tx.delete')} onPress={() => void remove()} />
          ) : null}
        </View>
      </View>
    </Panel>
  );
}

function TagsField({ event }: { event: TxEvent }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [tags, setTags] = useState(() => parseTags(event.notes));
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const persist = (next: string[]) => {
    setTags(next);
    void repo.updateNotes(event.id, withTags(event.notes, next) ?? '').then(() => toast.show(t('common.saved')));
  };
  return (
    <View style={{ gap: sp['spacing-xs'] }} testID="panel-tags">
      <Text variant="caption" tone="textSecondary">
        {t('add.tags')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
        {tags.map((tag) => (
          <PillTag key={tag} label={tag} selected onPress={() => persist(tags.filter((x) => x !== tag))} />
        ))}
        <Button kind="link" testID="panel-add-tag" label={t('add.addTag')} onPress={() => setAdding(true)} />
      </View>
      {adding ? (
        <TextInput
          testID="panel-tag-input"
          label={t('add.tagName')}
          value={draft}
          onChangeText={setDraft}
          onBlur={() => {
            if (draft.trim()) persist([...tags, draft.trim()]);
            setDraft('');
            setAdding(false);
          }}
        />
      ) : null}
    </View>
  );
}

function ReceiptField({ event }: { event: TxEvent }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const router = useRouter();
  const raw = parseReceipt(event.notes) ?? '';
  const [link, setLink] = useState(raw);
  const [receiptOpen, setReceiptOpen] = useState(false);
  return (
    <>
      <TextInput
        testID="panel-receipt-link"
        label={t('panel.receiptLink')}
        value={link}
        onChangeText={setLink}
        onBlur={() => {
          const next = withReceipt(event.notes, link.trim() || null) ?? '';
          if ((event.notes ?? '') === next) return;
          void repo.updateNotes(event.id, next).then(() => toast.show(t('common.saved')));
        }}
      />
      {link ? (
        <Button
          kind="link"
          testID="panel-receipt"
          label={t('panel.viewReceipt')}
          onPress={() => {
            setReceiptOpen(true);
            router.setParams({ receipt: link });
          }}
        />
      ) : null}
      {receiptOpen ? (
        <ReceiptViewer
          fileId={link}
          onClose={() => {
            setReceiptOpen(false);
            router.setParams({ receipt: undefined });
          }}
          onReplace={(next) => {
            setLink(next);
            void repo.updateNotes(event.id, withReceipt(event.notes, next) ?? '').then(() => toast.show(t('common.saved')));
            router.setParams({ receipt: next });
          }}
          onRemove={() => {
            setLink('');
            setReceiptOpen(false);
            void repo.updateNotes(event.id, withReceipt(event.notes, null) ?? '').then(() => toast.show(t('common.saved')));
            router.setParams({ receipt: undefined });
          }}
        />
      ) : null}
    </>
  );
}

function NotesField({ event }: { event: TxEvent }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [notes, setNotes] = useState(stripTagsLine(stripReceiptLine(event.notes)));
  return (
    <TextInput
      testID="panel-notes"
      label={t('add.notes')}
      value={notes}
      onChangeText={setNotes}
      onBlur={() => {
        const receipt = parseReceipt(event.notes);
        const tags = parseTags(event.notes);
        let next = notes.trim() || undefined;
        next = withReceipt(next, receipt);
        next = withTags(next, tags);
        if ((event.notes ?? '') === (next ?? '')) return;
        void repo.updateNotes(event.id, next ?? '').then(() => toast.show(t('common.saved')));
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

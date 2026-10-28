import { useGlobalSearchParams, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import {
  AmountInput,
  Button,
  Confirm,
  DatePicker,
  Footer,
  InlineError,
  Menu,
  PillTag,
  Select,
  Sheet,
  Switch,
  Tabs,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import type { Snapshot, TransactionInput } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { MoneyBackPrompt } from '@/features/debts/MoneyBackPrompt';
import { suggestMoneyBack, type MoneyBackChoice, type MoneyBackSuggestion } from '@/features/debts/moneyBack';

import { addDays, lastUsedAccount, ledgerMessage, today } from './helpers';
import { AddMovementDoorSheet, type MovementDoor } from './AddMovementDoors';

const sp = tokens.spacing;

export type AddKind = 'expense' | 'income' | 'transfer';
const KINDS: AddKind[] = ['expense', 'income', 'transfer'];

type Prefill = { accountId?: string; date?: string };
type AddApi = { open: (kind?: AddKind, prefill?: Prefill) => void };
const Ctx = createContext<AddApi | null>(null);

/** For the frame, which also renders outside the signed-in area in tests. */
export function useOptionalAddTransaction(): AddApi | null {
  return useContext(Ctx);
}

export function useAddTransaction(): AddApi {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAddTransaction must be used inside AddTransactionProvider');
  return value;
}

/** The global Add transaction popup. Its state lives in the address (`?add=expense`), so a refresh keeps it open (E-16). */
export function AddTransactionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useGlobalSearchParams<{ add?: string; account?: string; date?: string }>();
  const kind = KINDS.includes(params.add as AddKind) ? (params.add as AddKind) : null;
  const open = useCallback(
    (k: AddKind = 'expense', prefill: Prefill = {}) => router.setParams({ add: k, account: prefill.accountId, date: prefill.date }),
    [router],
  );
  const close = useCallback(() => router.setParams({ add: undefined, account: undefined, date: undefined }), [router]);
  const api = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'n') return;
      e.preventDefault();
      open('expense');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {kind ? (
        <AddTransactionSheet
          kind={kind}
          prefill={{ accountId: params.account, date: params.date }}
          onKind={(k) => open(k, { accountId: params.account, date: params.date })}
          onClose={close}
        />
      ) : null}
    </Ctx.Provider>
  );
}

type Part = { categoryId: string | null; text: string; minor: bigint | null };

function AddTransactionSheet({ kind, prefill, onKind, onClose }: { kind: AddKind; prefill: Prefill; onKind: (k: AddKind) => void; onClose: () => void }) {
  const { repo, snapshot } = useWorkspace();
  const toast = useToast();
  const [movementDoor, setMovementDoor] = useState<MovementDoor | null>(null);
  const accounts = useMemo(() => (snapshot?.accounts ?? []).filter((a) => !a.archived), [snapshot]);
  const [amount, setAmount] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(prefill.accountId ?? (snapshot ? lastUsedAccount(snapshot) : null));
  const [toId, setToId] = useState<string | null>(null);
  const [date, setDate] = useState(prefill.date ?? today());
  const [notes, setNotes] = useState('');
  const [split, setSplit] = useState(false);
  const [repeats, setRepeats] = useState(false);
  const [attachReceipt, setAttachReceipt] = useState(false);
  const [receiptLink, setReceiptLink] = useState('');
  const [parts, setParts] = useState<Part[]>([
    { categoryId: null, text: '', minor: null },
    { categoryId: null, text: '', minor: null },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [moneyBack, setMoneyBack] = useState<{ suggestion: MoneyBackSuggestion; another: boolean } | null>(null);

  const dirty = amount.text !== '' || payee !== '' || notes !== '' || categoryId !== null;
  const categories = (snapshot?.categories ?? []).filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense') && !c.hidden);
  const recentPayees = recentPayeesFor(snapshot, kind);
  const assigned = parts.reduce((s, p) => s + (p.minor ?? 0n), 0n);
  const leftToAssign = (amount.minor ?? 0n) - assigned;

  const valid =
    amount.minor !== null &&
    amount.minor > 0n &&
    accountId !== null &&
    (kind === 'transfer'
      ? toId !== null && toId !== accountId
      : split && kind === 'expense'
        ? leftToAssign === 0n && parts.every((p) => p.categoryId && p.minor && p.minor > 0n)
        : categoryId !== null);

  const reset = () => {
    setAmount({ text: '', minor: null });
    setPayee('');
    setCategoryId(null);
    setNotes('');
    setSplit(false);
    setParts([
      { categoryId: null, text: '', minor: null },
      { categoryId: null, text: '', minor: null },
    ]);
    setError(null);
  };

  const finishSave = async (another: boolean, posted: { id: string; date: string }) => {
    if (repeats && kind === 'expense' && categoryId && accountId && amount.minor) {
      await repo.addRecurring({
        kind: 'bill',
        name: payee.trim() || t('plan.name'),
        amountMinor: amount.minor.toString(),
        accountId,
        categoryId,
        rule: { every: 'month', on: Number(date.slice(8, 10)) || 1 },
        startDate: date,
      });
    }
    if (repeats && kind === 'income' && categoryId && accountId && amount.minor) {
      await repo.addIncomeStream({
        name: payee.trim() || t('income.name'),
        kind: 'regular',
        expectedMinor: amount.minor.toString(),
        accountId,
        categoryId,
        rule: { every: 'month', on: Number(date.slice(8, 10)) || 1 },
        countInBudget: true,
      });
    }
    toast.show(t('add.saved'), () => void repo.deleteTransaction(posted.id, posted.date));
    if (another) reset();
    else onClose();
  };

  const postNormal = async (another: boolean) => {
    if (!valid || !accountId || amount.minor === null) return;
    const notesCombined = [attachReceipt && receiptLink.trim() ? `receipt:${receiptLink.trim()}` : '', notes.trim()].filter(Boolean).join('\n');
    const input: TransactionInput =
      kind === 'transfer'
        ? { kind, fromId: accountId, toId: toId!, amount: amount.minor, date, notes: notesCombined || undefined }
        : kind === 'income'
          ? { kind, accountId, categoryId: categoryId!, amount: amount.minor, date, payeeName: payee, notes: notesCombined || undefined }
          : {
              kind,
              accountId,
              date,
              payeeName: payee,
              notes: notesCombined || undefined,
              parts: split ? parts.map((p) => ({ categoryId: p.categoryId!, amount: p.minor! })) : [{ categoryId: categoryId!, amount: amount.minor }],
            };
    const result = await repo.addTransaction(input);
    if (!result.ok) {
      setError(ledgerMessage(result.error));
      return;
    }
    await finishSave(another, result.value);
  };

  const save = async (another: boolean) => {
    if (!valid || !accountId || amount.minor === null || !snapshot) return;
    setBusy(true);
    setError(null);
    if ((kind === 'income' || kind === 'expense') && !split) {
      const suggestions = suggestMoneyBack(snapshot, {
        amount: amount.minor,
        date,
        accountId,
        payeeName: payee,
        movement: kind,
      });
      if (suggestions[0]) {
        setBusy(false);
        setMoneyBack({ suggestion: suggestions[0], another });
        return;
      }
    }
    await postNormal(another);
    setBusy(false);
  };

  const onMoneyBackChoice = async (choice: MoneyBackChoice) => {
    if (!moneyBack || !accountId || amount.minor === null) return;
    const { suggestion, another } = moneyBack;
    setMoneyBack(null);
    setBusy(true);
    setError(null);
    if (choice === 'money_back') {
      const result = await repo.confirmMoneyBack(
        {
          debtId: suggestion.debtId,
          amount: suggestion.amount,
          date: suggestion.date,
          accountId: suggestion.accountId,
          payeeId: suggestion.payeeId,
        },
        'money_back',
      );
      setBusy(false);
      if (!result.ok) {
        setError(ledgerMessage(result.error));
        return;
      }
      toast.show(t('add.saved'), () => void repo.deleteTransaction(result.value.id, result.value.date));
      if (another) reset();
      else onClose();
      return;
    }
    await postNormal(another);
    setBusy(false);
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <Sheet
        visible
        testID="add-transaction"
        title={t('add.title')}
        onClose={requestClose}
        footer={
          <Footer>
            <Button kind="secondary" testID="save-another" label={t('add.saveAnother')} disabled={!valid || busy} onPress={() => void save(true)} />
            <Button testID="save-transaction" label={t('add.save')} disabled={!valid || busy} onPress={() => void save(false)} />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Tabs testID="add-kind" options={KINDS.map((k) => ({ value: k, label: t(`add.kind.${k}`) }))} value={kind} onChange={onKind} />
          </View>
          <Menu
            testID="add-more-menu"
            trigger={(open) => <Button kind="secondary" size="sm" testID="add-more" label={t('add.more')} onPress={open} />}
            items={[
              { key: 'lend', label: t('add.door.lend'), onPress: () => setMovementDoor('lend') },
              { key: 'payment', label: t('add.door.payment'), onPress: () => setMovementDoor('debtPayment') },
              { key: 'allocate', label: t('add.door.allocate'), onPress: () => setMovementDoor('allocate') },
              { key: 'spend', label: t('add.door.spend'), onPress: () => setMovementDoor('spend') },
              { key: 'investment', label: t('add.door.investment'), onPress: () => setMovementDoor('investment') },
            ]}
          />
        </View>
          {accounts.length === 0 ? <InlineError message={t('add.noAccounts')} /> : null}
          <AmountInput testID="add-amount" label={t('add.amount')} value={amount.text} onChange={(text, minor) => setAmount({ text, minor })} />

          {kind === 'transfer' ? (
            <>
              <Select testID="add-from" label={t('add.from')} options={accountOptions} value={accountId} onChange={setAccountId} />
              <Select testID="add-to" label={t('add.to')} options={accountOptions.filter((o) => o.value !== accountId)} value={toId} onChange={setToId} />
              <Text tone="textSecondary" variant="caption">
                {t('add.transferNote')}
              </Text>
            </>
          ) : (
            <>
              <TextInput testID="add-payee" label={t('add.payee')} value={payee} onChangeText={setPayee} />
              {recentPayees.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                  {recentPayees.map((p) => (
                    <PillTag
                      key={p.id}
                      label={p.name}
                      selected={payee === p.name}
                      onPress={() => {
                        setPayee(p.name);
                        if (p.defaultCategoryId && categories.some((c) => c.id === p.defaultCategoryId)) setCategoryId(p.defaultCategoryId);
                      }}
                    />
                  ))}
                </View>
              ) : null}
              {split && kind === 'expense' ? (
                <View style={{ gap: sp['spacing-sm'] }} testID="split-rows">
                  {parts.map((p, i) => (
                    <View key={i} style={{ gap: sp['spacing-xs'] }}>
                      <Select
                        testID={`split-category-${i}`}
                        label={t('add.splitCategory', { n: i + 1 })}
                        options={categoryOptions}
                        value={p.categoryId}
                        onChange={(v) => setParts(parts.map((x, j) => (j === i ? { ...x, categoryId: v } : x)))}
                      />
                      <AmountInput
                        testID={`split-amount-${i}`}
                        label={t('add.splitAmount', { n: i + 1 })}
                        value={p.text}
                        onChange={(text, minor) => setParts(parts.map((x, j) => (j === i ? { ...x, text, minor } : x)))}
                      />
                    </View>
                  ))}
                  <Button kind="link" label={t('add.splitAddRow')} onPress={() => setParts([...parts, { categoryId: null, text: '', minor: null }])} />
                  <Text testID="split-left" tone={leftToAssign === 0n ? 'textSecondary' : 'text'}>
                    {t('add.leftToAssign', { amount: formatNaira(leftToAssign) })}
                  </Text>
                </View>
              ) : (
                <View accessibilityLabel={t('add.category')} style={{ gap: sp['spacing-xs'] }}>
                  <Text variant="caption" tone="textSecondary">
                    {t('add.category')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                    {categories.map((c) => (
                      <PillTag key={c.id} testID={`category-${c.id}`} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                    ))}
                  </View>
                </View>
              )}
              <Select testID="add-account" label={t('add.account')} options={accountOptions} value={accountId} onChange={setAccountId} />
            </>
          )}

          <View style={{ gap: sp['spacing-xs'] }}>
            <View style={{ flexDirection: 'row', gap: sp['spacing-xs'] }}>
              <PillTag label={t('add.today')} selected={date === today()} onPress={() => setDate(today())} />
              <PillTag label={t('add.yesterday')} selected={date === addDays(today(), -1)} onPress={() => setDate(addDays(today(), -1))} />
            </View>
            <DatePicker testID="add-date" label={t('add.date')} value={date} onChange={setDate} />
          </View>
          <TextInput testID="add-notes" label={t('add.notes')} value={notes} onChangeText={setNotes} />
          {kind === 'expense' ? <Switch testID="add-split" label={t('add.split')} value={split} onChange={setSplit} /> : null}
          {(kind === 'expense' || kind === 'income') && (
            <Switch testID="add-repeats" label={t('add.repeats')} value={repeats} onChange={setRepeats} />
          )}
          {kind !== 'transfer' ? (
            <>
              <Switch testID="add-receipt" label={t('add.receipt')} value={attachReceipt} onChange={setAttachReceipt} />
              {attachReceipt ? (
                <TextInput testID="add-receipt-link" label={t('add.receiptLink')} value={receiptLink} onChangeText={setReceiptLink} />
              ) : null}
            </>
          ) : null}
          {error ? <InlineError testID="add-error" message={error} /> : null}
        </View>
      </Sheet>
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
      {movementDoor ? <AddMovementDoorSheet door={movementDoor} onClose={() => setMovementDoor(null)} /> : null}
      {moneyBack ? (
        <MoneyBackPrompt
          suggestion={moneyBack.suggestion}
          onChoice={(c) => void onMoneyBackChoice(c)}
          onClose={() => setMoneyBack(null)}
        />
      ) : null}
    </>
  );
}

function recentPayeesFor(snapshot: Snapshot | null, kind: AddKind) {
  if (!snapshot || kind === 'transfer') return [];
  const seen = new Set<string>();
  const out = [];
  for (const e of snapshot.events) {
    if (e.type !== kind || !e.payeeId || seen.has(e.payeeId)) continue;
    seen.add(e.payeeId);
    const p = snapshot.payees.find((x) => x.id === e.payeeId);
    if (p) out.push(p);
    if (out.length === 6) break;
  }
  return out;
}

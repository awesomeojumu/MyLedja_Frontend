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
import { ruleChangeFor } from '@/features/rules/ruleEngine';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { MoneyBackPrompt } from '@/features/debts/MoneyBackPrompt';
import { suggestMoneyBack, type MoneyBackChoice, type MoneyBackSuggestion } from '@/features/debts/moneyBack';

import { addDays, lastUsedAccount, ledgerMessage, today } from './helpers';
import { AddMovementDoorSheet, type MovementDoor } from './AddMovementDoors';
import { pickImageUri } from '@/features/payees/pickMedia';

import { withReceipt } from './receiptMeta';
import { withTags } from './tags';

const sp = tokens.spacing;
const LAST_TAB_KEY = 'myledja:add-txn-last-tab';

/** Wealth (buy/sell/dividend) has not shipped in nav yet — hide from More (PU01-7). */
const MORE_DOORS: { key: MovementDoor; labelKey: 'add.door.lend' | 'add.door.payment' | 'add.door.allocate' | 'add.door.spend' }[] = [
  { key: 'lend', labelKey: 'add.door.lend' },
  { key: 'debtPayment', labelKey: 'add.door.payment' },
  { key: 'allocate', labelKey: 'add.door.allocate' },
  { key: 'spend', labelKey: 'add.door.spend' },
];

export type AddKind = 'expense' | 'income' | 'transfer';
const KINDS: AddKind[] = ['expense', 'income', 'transfer'];

type Prefill = { accountId?: string; date?: string; goalName?: string };
type AddApi = { open: (kind?: AddKind, prefill?: Prefill) => void };
const Ctx = createContext<AddApi | null>(null);

export function useOptionalAddTransaction(): AddApi | null {
  return useContext(Ctx);
}

export function useAddTransaction(): AddApi {
  const value = useContext(Ctx);
  if (!value) throw new Error('useAddTransaction must be used inside AddTransactionProvider');
  return value;
}

function readLastTab(): AddKind {
  if (typeof globalThis.localStorage === 'undefined') return 'expense';
  const v = globalThis.localStorage.getItem(LAST_TAB_KEY);
  return KINDS.includes(v as AddKind) ? (v as AddKind) : 'expense';
}

function writeLastTab(kind: AddKind) {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(LAST_TAB_KEY, kind);
}

/** The global Add transaction popup. Its state lives in the address (`?add=expense`), so a refresh keeps it open (E-16 / PU00-5). */
export function AddTransactionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useGlobalSearchParams<{ add?: string; account?: string; date?: string; goal?: string }>();
  const kind = KINDS.includes(params.add as AddKind) ? (params.add as AddKind) : null;
  const open = useCallback(
    (k: AddKind = readLastTab(), prefill: Prefill = {}) => {
      writeLastTab(k);
      router.setParams({ add: k, account: prefill.accountId, date: prefill.date, goal: prefill.goalName });
    },
    [router],
  );
  const close = useCallback(() => router.setParams({ add: undefined, account: undefined, date: undefined, goal: undefined }), [router]);
  const api = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'n') return;
      e.preventDefault();
      open(readLastTab());
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
          prefill={{ accountId: params.account, date: params.date, goalName: params.goal }}
          onKind={(k) => {
            writeLastTab(k);
            open(k, { accountId: params.account, date: params.date, goalName: params.goal });
          }}
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
  const [toAmount, setToAmount] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(prefill.accountId ?? (snapshot ? lastUsedAccount(snapshot) : null));
  const [toId, setToId] = useState<string | null>(null);
  const [date, setDate] = useState(prefill.date ?? today());
  const [dateError, setDateError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const suggestCategory = (name: string, payeeCategory?: string, replace = false) => {
    if (!snapshot || (categoryId && !replace)) return;
    const fromRules = ruleChangeFor(snapshot.rules, {
      payeeName: name,
      description: name,
      amountMinor: amount.minor ?? 0n,
      accountId: accountId ?? '',
      categoryId: '',
      notes: '',
      date,
    }).categoryId;
    const pick = fromRules ?? payeeCategory;
    if (pick && categories.some((c) => c.id === pick)) setCategoryId(pick);
  };
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

  const dirty = amount.text !== '' || payee !== '' || notes !== '' || categoryId !== null || tags.length > 0;
  const categories = (snapshot?.categories ?? []).filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense') && !c.hidden);
  const recentCategoryIds = recentCategoriesFor(snapshot, kind);
  const visibleCategories = allCategories ? categories : categories.filter((c) => recentCategoryIds.includes(c.id)).slice(0, 8);
  const categoryGrid = visibleCategories.length > 0 ? visibleCategories : categories.slice(0, 8);
  const recentPayees = recentPayeesFor(snapshot, kind);
  const assigned = parts.reduce((s, p) => s + (p.minor ?? 0n), 0n);
  const leftToAssign = (amount.minor ?? 0n) - assigned;
  const fromAccount = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toId);
  const fxTransfer = kind === 'transfer' && !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency;
  const sameAccount = kind === 'transfer' && !!accountId && accountId === toId;
  const futureDate = date > today();
  const rateCaption =
    fxTransfer && amount.minor && toAmount.minor && toAmount.minor > 0n
      ? t('add.fxRate', { rate: formatNaira((amount.minor * 100n) / toAmount.minor) })
      : null;

  const valid =
    amount.minor !== null &&
    amount.minor > 0n &&
    accountId !== null &&
    !futureDate &&
    (kind === 'transfer'
      ? toId !== null && toId !== accountId && (!fxTransfer || (toAmount.minor !== null && toAmount.minor > 0n))
      : split && kind === 'expense'
        ? leftToAssign === 0n && parts.every((p) => p.categoryId && p.minor && p.minor > 0n)
        : categoryId !== null);

  const reset = () => {
    setAmount({ text: '', minor: null });
    setToAmount({ text: '', minor: null });
    setPayee('');
    setCategoryId(null);
    setNotes('');
    setTags([]);
    setSplit(false);
    setParts([
      { categoryId: null, text: '', minor: null },
      { categoryId: null, text: '', minor: null },
    ]);
    setError(null);
    setDateError(null);
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

  const combinedNotes = () => {
    let n = notes.trim() || undefined;
    n = withReceipt(n, attachReceipt && receiptLink.trim() ? receiptLink.trim() : null);
    n = withTags(n, tags);
    return n;
  };

  const postNormal = async (another: boolean) => {
    if (!valid || !accountId || amount.minor === null) return;
    const notesCombined = combinedNotes();
    const input: TransactionInput =
      kind === 'transfer'
        ? {
            kind,
            fromId: accountId,
            toId: toId!,
            amount: amount.minor,
            date,
            notes: notesCombined,
            toAmount: fxTransfer ? toAmount.minor! : undefined,
          }
        : kind === 'income'
          ? { kind, accountId, categoryId: categoryId!, amount: amount.minor, date, payeeName: payee, notes: notesCombined }
          : {
              kind,
              accountId,
              date,
              payeeName: payee,
              notes: notesCombined,
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
    if (futureDate) {
      setDateError(t('add.dateFuture'));
      return;
    }
    if (!valid || !accountId || amount.minor === null || !snapshot || busy) return;
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
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const saveLabel = kind === 'transfer' ? t('add.saveTransfer') : t('add.saveTransaction');

  return (
    <>
      <Sheet
        visible
        testID="add-transaction"
        title={t('add.title')}
        onClose={requestClose}
        width={480}
        footer={
          <Footer>
            <Button kind="secondary" testID="save-another" label={t('add.saveAnother')} disabled={!valid || busy} onPress={() => void save(true)} />
            <Button testID="save-transaction" label={saveLabel} disabled={!valid || busy} onPress={() => void save(false)} />
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
              trigger={(openMenu) => <Button kind="secondary" size="sm" testID="add-more" label={t('add.more')} onPress={openMenu} />}
              items={MORE_DOORS.map((d) => ({ key: d.key, label: t(d.labelKey), onPress: () => setMovementDoor(d.key) }))}
            />
          </View>
          {prefill.goalName ? (
            <Text testID="add-goal-line" tone="textSecondary">
              {t('add.fromGoal', { name: prefill.goalName })}
            </Text>
          ) : null}
          {accounts.length === 0 ? <InlineError message={t('add.noAccounts')} /> : null}
          <AmountInput testID="add-amount" label={t('add.amount')} value={amount.text} onChange={(text, minor) => setAmount({ text, minor })} />

          {kind === 'transfer' ? (
            <>
              <Select testID="add-from" label={t('add.from')} options={accountOptions} value={accountId} onChange={setAccountId} />
              <Select testID="add-to" label={t('add.to')} options={accountOptions.filter((o) => o.value !== accountId)} value={toId} onChange={setToId} />
              {sameAccount ? <InlineError testID="add-same-account" message={t('ledger.error.transfer_accounts')} /> : null}
              {fxTransfer ? (
                <>
                  <AmountInput
                    testID="add-to-amount"
                    label={t('add.amountReceived', { currency: toAccount?.currency ?? '' })}
                    value={toAmount.text}
                    onChange={(text, minor) => setToAmount({ text, minor })}
                  />
                  {rateCaption ? (
                    <Text testID="add-fx-rate" tone="textSecondary" variant="caption">
                      {rateCaption}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Text tone="textSecondary" variant="caption">
                {t('add.transferNote')}
              </Text>
            </>
          ) : (
            <>
              <TextInput
                testID="add-payee"
                label={t('add.payee')}
                value={payee}
                onChangeText={setPayee}
                onBlur={() => {
                  const name = payee.trim();
                  if (!name || !snapshot) return;
                  const found =
                    snapshot.payees.find((p) => p.name.toLowerCase() === name.toLowerCase()) ??
                    snapshot.payees.find((p) => (p.aliases ?? []).some((a) => a.toLowerCase() === name.toLowerCase()));
                  suggestCategory(name, found?.defaultCategoryId);
                }}
              />
              {recentPayees.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                  {recentPayees.map((p) => (
                    <PillTag
                      key={p.id}
                      label={p.name}
                      selected={payee === p.name}
                      onPress={() => {
                        setPayee(p.name);
                        suggestCategory(p.name, p.defaultCategoryId, true);
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
                    {categoryGrid.map((c) => (
                      <PillTag key={c.id} testID={`category-${c.id}`} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                    ))}
                    {!allCategories && categories.length > categoryGrid.length ? (
                      <Button kind="link" testID="add-all-categories" label={t('add.allCategories')} onPress={() => setAllCategories(true)} />
                    ) : null}
                  </View>
                </View>
              )}
              <Select testID="add-account" label={t('add.account')} options={accountOptions} value={accountId} onChange={setAccountId} />
              {selectedAccount?.type === 'card' ? (
                <Text testID="add-card-caption" tone="textSecondary" variant="caption">
                  {t('add.cardCaption')}
                </Text>
              ) : null}
            </>
          )}

          <View style={{ gap: sp['spacing-xs'] }}>
            <View style={{ flexDirection: 'row', gap: sp['spacing-xs'] }}>
              <PillTag label={t('add.today')} selected={date === today()} onPress={() => { setDate(today()); setDateError(null); }} />
              <PillTag label={t('add.yesterday')} selected={date === addDays(today(), -1)} onPress={() => { setDate(addDays(today(), -1)); setDateError(null); }} />
            </View>
            <DatePicker
              testID="add-date"
              label={t('add.date')}
              value={date}
              onChange={(d) => {
                setDate(d);
                setDateError(d > today() ? t('add.dateFuture') : null);
              }}
            />
            {dateError ? <InlineError testID="add-date-error" message={dateError} /> : null}
          </View>
          <TextInput testID="add-notes" label={t('add.notes')} value={notes} onChangeText={setNotes} />
          {kind !== 'transfer' ? (
            <View style={{ gap: sp['spacing-xs'] }} testID="add-tags">
              <Text variant="caption" tone="textSecondary">
                {t('add.tags')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                {tags.map((tag) => (
                  <PillTag key={tag} label={tag} selected onPress={() => setTags(tags.filter((x) => x !== tag))} />
                ))}
                <Button kind="link" testID="add-tag" label={t('add.addTag')} onPress={() => setShowTagInput(true)} />
              </View>
              {showTagInput ? (
                <TextInput
                  testID="add-tag-input"
                  label={t('add.tagName')}
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onBlur={() => {
                    if (tagDraft.trim()) setTags([...tags, tagDraft.trim()]);
                    setTagDraft('');
                    setShowTagInput(false);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {kind === 'expense' ? <Switch testID="add-split" label={t('add.split')} value={split} onChange={setSplit} /> : null}
          {(kind === 'expense' || kind === 'income') && (
            <Switch testID="add-repeats" label={t('add.repeats')} value={repeats} onChange={setRepeats} />
          )}
          {kind !== 'transfer' ? (
            <>
              <Switch testID="add-receipt" label={t('add.receipt')} value={attachReceipt} onChange={setAttachReceipt} />
              {attachReceipt ? (
                <View style={{ gap: sp['spacing-xs'] }}>
                  <Button
                    kind="secondary"
                    testID="add-receipt-photo"
                    label={t('panel.addPhoto')}
                    onPress={() => {
                      void pickImageUri().then((uri) => {
                        if (uri) setReceiptLink(uri);
                      });
                    }}
                  />
                  <TextInput testID="add-receipt-link" label={t('add.receiptLink')} value={receiptLink} onChangeText={setReceiptLink} />
                </View>
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

function recentCategoriesFor(snapshot: Snapshot | null, kind: AddKind): string[] {
  if (!snapshot || kind === 'transfer') return [];
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const seen: string[] = [];
  for (const e of snapshot.events) {
    if (e.type !== kind) continue;
    for (const l of e.lines) {
      if (accountIds.has(l.ledgerAccountId)) continue;
      if (!seen.includes(l.ledgerAccountId)) seen.push(l.ledgerAccountId);
      if (seen.length >= 8) return seen;
    }
  }
  return seen;
}

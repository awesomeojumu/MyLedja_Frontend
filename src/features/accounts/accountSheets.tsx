import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, View } from 'react-native';

import { aiApi } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMonoConnect } from '@/features/banking/monoConnect';

import {
  AmountInput,
  Button,
  Confirm,
  DatePicker,
  Footer,
  InlineError,
  PillTag,
  SegmentedControl,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_GROUPS, ACCOUNT_KIND_INFO, type Account, type AccountKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { matchInstitution, NG_INSTITUTIONS } from '@/features/setup/institutions';
import { CURRENCIES, currencyLabel } from '@/features/setup/currencies';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira, toInputText } from '@/money';
import { ledgerBalance } from '@/ledger';

import { ACCOUNT_KINDS_BY_GROUP, accountInitials } from './helpers';

const sp = tokens.spacing;

export function AccountAvatar({
  name,
  institution,
  logoUrl,
}: {
  name: string;
  institution?: string;
  logoUrl?: string | null;
}) {
  const theme = useTheme();
  const matched = institution ? matchInstitution(institution) ?? matchInstitution(name) : matchInstitution(name);
  const initials = matched?.initials ?? accountInitials(name, institution);
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: tokens.radius['rounded-md'],
        backgroundColor: theme.tagFill,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: 40, height: 40 }} accessibilityLabel={institution ?? name} />
      ) : (
        <Text variant="caption" tone="link">
          {initials}
        </Text>
      )}
    </View>
  );
}

/** Popup #13 — Add / edit account type grid (DESIGN page 8). */
export function AccountTypeGrid({ value, onChange }: { value: AccountKind | null; onChange: (k: AccountKind) => void }) {
  return (
    <View style={{ gap: sp['spacing-md'] }} accessibilityLabel={t('accounts.type')}>
      {ACCOUNT_GROUPS.map((group) => {
        const kinds = ACCOUNT_KINDS_BY_GROUP[group];
        if (kinds.length === 0) return null;
        return (
          <View key={group} style={{ gap: sp['spacing-xs'] }}>
            <Text variant="caption" tone="textSecondary">
              {t(`accounts.group.${group}`)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
              {kinds.map((k) => (
                <PillTag key={k} testID={`type-${k}`} label={t(`accounts.kind.${k}`)} selected={value === k} onPress={() => onChange(k)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const bankOptions = [
  { value: '', label: t('common.notSet') },
  ...NG_INSTITUTIONS.map((i) => ({ value: i.label, label: `${i.initials} · ${i.label}` })),
];
const currencyOptions = CURRENCIES.map((c) => ({ value: c.code, label: currencyLabel(c.code) }));

/** Popup #13 — Add account in two steps (PU-13). Opens via `?account=new`. */
export function AddAccountSheet({ onClose }: { onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<AccountKind | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [last4, setLast4] = useState('');
  const [opening, setOpening] = useState<{ text: string; minor: bigint | null }>({ text: '0', minor: 0n });
  const [date, setDate] = useState(today());
  const [countInBudget, setCountInBudget] = useState(true);
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const last4Ok = last4 === '' || /^\d{4}$/.test(last4);
  const nameOk = name.trim() !== '';
  const valid = type !== null && nameOk && last4Ok && (opening.text === '' || opening.minor !== null);
  const dirty = step === 2 && (name !== '' || institution !== '' || last4 !== '' || opening.text !== '0' || opening.minor !== 0n);

  const pickType = (k: AccountKind) => {
    setType(k);
    setCountInBudget(ACCOUNT_KIND_INFO[k].countInBudget);
    setStep(2);
  };

  const onBank = (label: string) => {
    setInstitution(label);
    if (!name.trim() && label && type) setName(`${label} ${t(`accounts.kind.${type}`)}`);
  };

  const save = async () => {
    if (!type || !valid) {
      setNameTouched(true);
      return;
    }
    setBusy(true);
    const result = await repo.addAccount({
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      last4: last4 || undefined,
      currency,
      countInBudget,
      openingBalance: opening.minor ?? 0n,
      openingDate: date,
    });
    setBusy(false);
    if (!result.ok) {
      setError(ledgerMessage(result.error));
      return;
    }
    toast.show(t('accounts.added'));
    onClose();
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());
  const owes = type ? ACCOUNT_KIND_INFO[type].ledger === 'liability' : false;

  return (
    <>
      <Sheet
        visible
        testID="add-account-sheet"
        title={step === 1 ? t('accounts.kindTitle') : t('accounts.addTitle')}
        onClose={requestClose}
        width={480}
        footer={
          step === 1 ? (
            <Footer>
              <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} />
            </Footer>
          ) : (
            <Footer>
              <Button kind="secondary" label={t('common.back')} onPress={() => setStep(1)} />
              <Button testID="save-account" label={t('accounts.save')} disabled={!valid || busy} onPress={() => void save()} />
            </Footer>
          )
        }
      >
        {step === 1 ? (
          <AccountTypeGrid value={type} onChange={pickType} />
        ) : (
          <View style={{ gap: sp['spacing-lg'] }}>
            <TextInput
              testID="account-name"
              label={t('accounts.name')}
              value={name}
              onChangeText={setName}
              onBlur={() => setNameTouched(true)}
              error={nameTouched && !nameOk ? t('accounts.nameRequired') : null}
            />
            <Select
              testID="account-institution"
              label={`${t('accounts.institution')} ${t('common.optional')}`}
              options={bankOptions}
              value={institution}
              onChange={onBank}
            />
            <Select testID="account-currency" label={t('account.currency')} options={currencyOptions} value={currency} onChange={setCurrency} />
            <TextInput
              testID="account-last4"
              label={`${t('accounts.last4')} ${t('common.optional')}`}
              value={last4}
              onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              error={last4Ok ? null : t('accounts.last4Invalid')}
            />
            <AmountInput
              testID="account-opening"
              label={owes ? t('accounts.openingOwed') : t('accounts.opening')}
              value={opening.text}
              onChange={(text, minor) => setOpening({ text, minor })}
            />
            <Text variant="caption" tone="textSecondary">
              {t('accounts.openingNote')}
            </Text>
            <DatePicker testID="account-date" label={t('accounts.openingDate')} value={date} onChange={setDate} />
            <Switch testID="account-budget" label={t('accounts.countInBudget')} value={countInBudget} onChange={setCountInBudget} />
            {error ? <InlineError message={error} /> : null}
          </View>
        )}
      </Sheet>
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

/**
 * PU-16 Connect bank — four steps: Choose → Sign in (Mono) → Match → History.
 * Cancelling at any step connects nothing. Mono code is held until step 4 finishes.
 */
export function ConnectBankSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const { client, user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => aiApi(client), [client]);
  const accounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'wallet', 'card'].includes(a.type));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [monoCode, setMonoCode] = useState<string | null>(null);
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [historyMonths, setHistoryMonths] = useState<'1' | '3' | '6' | '12'>('3');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const historyDays = ({ '1': 30, '3': 90, '6': 180, '12': 365 } as const)[historyMonths];
  const accountId = createNew ? '' : (pickedAccountId && accounts.some((a) => a.id === pickedAccountId) ? pickedAccountId : (accounts[0]?.id ?? ''));

  const cancel = () => {
    setMonoCode(null);
    onClose();
  };

  const startMono = async () => {
    setBusy(true);
    setError(null);
    setStep(2);
    try {
      const code = await openMonoConnect();
      if (!code) {
        setMonoCode(null);
        setStep(1);
        return;
      }
      setMonoCode(code);
      setStep(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : t('accounts.connect.failed'));
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!user || !monoCode) return;
    setBusy(true);
    setError(null);
    try {
      let linkAccountId = accountId;
      if (createNew) {
        const name = newName.trim() || t('accounts.connect.newAccountName');
        const created = await repo.addAccount({
          name,
          type: 'bank',
          openingBalance: 0n,
          openingDate: today(),
        });
        if (!created.ok) {
          setError(ledgerMessage(created.error));
          return;
        }
        linkAccountId = created.value.id;
      }
      if (!linkAccountId) {
        setError(t('accounts.connect.chooseAccount'));
        setStep(3);
        return;
      }
      const link = await api.linkBank(user.workspaceId, { accountId: linkAccountId, code: monoCode, historyDays });
      toast.show(t('accounts.connect.linkedImporting', { bank: link.institution }));
      await api.syncBank(user.workspaceId, link.id).catch(() => null);
      setMonoCode(null);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : t('accounts.connect.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      testID="connect-bank-sheet"
      title={t('accounts.connect.title')}
      onClose={cancel}
      width={480}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={cancel} />
          {step === 1 ? (
            <Button testID="connect-bank-continue" label={t('accounts.connect.continue')} onPress={() => void startMono()} />
          ) : step === 2 ? (
            <Button kind="secondary" testID="connect-bank-waiting-cancel" label={t('accounts.connect.waiting')} onPress={cancel} disabled={busy} />
          ) : step === 3 ? (
            <Button
              testID="connect-bank-match-continue"
              label={t('accounts.connect.continue')}
              disabled={!createNew && !accountId}
              onPress={() => setStep(4)}
            />
          ) : (
            <Button testID="connect-bank-finish" label={t('accounts.connect.connect')} disabled={busy || !monoCode} onPress={() => void finish()} />
          )}
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        {step === 1 ? (
          <>
            <Text tone="textSecondary">{t('accounts.connect.monoBody')}</Text>
            <Text variant="caption" tone="textSecondary">
              {t('accounts.connect.monoPrivacy')}
            </Text>
          </>
        ) : null}
        {step === 2 ? <Text testID="connect-bank-waiting">{t('accounts.connect.waiting')}</Text> : null}
        {step === 3 ? (
          <>
            <Text tone="textSecondary">{t('accounts.connect.matchBody')}</Text>
            <Select
              testID="connect-bank-account"
              label={t('accounts.connect.linkTo')}
              options={[
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
                { value: '__new', label: t('accounts.connect.createNew') },
              ]}
              value={createNew ? '__new' : accountId}
              onChange={(v) => {
                if (v === '__new') {
                  setCreateNew(true);
                  setPickedAccountId(null);
                } else {
                  setCreateNew(false);
                  setPickedAccountId(v);
                }
              }}
            />
            {createNew ? (
              <TextInput testID="connect-bank-new-name" label={t('accounts.name')} value={newName} onChangeText={setNewName} />
            ) : null}
          </>
        ) : null}
        {step === 4 ? (
          <SegmentedControl
            testID="connect-bank-history"
            label={t('accounts.connect.history')}
            value={historyMonths}
            onChange={setHistoryMonths}
            options={[
              { value: '1', label: t('accounts.connect.months1') },
              { value: '3', label: t('accounts.connect.months3') },
              { value: '6', label: t('accounts.connect.months6') },
              { value: '12', label: t('accounts.connect.months12') },
            ]}
          />
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

/** Popup #13 — Edit account (`?account=<id>`). Type/currency lock once there are transactions. Opening change → correction. */
export function EditAccountSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const owes = ACCOUNT_KIND_INFO[account.type].ledger === 'liability';
  const currentShown = snapshot
    ? (() => {
        const bal = ledgerBalance(account.id, snapshot.events);
        return owes ? -bal : bal;
      })()
    : 0n;
  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution ?? '');
  const [last4, setLast4] = useState(account.last4 ?? '');
  const [countInBudget, setCountInBudget] = useState(account.countInBudget);
  const [opening, setOpening] = useState<{ text: string; minor: bigint | null }>({
    text: toInputText(currentShown),
    minor: currentShown,
  });
  const [error, setError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const last4Ok = last4 === '' || /^\d{4}$/.test(last4);
  const nameOk = name.trim() !== '';
  const hasTx = (snapshot?.events ?? []).some((e) => e.status === 'posted' && e.lines.some((l) => l.ledgerAccountId === account.id));
  const openingDirty = opening.minor !== null && opening.minor !== currentShown;
  const dirty =
    name !== account.name ||
    institution !== (account.institution ?? '') ||
    last4 !== (account.last4 ?? '') ||
    countInBudget !== account.countInBudget ||
    openingDirty;

  const save = async () => {
    if (!nameOk) {
      setNameTouched(true);
      return;
    }
    setError(null);
    await repo.updateAccount({
      ...account,
      name: name.trim(),
      institution: institution.trim() || undefined,
      last4: last4 || undefined,
      countInBudget,
    });
    if (openingDirty && opening.minor !== null) {
      const r = await repo.correctOpeningBalance(account.id, opening.minor, today());
      if (!r.ok) {
        setError(ledgerMessage(r.error));
        return;
      }
    }
    toast.show(t('accounts.saved'));
    onClose();
  };

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  return (
    <>
      <Sheet
        visible
        testID="edit-account-sheet"
        title={t('account.edit')}
        onClose={requestClose}
        width={480}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} />
            <Button testID="edit-account-save" label={t('account.saveChanges')} disabled={!nameOk || !last4Ok} onPress={() => void save()} />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-lg'] }}>
          <TextInput
            testID="edit-account-name"
            label={t('accounts.name')}
            value={name}
            onChangeText={setName}
            onBlur={() => setNameTouched(true)}
            error={nameTouched && !nameOk ? t('accounts.nameRequired') : null}
          />
          <Select
            testID="edit-account-institution"
            label={`${t('accounts.institution')} ${t('common.optional')}`}
            options={bankOptions}
            value={institution}
            onChange={setInstitution}
          />
          <Text tone="textSecondary">
            {t(`accounts.kind.${account.type}` as 'accounts.kind.bank')} · {account.currency}
            {hasTx ? ` · ${t('accounts.lockedFields')}` : ''}
          </Text>
          <TextInput
            testID="edit-account-last4"
            label={`${t('accounts.last4')} ${t('common.optional')}`}
            value={last4}
            onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            error={last4Ok ? null : t('accounts.last4Invalid')}
          />
          <AmountInput
            testID="edit-account-opening"
            label={owes ? t('accounts.openingOwed') : t('accounts.editOpening')}
            value={opening.text}
            onChange={(text, minor) => setOpening({ text, minor })}
          />
          <Text variant="caption" tone="textSecondary">
            {t('accounts.openingCorrectionNote')}
          </Text>
          <Switch testID="edit-account-budget" label={t('accounts.countInBudget')} value={countInBudget} onChange={setCountInBudget} />
          {error ? <InlineError message={error} /> : null}
        </View>
      </Sheet>
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

/** Popup #14 — Update value (`?value=<accountId>`). */
export function UpdateValueSheet({ account, current, onClose }: { account: Account; current: bigint; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [value, setValue] = useState<{ text: string; minor: bigint | null }>({ text: toInputText(current), minor: current });
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = value.minor !== current || notes !== '' || date !== today();

  const delta = value.minor === null ? null : value.minor - current;
  const save = async () => {
    if (value.minor === null) return;
    const r = await repo.updateValue(account.id, value.minor, date, notes);
    if (!r.ok) return setError(ledgerMessage(r.error));
    toast.show(t('account.valueSaved'));
    onClose();
  };
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  return (
    <>
      <Sheet
        visible
        testID="value-sheet"
        title={t('account.updateValue')}
        onClose={requestClose}
        width={420}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} />
            <Button testID="value-save" label={t('account.saveValue')} disabled={value.minor === null} onPress={() => void save()} />
          </Footer>
        }
      >
        <View style={{ gap: sp['spacing-lg'] }}>
          <AmountInput testID="value-amount" label={t('account.newValue')} value={value.text} onChange={(text, minor) => setValue({ text, minor })} />
          {delta !== null ? (
            <Text testID="value-delta" tone="textSecondary">
              {t('account.valueDelta', {
                from: formatNaira(current),
                to: formatNaira(value.minor ?? current),
                change: formatNaira(delta, { signed: true }),
              })}
            </Text>
          ) : null}
          <DatePicker label={t('account.valueDate')} value={date} onChange={setDate} />
          <TextInput
            testID="value-notes"
            label={`${t('add.notes')} ${t('common.optional')}`}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
          <Text variant="caption" tone="textSecondary">
            {t('account.valueNote')}
          </Text>
          {error ? <InlineError message={error} /> : null}
        </View>
      </Sheet>
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onConfirm={onClose}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}

/** Popup #15 — Archive account (no URL). */
export function ArchiveSheet({
  account,
  balance,
  snapshot,
  onClose,
}: {
  account: Account;
  balance: bigint;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const { repo } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const others = snapshot.accounts.filter((a) => a.id !== account.id && !a.archived);
  const [mode, setMode] = useState<'move' | 'keep' | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsChoice = balance !== 0n;
  const abs = balance < 0n ? -balance : balance;

  const finish = (archivedId: string) => {
    toast.show(t('account.archived'), () => void repo.restoreAccount(archivedId));
    onClose();
    router.push('/accounts');
  };

  const archive = async () => {
    if (!needsChoice) {
      const r = await repo.archiveAccount(account.id, today());
      if (!r.ok) return setError(ledgerMessage(r.error));
      finish(account.id);
      return;
    }
    if (mode === null) return;
    if (mode === 'move' && !moveTo) return;
    const r = await repo.archiveAccount(account.id, today(), mode === 'keep' ? null : moveTo!);
    if (!r.ok) return setError(ledgerMessage(r.error));
    finish(account.id);
  };

  if (!needsChoice) {
    return (
      <Confirm
        visible
        title={t('account.archiveTitleNamed', { name: account.name })}
        body={t('account.archiveBody')}
        confirmLabel={t('account.archiveConfirm')}
        onConfirm={() => void archive()}
        onCancel={onClose}
      />
    );
  }

  const canSave = mode === 'keep' || (mode === 'move' && !!moveTo);

  return (
    <Sheet
      visible
      testID="archive-sheet"
      title={t('account.archiveTitleNamed', { name: account.name })}
      onClose={onClose}
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="archive-save" label={t('account.archiveConfirm')} disabled={!canSave} onPress={() => void archive()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-lg'] }}>
        <Text>{t('account.archiveMoveBody', { amount: formatNaira(abs) })}</Text>
        <View style={{ gap: sp['spacing-sm'] }}>
          <Button
            testID="archive-mode-move"
            kind={mode === 'move' ? 'primary-pill' : 'secondary'}
            label={t('account.archiveMoveChoice', { amount: formatNaira(abs) })}
            onPress={() => setMode('move')}
          />
          <Button
            testID="archive-mode-keep"
            kind={mode === 'keep' ? 'primary-pill' : 'secondary'}
            label={t('account.archiveKeepChoice')}
            onPress={() => setMode('keep')}
          />
        </View>
        {mode === 'move' ? (
          <Select
            testID="archive-move-to"
            label={t('account.moveTo')}
            options={others.map((a) => ({ value: a.id, label: a.name }))}
            value={moveTo}
            onChange={setMoveTo}
          />
        ) : null}
        {mode === 'keep' ? (
          <Text variant="caption" tone="textSecondary">
            {t('account.archiveKeepNote')}
          </Text>
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

/** Popup #14 — Update value from Accounts list row menu. */
export function UpdateValueSheetForAccount({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { snapshot } = useWorkspace();
  const account = snapshot?.accounts.find((a) => a.id === accountId);
  if (!account || !snapshot) return null;
  const balance = ledgerBalance(account.id, snapshot.events);
  const owes = ACCOUNT_KIND_INFO[account.type].ledger === 'liability';
  const sign = (v: bigint) => (owes ? -v : v);
  return <UpdateValueSheet account={account} current={sign(balance)} onClose={onClose} />;
}

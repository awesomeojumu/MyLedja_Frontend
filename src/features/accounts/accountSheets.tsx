import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { aiApi } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMonoConnect } from '@/features/banking/monoConnect';
import { View } from 'react-native';

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
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { ledgerBalance } from '@/ledger';

import { ACCOUNT_KINDS_BY_GROUP, accountInitials } from './helpers';

const sp = tokens.spacing;

export function AccountAvatar({ name, institution }: { name: string; institution?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: tokens.radius['rounded-md'],
        backgroundColor: theme.tagFill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" tone="link">
        {accountInitials(name, institution)}
      </Text>
    </View>
  );
}

/** Popup #13 — Add / edit account type grid (DESIGN page 8). */
export function AccountTypeGrid({ value, onChange }: { value: AccountKind; onChange: (k: AccountKind) => void }) {
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

/** Popup #13 — Add account (Accounts page 8). */
export function AddAccountSheet({ onClose }: { onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [type, setType] = useState<AccountKind>('bank');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [opening, setOpening] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [date, setDate] = useState(today());
  const [countInBudget, setCountInBudget] = useState(ACCOUNT_KIND_INFO.bank.countInBudget);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const last4Ok = last4 === '' || /^\d{4}$/.test(last4);
  const valid = name.trim() !== '' && last4Ok && (opening.text === '' || opening.minor !== null);

  const save = async () => {
    setBusy(true);
    const result = await repo.addAccount({
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      last4: last4 || undefined,
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

  const owes = ACCOUNT_KIND_INFO[type].ledger === 'liability';
  return (
    <Sheet
      visible
      testID="add-account-sheet"
      title={t('accounts.addTitle')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="save-account" label={t('accounts.save')} disabled={!valid || busy} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-lg'] }}>
        <AccountTypeGrid
          value={type}
          onChange={(k) => {
            setType(k);
            setCountInBudget(ACCOUNT_KIND_INFO[k].countInBudget);
          }}
        />
        <TextInput testID="account-name" label={t('accounts.name')} value={name} onChangeText={setName} />
        <TextInput
          testID="account-institution"
          label={`${t('accounts.institution')} ${t('common.optional')}`}
          value={institution}
          onChangeText={setInstitution}
        />
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
          {t('welcome.step3.openingNote')}
        </Text>
        <DatePicker testID="account-date" label={t('accounts.openingDate')} value={date} onChange={setDate} />
        <Switch testID="account-budget" label={t('accounts.countInBudget')} value={countInBudget} onChange={setCountInBudget} />
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

/** Popup #16 Connect bank: choose the MyLedja account, then Mono's secure screen; new transactions go to review. */
/** PU-16 Connect bank — four steps: choose → sign in → match → history. */
export function ConnectBankSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const { client, user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => aiApi(client), [client]);
  const accounts = (snapshot?.accounts ?? []).filter((a) => !a.archived && ['bank', 'savings', 'wallet', 'card'].includes(a.type));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [createNew, setCreateNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [historyMonths, setHistoryMonths] = useState<'1' | '3' | '6' | '12'>('3');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const historyDays = ({ '1': 30, '3': 90, '6': 180, '12': 365 } as const)[historyMonths];

  const cancel = () => onClose();

  const runMono = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setStep(2);
    try {
      const code = await openMonoConnect();
      if (!code) {
        setStep(1);
        return;
      }
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
          setStep(3);
          return;
        }
        linkAccountId = created.value.id;
      }
      if (!linkAccountId) {
        setError(t('accounts.connect.chooseAccount'));
        setStep(3);
        return;
      }
      setStep(4);
      const link = await api.linkBank(user.workspaceId, { accountId: linkAccountId, code, historyDays });
      toast.show(t('accounts.connect.linkedImporting', { bank: link.institution }));
      await api.syncBank(user.workspaceId, link.id).catch(() => null);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : t('accounts.connect.failed'));
      setStep(3);
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
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={cancel} />
          {step === 1 ? (
            <Button testID="connect-bank-continue" label={t('accounts.connect.continue')} onPress={() => setStep(3)} />
          ) : step === 3 ? (
            <Button
              testID="connect-bank-match-continue"
              label={t('accounts.connect.continue')}
              disabled={!createNew && !accountId}
              onPress={() => void runMono()}
            />
          ) : step === 4 ? (
            <Button testID="connect-bank-finish" label={t('accounts.connect.connect')} disabled={busy} onPress={() => void runMono()} />
          ) : (
            <Button kind="secondary" label={t('accounts.connect.waiting')} onPress={cancel} disabled={busy} />
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
                  setAccountId('');
                } else {
                  setCreateNew(false);
                  setAccountId(v);
                }
              }}
            />
            {createNew ? (
              <TextInput testID="connect-bank-new-name" label={t('accounts.name')} value={newName} onChangeText={setNewName} />
            ) : null}
          </>
        ) : null}
        {step >= 3 ? (
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

export function EditAccountSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState(account.name);
  const [institution, setInstitution] = useState(account.institution ?? '');
  const [last4, setLast4] = useState(account.last4 ?? '');
  const last4Ok = last4 === '' || /^\d{4}$/.test(last4);
  const save = async () => {
    await repo.updateAccount({ ...account, name: name.trim(), institution: institution.trim() || undefined, last4: last4 || undefined });
    toast.show(t('common.saved'));
    onClose();
  };
  return (
    <Sheet
      visible
      testID="edit-account-sheet"
      title={t('account.edit')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="edit-account-save" label={t('account.saveChanges')} disabled={!name.trim() || !last4Ok} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-lg'] }}>
        <TextInput testID="edit-account-name" label={t('accounts.name')} value={name} onChangeText={setName} />
        <TextInput label={`${t('accounts.institution')} ${t('common.optional')}`} value={institution} onChangeText={setInstitution} />
        <TextInput
          testID="edit-account-last4"
          label={`${t('accounts.last4')} ${t('common.optional')}`}
          value={last4}
          onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          error={last4Ok ? null : t('accounts.last4Invalid')}
        />
      </View>
    </Sheet>
  );
}

export function UpdateValueSheet({ account, current, onClose }: { account: Account; current: bigint; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [value, setValue] = useState<{ text: string; minor: bigint | null }>({ text: '', minor: null });
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (value.minor === null) return;
    const r = await repo.updateValue(account.id, value.minor, date);
    if (!r.ok) return setError(ledgerMessage(r.error));
    toast.show(t('account.valueSaved'));
    onClose();
  };
  return (
    <Sheet
      visible
      testID="value-sheet"
      title={t('account.updateValue')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="value-save" label={t('account.saveValue')} disabled={value.minor === null} onPress={() => void save()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-lg'] }}>
        <Text tone="textSecondary">{t('account.currentValue', { amount: formatNaira(current) })}</Text>
        <AmountInput testID="value-amount" label={t('account.newValue')} value={value.text} onChange={(text, minor) => setValue({ text, minor })} />
        <DatePicker label={t('account.valueDate')} value={date} onChange={setDate} />
        <Text variant="caption" tone="textSecondary">
          {t('account.valueNote')}
        </Text>
        {error ? <InlineError message={error} /> : null}
      </View>
    </Sheet>
  );
}

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
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsMove = balance !== 0n;
  const archive = async () => {
    const r = await repo.archiveAccount(account.id, today(), moveTo ?? undefined);
    if (!r.ok) return setError(ledgerMessage(r.error));
    toast.show(t('account.archived'));
    onClose();
    router.push('/accounts');
  };
  if (!needsMove) {
    return (
      <Confirm
        visible
        title={t('account.archiveTitle')}
        body={t('account.archiveBody')}
        confirmLabel={t('account.archive')}
        onConfirm={() => void archive()}
        onCancel={onClose}
      />
    );
  }
  return (
    <Sheet
      visible
      testID="archive-sheet"
      title={t('account.archiveTitle')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="archive-save" label={t('account.moveAndArchive')} disabled={!moveTo} onPress={() => void archive()} />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-lg'] }}>
        <Text>{t('account.archiveMoveBody', { amount: formatNaira(balance < 0n ? -balance : balance) })}</Text>
        <Select
          testID="archive-move-to"
          label={t('account.moveTo')}
          options={others.map((a) => ({ value: a.id, label: a.name }))}
          value={moveTo}
          onChange={setMoveTo}
        />
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

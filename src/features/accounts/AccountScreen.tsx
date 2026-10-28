import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Card,
  Confirm,
  DatePicker,
  EmptyState,
  formatDay,
  Footer,
  InlineError,
  Menu,
  Placeholder,
  Select,
  Sheet,
  Tabs,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ImportSheet } from '@/features/import/ImportSheet';
import { ledgerMessage, rowsFor, today, type Row } from '@/features/transactions/helpers';
import { TransactionPanel } from '@/features/transactions/TransactionPanel';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { ledgerBalance } from '@/ledger';

const sp = tokens.spacing;

type Tab = 'transactions' | 'value' | 'details';
export type RegisterRow = Row & { line: bigint; running: bigint };

/** Rows that touch the account, newest first, with the balance after each (P09-01). */
export function register(snapshot: Snapshot, accountId: string): RegisterRow[] {
  const rows = rowsFor(snapshot)
    .map((r) => ({ ...r, line: r.event.lines.filter((l) => l.ledgerAccountId === accountId).reduce((s, l) => s + l.amountMinor, 0n) }))
    .filter((r) => r.event.lines.some((l) => l.ledgerAccountId === accountId));
  let running = 0n;
  const out: RegisterRow[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!;
    running += r.line;
    out.unshift({ ...r, running });
  }
  return out;
}

export function clearedSplit(rows: RegisterRow[]): { cleared: bigint; notCleared: bigint } {
  let cleared = 0n;
  let notCleared = 0n;
  for (const r of rows)
    if (r.event.cleared) cleared += r.line;
    else notCleared += r.line;
  return { cleared, notCleared };
}

const revalued = (snapshot: Snapshot, accountId: string) =>
  snapshot.events.filter(
    (e) =>
      e.type === 'balance_adjustment' &&
      e.status === 'posted' &&
      e.lines.some((l) => l.ledgerAccountId === accountId) &&
      e.lines.some((l) => l.ledgerAccountId.endsWith(':revaluation')),
  );

export function AccountScreen() {
  const { snapshot, repo } = useWorkspace();
  const params = useGlobalSearchParams<{ id?: string; tx?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('transactions');
  const [sheet, setSheet] = useState<'import' | 'edit' | 'value' | 'archive' | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);

  const account = snapshot?.accounts.find((a) => a.id === params.id);
  const rows = useMemo(() => (snapshot && account ? register(snapshot, account.id) : []), [snapshot, account]);
  const balance = snapshot && account ? ledgerBalance(account.id, snapshot.events) : 0n;
  const owes = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const hasValue = account ? account.type === 'property' || account.type === 'investment' : false;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !account) return;
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        setDropped(text);
        setSheet('import');
      });
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [account]);

  if (snapshot && !account) {
    return (
      <AppFrame title={t('accounts.title')}>
        <EmptyState
          title={t('account.missingTitle')}
          body={t('account.missingBody')}
          actionLabel={t('account.back')}
          onAction={() => router.push('/accounts')}
        />
      </AppFrame>
    );
  }

  const split = clearedSplit(rows);
  const tabs: { value: Tab; label: string }[] = [
    { value: 'transactions', label: t('account.tab.transactions') },
    ...(hasValue ? [{ value: 'value' as const, label: t('account.tab.value') }] : []),
    { value: 'details', label: t('account.tab.details') },
  ];
  const sign = (v: bigint) => (owes ? -v : v);

  return (
    <AppFrame title={account?.name ?? t('accounts.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <Button kind="link" label={t('account.back')} onPress={() => router.push('/accounts')} style={{ alignSelf: 'flex-start' }} />
        {!account || !snapshot ? (
          <Placeholder height={120} />
        ) : (
          <>
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text variant="caption" tone="textSecondary">
                {[t(`accounts.kind.${account.type}`), account.institution].filter(Boolean).join(' · ')}
              </Text>
              {owes ? (
                <Text variant="caption" tone="textSecondary">
                  {t('accounts.youOwe')}
                </Text>
              ) : null}
              <Amount testID="account-balance" minor={sign(balance)} variant="display-md" />
              <Text testID="account-cleared" variant="caption" tone="textSecondary">
                {t('account.clearedLine', { cleared: fmt(sign(split.cleared)), notCleared: fmt(sign(split.notCleared)) })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
              <Button
                testID="account-reconcile"
                kind="secondary"
                label={t('account.reconcile')}
                onPress={() => router.push(`/accounts/${account.id}/reconcile`)}
              />
              <Button testID="account-import" kind="secondary" label={t('account.import')} onPress={() => setSheet('import')} />
              <Menu
                testID="account-menu"
                trigger={(open) => <Button testID="account-more" kind="secondary" label={t('account.more')} onPress={open} />}
                items={[
                  { key: 'edit', label: t('account.edit'), onPress: () => setSheet('edit') },
                  ...(hasValue ? [{ key: 'value', label: t('account.updateValue'), onPress: () => setSheet('value') }] : []),
                  { key: 'archive', label: t('account.archive'), onPress: () => setSheet('archive') },
                ]}
              />
            </View>
            <Tabs testID="account-tabs" options={tabs} value={tab} onChange={setTab} />
            {tab === 'transactions' ? (
              rows.length === 0 ? (
                <EmptyState
                  title={t('account.emptyTitle')}
                  body={t('account.emptyBody')}
                  actionLabel={t('account.import')}
                  onAction={() => setSheet('import')}
                />
              ) : (
                <Card style={{ padding: 0 }}>
                  {rows.map((r, i) => (
                    <Pressable
                      key={r.event.id}
                      testID={`reg-${r.event.id}`}
                      accessibilityRole="button"
                      onPress={() => router.setParams({ tx: r.event.id })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: sp['spacing-md'],
                        padding: sp['spacing-md'],
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: theme.border,
                      }}
                    >
                      <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
                        <Text>{r.title}</Text>
                        <Text variant="caption" tone="textSecondary">
                          {[formatDay(r.event.date), r.category, r.event.reconciledBy ? t('account.locked') : r.event.cleared ? t('account.clearedMark') : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Amount minor={sign(r.line)} signed />
                        <Text variant="caption" tone="textSecondary" testID={`running-${r.event.id}`}>
                          {fmt(sign(r.running))}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </Card>
              )
            ) : tab === 'value' ? (
              <Card testID="value-list" style={{ gap: sp['spacing-sm'] }}>
                {revalued(snapshot, account.id).length === 0 ? (
                  <Text tone="textSecondary">{t('account.noValueUpdates')}</Text>
                ) : (
                  revalued(snapshot, account.id).map((e) => (
                    <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text>{formatDay(e.date)}</Text>
                      <Amount minor={sign(e.lines.find((l) => l.ledgerAccountId === account.id)?.amountMinor ?? 0n)} signed />
                    </View>
                  ))
                )}
              </Card>
            ) : (
              <Details account={account} />
            )}
          </>
        )}
      </ScrollView>
      {account && sheet === 'import' ? (
        <ImportSheet
          account={account}
          initialText={dropped}
          onClose={() => {
            setSheet(null);
            setDropped(null);
          }}
          onImported={(importId, count) => {
            toast.show(t('import.done', { count }), () => void repo.undoImport(importId, today()));
          }}
        />
      ) : null}
      {account && sheet === 'edit' ? <EditAccountSheet account={account} onClose={() => setSheet(null)} /> : null}
      {account && sheet === 'value' ? <UpdateValueSheet account={account} current={sign(balance)} onClose={() => setSheet(null)} /> : null}
      {account && snapshot && sheet === 'archive' ? (
        <ArchiveSheet account={account} balance={balance} snapshot={snapshot} onClose={() => setSheet(null)} />
      ) : null}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
    </AppFrame>
  );
}

const fmt = (minor: bigint) => formatNaira(minor);

function Details({ account }: { account: Account }) {
  const { snapshot } = useWorkspace();
  const history = (snapshot?.reconciles ?? []).filter((r) => r.accountId === account.id);
  const line = (label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
  return (
    <Card testID="account-details" style={{ gap: sp['spacing-sm'] }}>
      {line(t('accounts.institution'), account.institution ?? t('account.none'))}
      {line(t('accounts.last4'), account.last4 ? t('accounts.masked', { last4: account.last4 }) : t('account.none'))}
      {line(t('account.currency'), account.currency)}
      <Text variant="heading-sm" accessibilityRole="header">
        {t('account.reconcileHistory')}
      </Text>
      {history.length === 0 ? (
        <Text tone="textSecondary">{t('account.noReconciles')}</Text>
      ) : (
        history.map((r) => (
          <View key={r.id} testID={`reconcile-${r.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
            <Text>{formatDay(r.statementDate)}</Text>
            <Amount minor={BigInt(r.statementBalance)} />
            <Text tone="textSecondary">{r.adjustment === '0' ? t('account.noAdjustment') : t('account.adjusted', { amount: fmt(BigInt(r.adjustment)) })}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

function EditAccountSheet({ account, onClose }: { account: Account; onClose: () => void }) {
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

function UpdateValueSheet({ account, current, onClose }: { account: Account; current: bigint; onClose: () => void }) {
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
        <Text tone="textSecondary">{t('account.currentValue', { amount: fmt(current) })}</Text>
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

function ArchiveSheet({ account, balance, snapshot, onClose }: { account: Account; balance: bigint; snapshot: Snapshot; onClose: () => void }) {
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
        <Text>{t('account.archiveMoveBody', { amount: fmt(balance < 0n ? -balance : balance) })}</Text>
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

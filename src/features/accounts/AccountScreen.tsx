import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  formatDay,
  Menu,
  Placeholder,
  Tabs,
  Text,
  useToast,
} from '@/design/components';
import { useTabParam } from '@/design/useTabParam';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSync } from '@/data/sync/SyncProvider';
import { ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { rowsFor, today, type Row } from '@/features/transactions/helpers';
import { TransactionPanel } from '@/features/transactions/TransactionPanel';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { ledgerBalance } from '@/ledger';

import { aiApi, type ServerImport } from '@/api/ai';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';

import { AccountImportSheet, statementCsv } from './AccountImportSheet';
import { ArchiveSheet, EditAccountSheet, UpdateValueSheet } from './accountSheets';
import { groupRegisterByDay, hasValueTab } from './helpers';

const sp = tokens.spacing;

type Tab = 'transactions' | 'value' | 'details';
export type RegisterRow = Row & { line: bigint; running: bigint };

/** Rows that touch the account, newest first, with the balance after each (P09-01 / TB03-2). */
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
  const { engine } = useSync();
  const params = useGlobalSearchParams<{
    id?: string;
    tx?: string;
    tab?: string;
    account?: string;
    value?: string;
    import?: string;
    add?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const [dropped, setDropped] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { client, user } = useAuth();
  const online = useOnline();
  const bank = useMemo(() => aiApi(client), [client]);
  const [pending, setPending] = useState<ServerImport[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const loadPending = useCallback(() => {
    if (!online || !user || !params.id) return;
    bank.pendingImports(user.workspaceId, params.id).then((r) => setPending(r.imports.filter((i) => i.source === 'bank')), () => setPending([]));
  }, [bank, online, user, params.id]);
  useEffect(loadPending, [loadPending]);

  const account = snapshot?.accounts.find((a) => a.id === params.id);

  // `?account=` is PU-13; Add transaction also uses `account` as a prefill when `?add=` is set.
  const editOpen = !!account && params.account === account.id && !params.add;
  const valueOpen = !!account && params.value === account.id;
  const importOpen = (!!account && params.import === account.id) || dropped !== null;

  const openEdit = () => account && router.setParams({ account: account.id });
  const openValue = () => account && router.setParams({ value: account.id });
  const openImport = () => account && router.setParams({ import: account.id });
  const closeEdit = () => router.setParams({ account: undefined });
  const closeValue = () => router.setParams({ value: undefined });
  const closeImport = () => {
    setDropped(null);
    setReviewing(null);
    router.setParams({ import: undefined });
  };

  const rows = useMemo(() => (snapshot && account ? register(snapshot, account.id) : []), [snapshot, account]);
  const dayGroups = useMemo(() => groupRegisterByDay(rows), [rows]);
  const balance = snapshot && account ? ledgerBalance(account.id, snapshot.events) : 0n;
  const owes = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const tabOptions = useMemo((): readonly Tab[] => {
    const keys: Tab[] = ['transactions'];
    if (account && hasValueTab(account.type)) keys.push('value');
    keys.push('details');
    return keys;
  }, [account]);
  // Prefer foundation useTabParam (URL + remembered last tab) over accounts' one-shot parseTab.
  const { value: tab, setValue: setTab } = useTabParam<Tab>({
    pageKey: `account:${params.id ?? 'none'}`,
    personId: user?.id,
    options: tabOptions,
    defaultValue: 'transactions',
  });
  const tabs: { value: Tab; label: string }[] = tabOptions.map((value) => ({
    value,
    label: t(`account.tab.${value}` as 'account.tab.transactions' | 'account.tab.value' | 'account.tab.details'),
  }));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !account) return;
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        setDropped(text);
        router.setParams({ import: account.id });
      });
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [account, router]);

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
  const sign = (v: bigint) => (owes ? -v : v);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await engine.sync({ force: true });
      if (online && user && account) {
        const { links } = await bank.bankLinks(user.workspaceId).catch(() => ({ links: [] as { id: string; accountId: string; status: string }[] }));
        for (const l of links.filter((x) => x.accountId === account.id && x.status === 'active')) await bank.syncBank(user.workspaceId, l.id).catch(() => null);
        loadPending();
      }
      toast.show(t('account.synced'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AppFrame title={account?.name ?? t('accounts.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        {pending.map((p) => (
          <Card key={p.id} testID={`bank-review-${p.id}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
            <Text style={{ flex: 1 }}>{t('account.bankReview', { count: String(p.counts.new) })}</Text>
            <Button
              kind="secondary"
              label={t('account.bankReviewAction')}
              onPress={() => {
                setDropped(statementCsv(p.rows));
                setReviewing(p.id);
                router.setParams({ import: account!.id });
              }}
            />
          </Card>
        ))}
        <Button kind="link" label={t('account.back')} onPress={() => router.push('/accounts')} style={{ alignSelf: 'flex-start' }} />
        {!account || !snapshot ? (
          <Placeholder height={120} />
        ) : (
          <>
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text variant="caption" tone="textSecondary">
                {[t(`accounts.kind.${account.type}`), account.institution, t('accounts.syncedNow')].filter(Boolean).join(' · ')}
              </Text>
              {owes ? (
                <Text variant="caption" tone="textSecondary">
                  {t('accounts.youOwe')}
                </Text>
              ) : null}
              {account.closedWithBalance ? (
                <Text variant="caption" tone="textSecondary">
                  {t('account.closedWithBalance')}
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
              <Button testID="account-import" kind="secondary" label={t('account.import')} onPress={openImport} />
              <Button testID="account-sync" kind="secondary" label={t('account.syncNow')} disabled={syncing} onPress={() => void syncNow()} />
              <Menu
                testID="account-menu"
                trigger={(open) => <Button testID="account-more" kind="secondary" label={t('account.more')} onPress={open} />}
                items={[
                  { key: 'edit', label: t('account.edit'), onPress: openEdit },
                  ...(hasValueTab(account.type) ? [{ key: 'value', label: t('account.updateValue'), onPress: openValue }] : []),
                  { key: 'archive', label: t('account.archive'), onPress: () => setArchiveOpen(true) },
                ]}
              />
            </View>
            <Tabs testID="account-tabs" options={tabs} value={tab} onChange={setTab} />
            {tab === 'transactions' ? (
              rows.length === 0 ? (
                <View style={{ gap: sp['spacing-md'] }}>
                  <EmptyState
                    title={t('account.emptyTitle')}
                    body={t('account.emptyBody')}
                    actionLabel={t('tx.add')}
                    onAction={() => router.setParams({ add: 'expense', account: account.id })}
                  />
                  <Button testID="account-empty-import" kind="secondary" label={t('account.import')} onPress={openImport} />
                </View>
              ) : (
                <View style={{ gap: sp['spacing-md'] }}>
                  {dayGroups.map((g) => (
                    <View key={g.day} testID={`day-${g.day}`} style={{ gap: sp['spacing-xs'] }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: sp['spacing-xs'] }}>
                        <Text variant="caption" tone="textSecondary">
                          {formatDay(g.day)}
                        </Text>
                        <Amount minor={sign(g.net)} signed variant="caption" />
                      </View>
                      <Card style={{ padding: 0 }}>
                        {g.rows.map((r, i) => (
                          <RegisterLine key={r.event.id} row={r} sign={sign} theme={theme} first={i === 0} onOpen={() => router.setParams({ tx: r.event.id })} />
                        ))}
                      </Card>
                    </View>
                  ))}
                </View>
              )
            ) : tab === 'value' ? (
              <Card testID="value-list" style={{ gap: sp['spacing-sm'] }}>
                {revalued(snapshot, account.id).length === 0 ? (
                  <EmptyState
                    title={t('account.noValueUpdates')}
                    body={t('account.noValueBody')}
                    actionLabel={t('account.updateValue')}
                    onAction={openValue}
                  />
                ) : (
                  revalued(snapshot, account.id).map((e) => (
                    <View key={e.id} style={{ gap: sp['spacing-xxs'] }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text>{formatDay(e.date)}</Text>
                        <Amount minor={sign(e.lines.find((l) => l.ledgerAccountId === account.id)?.amountMinor ?? 0n)} signed />
                      </View>
                      {e.notes ? (
                        <Text variant="caption" tone="textSecondary">
                          {e.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
            ) : (
              <Details account={account} onArchive={() => setArchiveOpen(true)} />
            )}
          </>
        )}
      </ScrollView>
      {account && importOpen ? (
        <AccountImportSheet
          account={account}
          initialText={dropped}
          onClose={closeImport}
          onImported={(importId, count) => {
            toast.show(t('import.done', { count }), () => void repo.undoImport(importId, today()));
            if (reviewing && user) {
              void bank.importReviewed(user.workspaceId, reviewing).then(loadPending, () => null);
              setReviewing(null);
            }
          }}
        />
      ) : null}
      {account && editOpen ? <EditAccountSheet account={account} onClose={closeEdit} /> : null}
      {account && valueOpen ? <UpdateValueSheet account={account} current={sign(balance)} onClose={closeValue} /> : null}
      {account && snapshot && archiveOpen ? (
        <ArchiveSheet account={account} balance={balance} snapshot={snapshot} onClose={() => setArchiveOpen(false)} />
      ) : null}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
    </AppFrame>
  );
}

const fmt = (minor: bigint) => formatNaira(minor);

function RegisterLine({
  row,
  sign,
  theme,
  first,
  onOpen,
}: {
  row: RegisterRow;
  sign: (v: bigint) => bigint;
  theme: { border: string };
  first: boolean;
  onOpen: () => void;
}) {
  return (
    <Pressable
      testID={`reg-${row.event.id}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: sp['spacing-md'],
        padding: sp['spacing-md'],
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}
    >
      <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
        <Text>{row.title}</Text>
        <Text variant="caption" tone="textSecondary">
          {[row.event.reconciledBy ? t('account.locked') : row.event.cleared ? t('account.clearedMark') : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Amount minor={sign(row.line)} signed />
        <Text variant="caption" tone="textSecondary" testID={`running-${row.event.id}`}>
          {fmt(sign(row.running))}
        </Text>
      </View>
    </Pressable>
  );
}

function Details({ account, onArchive }: { account: Account; onArchive: () => void }) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const history = (snapshot?.reconciles ?? []).filter((r) => r.accountId === account.id);
  const line = (label: string, value: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
  return (
    <Card testID="account-details" style={{ gap: sp['spacing-sm'] }}>
      {line(t('accounts.type'), t(`accounts.kind.${account.type}`))}
      {line(t('accounts.institution'), account.institution ?? t('account.none'))}
      {line(t('accounts.last4'), account.last4 ? t('accounts.masked', { last4: account.last4 }) : t('account.none'))}
      {line(t('account.currency'), account.currency)}
      {line(t('accounts.countInBudget'), account.countInBudget ? t('common.yes') : t('common.no'))}
      {line(t('account.opened'), account.openedAt ? formatDay(account.openedAt) : t('account.none'))}
      {line(t('account.bankConnection'), t('account.notConnected'))}
      {line(t('account.importSettings'), account.importMapping ? t('account.importRemembered') : t('account.importDefault'))}
      {account.importMapping ? (
        <Button
          testID="reset-import-mapping"
          kind="secondary"
          label={t('account.resetMapping')}
          onPress={() => {
            void repo.clearImportMapping(account.id).then(() => toast.show(t('common.saved')));
          }}
        />
      ) : null}
      <Text variant="heading-sm" accessibilityRole="header">
        {t('account.reconcileHistory')}
      </Text>
      {history.length === 0 ? (
        <Text tone="textSecondary">{t('account.noReconciles')}</Text>
      ) : (
        history.map((r) => (
          <View key={r.id} testID={`reconcile-${r.id}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'], flexWrap: 'wrap' }}>
            <Text>{formatDay(r.statementDate)}</Text>
            <Amount minor={BigInt(r.statementBalance)} />
            <Text tone="textSecondary">{r.adjustment === '0' ? t('account.noAdjustment') : t('account.adjusted', { amount: fmt(BigInt(r.adjustment)) })}</Text>
          </View>
        ))
      )}
      {!account.archived ? (
        <Button testID="details-archive" kind="secondary" label={t('account.archive')} onPress={onArchive} />
      ) : null}
    </Card>
  );
}

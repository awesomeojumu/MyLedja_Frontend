import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  Confirm,
  EmptyState,
  formatDay,
  Menu,
  PillTag,
  Placeholder,
  StatusPill,
  Tabs,
  Text,
  TextInput,
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
import { applyFilters, countActive, emptyFilters, filterChips, removeChip, type TxFilters } from '@/features/transactions/filters';
import { FiltersSheet } from '@/features/transactions/FiltersSheet';
import { rowsFor, today, type Row } from '@/features/transactions/helpers';
import { rowIndicators } from '@/features/transactions/panelConnected';
import { matchesSearch } from '@/features/transactions/TransactionsScreen';
import { TransactionPanel } from '@/features/transactions/TransactionPanel';
import { t } from '@/i18n';
import { formatNaira } from '@/money';
import { ledgerBalance } from '@/ledger';

import { aiApi, type BankLink, type ServerImport } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';

import { AccountImportSheet, classifyDroppedFile, statementCsv } from './AccountImportSheet';
import { ArchiveSheet, EditAccountSheet, UpdateValueSheet } from './accountSheets';
import { DividendSheet, HoldingSheet, TradeSheet } from '@/features/investments/investmentSheets';
import { portfolioFigures } from '@/features/investments/helpers';

import { accountInitials, groupRegisterByDay, hasHoldingsTab, hasValueTab } from './helpers';

const sp = tokens.spacing;

type Tab = 'transactions' | 'holdings' | 'value' | 'details';
export type RegisterRow = Row & { line: bigint; running: bigint };

type DroppedPayload =
  | { kind: 'csv'; text: string }
  | { kind: 'statement'; fileName: string; base64: string };

/** Rows that touch the account, newest first, with the balance after each (P09-01 / TB03-2). Pending (M19) left out. */
export function register(snapshot: Snapshot, accountId: string): RegisterRow[] {
  const rows = rowsFor(snapshot)
    .filter((r) => r.event.status !== 'pending')
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
  const [sheet, setSheet] = useState<'holding' | 'buy' | 'sell' | 'dividend' | null>(null);
  const [dropped, setDropped] = useState<DroppedPayload | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TxFilters>(emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { client, user } = useAuth();
  const online = useOnline();
  const bank = useMemo(() => aiApi(client), [client]);
  const [pending, setPending] = useState<ServerImport[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const loadPending = useCallback(() => {
    if (!online || !user || !params.id) return;
    bank.pendingImports(user.workspaceId, params.id).then((r) => setPending(r.imports.filter((i) => i.source === 'bank')), () => setPending([]));
  }, [bank, online, user, params.id]);
  useEffect(loadPending, [loadPending]);

  const loadBankLinks = useCallback(() => {
    if (!online || !user) return;
    bank.bankLinks(user.workspaceId).then((r) => setBankLinks(r.links), () => setBankLinks([]));
  }, [bank, online, user]);
  useEffect(loadBankLinks, [loadBankLinks]);

  const account = snapshot?.accounts.find((a) => a.id === params.id);

  // `?account=` is PU-13; Add transaction also uses `account` as a prefill when `?add=` is set.
  const editOpen = !!account && params.account === account.id && !params.add;
  const valueOpen = !!account && params.value === account.id;
  const importOpen = (!!account && (params.import === account.id || params.import === '1')) || dropped !== null;

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
  const scopedFilters = useMemo(
    () => (account ? { ...filters, accountId: account.id } : filters),
    [filters, account],
  );
  const visibleRows = useMemo(() => {
    if (!snapshot) return rows;
    return rows.filter((r) => matchesSearch(r, query) && applyFilters(r, scopedFilters, snapshot));
  }, [rows, query, scopedFilters, snapshot]);
  const dayGroups = useMemo(() => groupRegisterByDay(visibleRows), [visibleRows]);
  const activeFilterCount = useMemo(() => {
    const { accountId: _a, ...rest } = scopedFilters;
    return countActive(rest);
  }, [scopedFilters]);
  const chips = useMemo(() => {
    if (!snapshot) return [];
    return filterChips(scopedFilters, snapshot).filter((c) => c.key !== 'accountId');
  }, [scopedFilters, snapshot]);
  const balance = snapshot && account ? ledgerBalance(account.id, snapshot.events) : 0n;
  const owes = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const tabOptions = useMemo((): readonly Tab[] => {
    const keys: Tab[] = ['transactions'];
    if (account && hasHoldingsTab(account.type)) keys.push('holdings');
    if (account && hasValueTab(account.type)) keys.push('value');
    keys.push('details');
    return keys;
  }, [account]);
  const { value: tab, setValue: setTab } = useTabParam<Tab>({
    pageKey: `account:${params.id ?? 'none'}`,
    personId: user?.id,
    options: tabOptions,
    defaultValue: 'transactions',
  });
  const tabs: { value: Tab; label: string }[] = tabOptions.map((value) => ({
    value,
    label: t(`account.tab.${value}` as 'account.tab.transactions' | 'account.tab.holdings' | 'account.tab.value' | 'account.tab.details'),
  }));
  const holdingRows = snapshot && account && hasHoldingsTab(account.type) ? portfolioFigures(snapshot, account.id) : [];
  const accountLink = account ? bankLinks.find((l) => l.accountId === account.id && l.status !== 'disconnected') : undefined;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !account) return;
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void classifyDroppedFile(file).then((result) => {
        if (result.kind === 'error') {
          toast.show(result.error === 'size' ? t('import.tooBig') : t('import.wrongType'));
          return;
        }
        setDropped(result);
        router.setParams({ import: account.id });
      });
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [account, router, toast]);

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
        const { links } = await bank.bankLinks(user.workspaceId).catch(() => ({ links: [] as BankLink[] }));
        setBankLinks(links);
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
                setDropped({ kind: 'csv', text: statementCsv(p.rows) });
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'] }}>
              <View
                testID="account-initials"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.hover,
                }}
              >
                <Text variant="heading-sm">{accountInitials(account.name, account.institution)}</Text>
              </View>
              <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
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
              <View style={{ gap: sp['spacing-md'] }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'flex-end' }}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <TextInput testID="account-search" label={t('tx.search')} value={query} onChangeText={setQuery} />
                  </View>
                  <Button
                    testID="account-filters"
                    kind="secondary"
                    label={activeFilterCount > 0 ? t('tx.filtersCount', { count: activeFilterCount }) : t('tx.filters')}
                    onPress={() => setFiltersOpen(true)}
                  />
                </View>
                {chips.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                    {chips.map((chip) => (
                      <PillTag
                        key={chip.key}
                        testID={`account-chip-${chip.key}`}
                        label={chip.label}
                        onPress={() => setFilters(removeChip(filters, chip.key))}
                      />
                    ))}
                  </View>
                ) : null}
                {rows.length === 0 ? (
                  <View style={{ gap: sp['spacing-md'] }}>
                    <EmptyState
                      title={t('account.emptyTitle')}
                      body={t('account.emptyBody')}
                      actionLabel={t('tx.add')}
                      onAction={() => router.setParams({ add: 'expense', account: account.id })}
                    />
                    <Button testID="account-empty-import" kind="secondary" label={t('account.import')} onPress={openImport} />
                  </View>
                ) : visibleRows.length === 0 ? (
                  <EmptyState title={t('tx.noMatches')} body={t('tx.noMatchesBody')} actionLabel={t('tx.filter.clear')} onAction={() => { setQuery(''); setFilters(emptyFilters()); }} />
                ) : (
                  dayGroups.map((g) => (
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
                  ))
                )}
              </View>
            ) : tab === 'holdings' ? (
              <View testID="holdings-tab" style={{ gap: sp['spacing-md'] }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
                  <Button testID="account-add-holding" label={t('investments.addHolding')} onPress={() => setSheet('holding')} />
                  <Button testID="account-buy" kind="secondary" label={t('investments.buy')} onPress={() => setSheet('buy')} />
                  <Button testID="account-sell" kind="secondary" label={t('investments.sell')} onPress={() => setSheet('sell')} />
                  <Button testID="account-dividend" kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
                </View>
                {holdingRows.length === 0 ? (
                  <EmptyState
                    title={t('investments.emptyTitle')}
                    body={t('investments.emptyBody')}
                    actionLabel={t('investments.addHolding')}
                    onAction={() => setSheet('holding')}
                  />
                ) : (
                  holdingRows.map((f) => (
                    <Pressable key={f.holding.id} testID={`account-holding-${f.holding.id}`} onPress={() => router.push(`/investments/${f.holding.id}`)}>
                      <Card style={{ gap: sp['spacing-xs'] }}>
                        <Text variant="heading-sm">{f.holding.name}</Text>
                        <Text tone="textSecondary">
                          {f.units} · {formatNaira(f.value)}
                        </Text>
                      </Card>
                    </Pressable>
                  ))
                )}
              </View>
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
              <Details
                account={account}
                link={accountLink}
                currentUserId={user?.id}
                currentUserName={user?.name}
                onArchive={() => setArchiveOpen(true)}
                onDisconnect={async (linkId) => {
                  if (!user) return;
                  try {
                    await bank.disconnectBank(user.workspaceId, linkId);
                    toast.show(t('settings.banks.disconnected'));
                    loadBankLinks();
                  } catch (e) {
                    toast.show(e instanceof ApiError ? e.body.message : t('errors.network'));
                  }
                }}
              />
            )}
          </>
        )}
      </ScrollView>
      {account && importOpen ? (
        <AccountImportSheet
          account={account}
          initialText={dropped?.kind === 'csv' ? dropped.text : null}
          initialStatement={dropped?.kind === 'statement' ? dropped : null}
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
      {account && sheet === 'holding' ? <HoldingSheet accountId={account.id} onClose={() => setSheet(null)} /> : null}
      {account && sheet === 'buy' ? <TradeSheet direction="buy" onClose={() => setSheet(null)} /> : null}
      {account && sheet === 'sell' ? <TradeSheet direction="sell" onClose={() => setSheet(null)} /> : null}
      {account && sheet === 'dividend' ? <DividendSheet onClose={() => setSheet(null)} /> : null}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
      {filtersOpen && snapshot && account ? (
        <FiltersSheet
          snapshot={snapshot}
          filters={scopedFilters}
          scopedAccountId={account.id}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            const { accountId: _a, ...rest } = next;
            setFilters(rest);
            setFiltersOpen(false);
          }}
        />
      ) : null}
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
  const marks = rowIndicators(row.event);
  const clearedMark = !row.event.reconciledBy && row.event.cleared ? t('account.clearedMark') : null;
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
        {marks.length > 0 || clearedMark ? (
          <Text variant="caption" tone="textSecondary" testID={`reg-marks-${row.event.id}`}>
            {[...marks.map((m) => t(`tx.mark.${m}` as 'tx.mark.split')), clearedMark].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {row.waiting ? <StatusPill label={t('tx.waiting')} kind="pending" /> : null}
      <View style={{ alignItems: 'flex-end' }}>
        <Amount minor={sign(row.line)} signed />
        <Text variant="caption" tone="textSecondary" testID={`running-${row.event.id}`}>
          {fmt(sign(row.running))}
        </Text>
      </View>
    </Pressable>
  );
}

function Details({
  account,
  link,
  currentUserId,
  currentUserName,
  onArchive,
  onDisconnect,
}: {
  account: Account;
  link?: BankLink;
  currentUserId?: string;
  currentUserName?: string;
  onArchive: () => void;
  onDisconnect: (linkId: string) => Promise<void>;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const history = (snapshot?.reconciles ?? []).filter((r) => r.accountId === account.id);
  const bankStatus = !link
    ? t('account.notConnected')
    : link.status === 'needs_reauth'
      ? t('settings.banks.needsReauth')
      : t('settings.banks.lastSync', {
          when: link.lastSyncedAt ? formatDay(link.lastSyncedAt.slice(0, 10)) : t('settings.banks.syncNever'),
        });
  const who = (finishedBy: string | null | undefined) => {
    if (!finishedBy) return t('account.finishedByUnknown');
    if (currentUserId && finishedBy === currentUserId) return currentUserName?.trim() || t('account.finishedByYou');
    return finishedBy;
  };
  const line = (label: string, value: string, testID?: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
      <Text tone="textSecondary">{label}</Text>
      <Text testID={testID}>{value}</Text>
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
      {line(t('account.bankConnection'), bankStatus, 'account-bank-status')}
      {link ? (
        <Button testID="account-bank-disconnect" kind="secondary" label={t('settings.banks.disconnect')} onPress={() => setDisconnectId(link.id)} />
      ) : null}
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
          <View key={r.id} testID={`reconcile-${r.id}`} style={{ gap: sp['spacing-xxs'] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'], flexWrap: 'wrap' }}>
              <Text>{formatDay(r.statementDate)}</Text>
              <Amount minor={BigInt(r.statementBalance)} />
              <Text tone="textSecondary">{r.adjustment === '0' ? t('account.noAdjustment') : t('account.adjusted', { amount: fmt(BigInt(r.adjustment)) })}</Text>
            </View>
            <Text variant="caption" tone="textSecondary" testID={`reconcile-who-${r.id}`}>
              {t('account.finishedBy', { who: who(r.finishedBy) })}
            </Text>
          </View>
        ))
      )}
      {!account.archived ? (
        <Button testID="details-archive" kind="secondary" label={t('account.archive')} onPress={onArchive} />
      ) : null}
      {disconnectId ? (
        <Confirm
          visible
          title={t('settings.banks.disconnectTitle')}
          body={t('settings.banks.disconnectBody')}
          confirmLabel={t('settings.banks.disconnect')}
          onCancel={() => setDisconnectId(null)}
          onConfirm={() => {
            if (busy) return;
            setBusy(true);
            void onDisconnect(disconnectId).finally(() => {
              setBusy(false);
              setDisconnectId(null);
            });
          }}
        />
      ) : null}
    </Card>
  );
}

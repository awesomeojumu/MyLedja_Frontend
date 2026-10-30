import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aiApi, type BankLink, type ServerImport } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOnline } from '@/lib/useOnline';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { useTabParam } from '@/design/useTabParam';
import {
  RedesignAmount,
  RedesignButton,
  RedesignDialog,
  RedesignEmpty,
  RedesignIcon,
  RedesignListRow,
  RedesignSegmented,
  RedesignSheet,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useSync } from '@/data/sync/SyncProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { DividendSheet, HoldingSheet, TradeSheet } from '@/features/investments/investmentSheets';
import { portfolioFigures } from '@/features/investments/helpers';
import { TransactionPanel } from '@/features/transactions/TransactionPanel';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira, PRIVACY_MASK } from '@/money';
import { ledgerBalance } from '@/ledger';

import { AccountImportSheet, classifyDroppedFile, statementCsv } from './AccountImportSheet';
import { ArchiveSheet, EditAccountSheet, UpdateValueSheet } from './accountSheets';
import { clearedSplit, hasHoldingsTab, hasValueTab, register, type RegisterRow } from './helpers';

const sp = tokens.space;

type Tab = 'transactions' | 'holdings' | 'value' | 'details';

function monthLong(iso: string): string {
  const mo = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const names = [
    '',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${d} ${names[mo] ?? ''}`;
}

function shortDate(iso: string): string {
  if (iso === today()) return t('date.today').toLowerCase();
  return monthLong(iso);
}

function balanceCaption(account: Account, link?: BankLink): string {
  const kind = t(`accounts.kind.${account.type}`);
  if (link?.lastSyncedAt) {
    const day = link.lastSyncedAt.slice(0, 10);
    return t('redesign.account.captionSynced', { kind, date: monthLong(day) });
  }
  if (account.openedAt) {
    return t('redesign.account.captionManual', { kind, date: monthLong(account.openedAt) });
  }
  return t('redesign.account.captionManualShort', { kind });
}

function DetailChrome({
  title,
  onBack,
  trailing,
  children,
}: {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView testID="redesign-account-frame" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <View
        testID="redesign-top-bar"
        style={{
          minHeight: Math.max(tokens.size['top-bar'], tokens.frame.topBarHeadroom),
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: sp.sm,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderColor: theme.border,
          gap: sp.xs,
        }}
      >
        <Pressable
          testID="account-back"
          accessibilityRole="button"
          accessibilityLabel={t('account.back')}
          onPress={onBack}
          style={{ width: tokens.density.touch.minTarget, height: tokens.density.touch.minTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <RedesignIcon name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <RedesignText variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </RedesignText>
        {trailing ?? <View style={{ width: tokens.density.touch.minTarget }} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

export function RedesignAccountScreen({ embedded, accountId }: { embedded?: boolean; accountId?: string } = {}) {
  const { snapshot, repo } = useWorkspace();
  const { engine } = useSync();
  const params = useGlobalSearchParams<{
    id?: string;
    tx?: string;
    account?: string;
    value?: string;
    import?: string;
    add?: string;
  }>();
  const router = useRouter();
  const { privacy } = useDesign();
  const size = useSizeClass();
  const phone = size === 'phone';
  const [sheet, setSheet] = useState<'holding' | 'buy' | 'sell' | 'dividend' | null>(null);
  const [dropped, setDropped] = useState<
    { kind: 'csv'; text: string } | { kind: 'statement'; fileName: string; base64: string } | null
  >(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<ServerImport[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const { client, user } = useAuth();
  const online = useOnline();
  const bank = useMemo(() => aiApi(client), [client]);
  const resolvedId = accountId ?? (typeof params.id === 'string' ? params.id : undefined);
  const account = snapshot?.accounts.find((a) => a.id === resolvedId);

  const editOpen = !!account && params.account === account.id && !params.add;
  const valueOpen = !!account && params.value === account.id;
  const importOpen = (!!account && (params.import === account.id || params.import === '1')) || dropped !== null;

  const loadPending = useCallback(() => {
    if (!online || !user || !resolvedId) return;
    bank.pendingImports(user.workspaceId, resolvedId).then((r) => setPending(r.imports.filter((i) => i.source === 'bank')), () => setPending([]));
  }, [bank, online, user, resolvedId]);
  useEffect(loadPending, [loadPending]);

  const loadBankLinks = useCallback(() => {
    if (!online || !user) return;
    bank.bankLinks(user.workspaceId).then((r) => setBankLinks(r.links), () => setBankLinks([]));
  }, [bank, online, user]);
  useEffect(loadBankLinks, [loadBankLinks]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !account) return;
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void classifyDroppedFile(file).then((result) => {
        if (result.kind === 'error') return;
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
  }, [account, router]);

  const rows = useMemo(() => (snapshot && account ? register(snapshot, account.id) : []), [snapshot, account]);
  const balance = snapshot && account ? ledgerBalance(account.id, snapshot.events) : 0n;
  const owes = account ? ACCOUNT_KIND_INFO[account.type].ledger === 'liability' : false;
  const sign = (v: bigint) => (owes ? -v : v);
  const accountLink = account ? bankLinks.find((l) => l.accountId === account.id && l.status !== 'disconnected') : undefined;
  const holdingRows = snapshot && account && hasHoldingsTab(account.type) ? portfolioFigures(snapshot, account.id) : [];
  const split = clearedSplit(rows);

  const tabOptions = useMemo((): readonly Tab[] => {
    const keys: Tab[] = ['transactions'];
    if (account && hasHoldingsTab(account.type)) keys.push('holdings');
    if (account && hasValueTab(account.type)) keys.push('value');
    keys.push('details');
    return keys;
  }, [account]);
  const { value: tab, setValue: setTab } = useTabParam<Tab>({
    pageKey: `account:${resolvedId ?? 'none'}`,
    personId: user?.id,
    options: tabOptions,
    defaultValue: 'transactions',
  });

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
  const goBack = () => router.push('/accounts');

  const syncNow = async () => {
    setSyncing(true);
    try {
      await engine.sync({ force: true });
      if (online && user && account) {
        const { links } = await bank.bankLinks(user.workspaceId).catch(() => ({ links: [] as BankLink[] }));
        setBankLinks(links);
        for (const l of links.filter((x) => x.accountId === account.id && x.status === 'active')) {
          await bank.syncBank(user.workspaceId, l.id).catch(() => null);
        }
        loadPending();
      }
    } finally {
      setSyncing(false);
    }
  };

  const money = (minor: bigint) => (privacy ? PRIVACY_MASK : formatNaira(minor));

  const moreTrailing = (
    <Pressable
      testID="account-more"
      accessibilityRole="button"
      accessibilityLabel={t('account.more')}
      onPress={() => setMoreOpen(true)}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="more" size={24} color={theme.text} />
    </Pressable>
  );

  if (snapshot && !account) {
    const missing = (
      <RedesignEmpty title={t('account.missingTitle')} body={t('account.missingBody')} actionLabel={t('account.back')} onAction={goBack} />
    );
    if (embedded) return <View testID="account-embedded">{missing}</View>;
    if (phone) return <DetailChrome title={t('accounts.title')} onBack={goBack}>{missing}</DetailChrome>;
    return <AppFrame title={t('accounts.title')}>{missing}</AppFrame>;
  }

  const balanceCard = account ? (
    <View
      testID="redesign-account-balance"
      style={{
        backgroundColor: theme.surface,
        borderRadius: tokens.shape['radius-lg'],
        padding: sp.lg,
        gap: sp.sm,
      }}
    >
      <RedesignText variant="helper" tone="textSecondary">
        {t('redesign.account.balance')}
      </RedesignText>
      <RedesignAmount testID="account-balance" text={money(sign(balance))} sizeVariant="display" />
      <RedesignText variant="helper" tone="textSecondary" testID="account-balance-caption">
        {balanceCaption(account, accountLink)}
      </RedesignText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginTop: sp.xs }}>
        <View style={{ flex: phone ? 1 : undefined, minWidth: phone ? 0 : 140 }}>
          <RedesignButton
            testID="account-reconcile"
            kind="secondary"
            label={t('redesign.account.reconcile')}
            onPress={() => router.push(`/accounts/${account.id}/reconcile`)}
            fullWidth={phone}
          />
        </View>
        <View style={{ flex: phone ? 1 : undefined, minWidth: phone ? 0 : 140 }}>
          <RedesignButton
            testID="account-import"
            kind="secondary"
            label={t('redesign.account.import')}
            onPress={openImport}
            fullWidth={phone}
          />
        </View>
        {!phone ? (
          <RedesignButton testID="account-edit" kind="soft" label={t('redesign.account.edit')} onPress={openEdit} />
        ) : null}
      </View>
    </View>
  ) : (
    <RedesignSkeleton height={160} />
  );

  const registerList = (
    <View style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: sp.xs }}>
        <RedesignText variant="label">{t('redesign.account.transactions')}</RedesignText>
        <RedesignText variant="helper" tone="textSecondary">
          {t('redesign.account.balanceAfter')}
        </RedesignText>
      </View>
      {rows.length === 0 ? (
        <RedesignEmpty
          title={t('redesign.account.emptyTitle')}
          body={t('redesign.account.emptyBody')}
          actionLabel={t('redesign.account.import')}
          onAction={openImport}
        />
      ) : (
        <View style={{ backgroundColor: theme.surface, borderRadius: tokens.shape['radius-lg'], overflow: 'hidden' }}>
          {rows.map((r) => (
            <RegisterRowLine key={r.event.id} row={r} sign={sign} privacy={privacy} onOpen={() => router.setParams({ tx: r.event.id })} />
          ))}
        </View>
      )}
    </View>
  );

  const webTable =
    account && !phone ? (
      <View testID="redesign-account-table" style={{ backgroundColor: theme.surface, borderRadius: tokens.shape['radius-lg'], overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: sp.lg,
            paddingVertical: sp.md,
            borderBottomWidth: 1,
            borderColor: theme.border,
            gap: sp.md,
          }}
        >
          <RedesignText variant="helper" tone="textSecondary" style={{ width: 72 }}>
            {t('redesign.account.colDate')}
          </RedesignText>
          <RedesignText variant="helper" tone="textSecondary" style={{ flex: 1 }}>
            {t('redesign.account.colPayee')}
          </RedesignText>
          <RedesignText variant="helper" tone="textSecondary" style={{ width: 120 }}>
            {t('redesign.account.colCategory')}
          </RedesignText>
          <RedesignText variant="helper" tone="textSecondary" style={{ width: 110, textAlign: 'right' }}>
            {t('redesign.account.colAmount')}
          </RedesignText>
          <RedesignText variant="helper" tone="textSecondary" style={{ width: 110, textAlign: 'right' }}>
            {t('redesign.account.colBalance')}
          </RedesignText>
        </View>
        {rows.map((r) => (
          <Pressable
            key={r.event.id}
            testID={`reg-${r.event.id}`}
            accessibilityRole="button"
            onPress={() => router.setParams({ tx: r.event.id })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: sp.lg,
              paddingVertical: sp.md,
              borderTopWidth: 1,
              borderColor: theme.border,
              gap: sp.md,
              minHeight: tokens.size['list-row'],
            }}
          >
            <RedesignText variant="helper" style={{ width: 72 }}>
              {r.event.date === today()
                ? t('date.today')
                : `${Number(r.event.date.slice(8, 10))} ${t(`date.month.${Number(r.event.date.slice(5, 7))}` as 'date.month.1')}`}
            </RedesignText>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RedesignText variant="label">{r.title.slice(0, 1).toUpperCase()}</RedesignText>
              </View>
              <RedesignText numberOfLines={1}>{r.title}</RedesignText>
            </View>
            <RedesignText variant="helper" tone="textSecondary" style={{ width: 120 }} numberOfLines={1}>
              {r.category || t('payees.redesign.chipNotSorted')}
            </RedesignText>
            <RedesignText style={{ width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {privacy ? PRIVACY_MASK : formatNaira(sign(r.line), { signed: true })}
            </RedesignText>
            <RedesignText style={{ width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {money(sign(r.running))}
            </RedesignText>
          </Pressable>
        ))}
      </View>
    ) : null;

  const showSegmented = tabOptions.length > 2;
  const body = (
    <ScrollView contentContainerStyle={{ gap: sp.lg, padding: sp.lg, paddingBottom: sp.xxl }}>
      {!phone && !embedded ? (
        <Pressable
          testID="account-back-web"
          accessibilityRole="link"
          onPress={goBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs, alignSelf: 'flex-start' }}
        >
          <RedesignIcon name="chevron-left" size={20} color={theme.primary} />
          <RedesignText tone="primary">{t('accounts.title')}</RedesignText>
        </Pressable>
      ) : null}
      {pending.map((p) => (
        <View
          key={p.id}
          testID={`bank-review-${p.id}`}
          style={{
            backgroundColor: theme.primarySoft,
            borderRadius: tokens.shape['radius-md'],
            padding: sp.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: sp.sm,
          }}
        >
          <RedesignText style={{ flex: 1 }}>{t('account.bankReview', { count: String(p.counts.new) })}</RedesignText>
          <RedesignButton
            kind="link"
            label={t('account.bankReviewAction')}
            onPress={() => {
              setDropped({ kind: 'csv', text: statementCsv(p.rows) });
              setReviewing(p.id);
              router.setParams({ import: account!.id });
            }}
          />
        </View>
      ))}
      {balanceCard}
      {showSegmented ? (
        <RedesignSegmented
          testID="account-tabs"
          options={tabOptions.map((key) => ({
            key,
            label: t(`account.tab.${key}` as 'account.tab.transactions'),
          }))}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      ) : null}
      {tab === 'transactions' || !showSegmented ? (phone || embedded ? registerList : webTable ?? registerList) : null}
      {tab === 'holdings' && showSegmented ? (
        <View testID="holdings-tab" style={{ gap: sp.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
            <RedesignButton label={t('investments.addHolding')} onPress={() => setSheet('holding')} />
            <RedesignButton kind="secondary" label={t('investments.buy')} onPress={() => setSheet('buy')} />
            <RedesignButton kind="secondary" label={t('investments.sell')} onPress={() => setSheet('sell')} />
            <RedesignButton kind="secondary" label={t('investments.dividend')} onPress={() => setSheet('dividend')} />
          </View>
          {holdingRows.length === 0 ? (
            <RedesignEmpty
              title={t('investments.emptyTitle')}
              body={t('investments.emptyBody')}
              actionLabel={t('investments.addHolding')}
              onAction={() => setSheet('holding')}
            />
          ) : (
            holdingRows.map((f) => (
              <RedesignListRow
                key={f.holding.id}
                testID={`account-holding-${f.holding.id}`}
                title={f.holding.name}
                subtitle={`${f.units} · ${formatNaira(f.value)}`}
                onPress={() => router.push(`/investments/${f.holding.id}`)}
              />
            ))
          )}
        </View>
      ) : null}
      {tab === 'value' && showSegmented && account && snapshot ? (
        <ValueList accountId={account.id} events={snapshot.events} sign={sign} onUpdate={openValue} />
      ) : null}
      {tab === 'details' && showSegmented && account ? (
        <DetailsBlock
          account={account}
          link={accountLink}
          currentUserId={user?.id}
          currentUserName={user?.name}
          onArchive={() => setArchiveOpen(true)}
          onDisconnect={async (linkId) => {
            if (!user) return;
            try {
              await bank.disconnectBank(user.workspaceId, linkId);
              loadBankLinks();
            } catch (e) {
              if (e instanceof ApiError) void e;
            }
          }}
          onResetMapping={() => void repo.clearImportMapping(account.id)}
        />
      ) : null}
      {account && split.notCleared !== 0n ? (
        <RedesignText testID="account-cleared" variant="helper" tone="textSecondary">
          {t('account.clearedLine', {
            cleared: money(sign(split.cleared)),
            notCleared: money(sign(split.notCleared)),
          })}
        </RedesignText>
      ) : null}
    </ScrollView>
  );

  const overlays = account ? (
    <>
      {moreOpen ? (
        <RedesignSheet visible title={t('account.more')} onClose={() => setMoreOpen(false)} testID="account-more-sheet">
          <Pressable
            testID="more-edit"
            accessibilityRole="button"
            onPress={() => {
              setMoreOpen(false);
              openEdit();
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <RedesignText>{t('account.edit')}</RedesignText>
          </Pressable>
          {hasValueTab(account.type) ? (
            <Pressable
              testID="more-value"
              accessibilityRole="button"
              onPress={() => {
                setMoreOpen(false);
                openValue();
              }}
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <RedesignText>{t('account.updateValue')}</RedesignText>
            </Pressable>
          ) : null}
          <Pressable
            testID="more-details"
            accessibilityRole="button"
            onPress={() => {
              setMoreOpen(false);
              setDetailsOpen(true);
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <RedesignText>{t('account.tab.details')}</RedesignText>
          </Pressable>
          <Pressable
            testID="more-sync"
            accessibilityRole="button"
            disabled={syncing}
            onPress={() => {
              setMoreOpen(false);
              void syncNow();
            }}
            style={{ minHeight: 48, justifyContent: 'center', opacity: syncing ? 0.5 : 1 }}
          >
            <RedesignText>{t('account.syncNow')}</RedesignText>
          </Pressable>
          <Pressable
            testID="more-archive"
            accessibilityRole="button"
            onPress={() => {
              setMoreOpen(false);
              setArchiveOpen(true);
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <RedesignText>{t('account.archive')}</RedesignText>
          </Pressable>
          <Pressable
            testID="more-delete"
            accessibilityRole="button"
            onPress={() => {
              setMoreOpen(false);
              setDeleteOpen(true);
            }}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <RedesignText tone="danger">{t('redesign.account.delete')}</RedesignText>
          </Pressable>
        </RedesignSheet>
      ) : null}
      <RedesignDialog
        visible={deleteOpen}
        title={t('redesign.account.deleteTitle', { name: account.name })}
        body={t('redesign.account.deleteBody', { count: rows.length })}
        confirmLabel={t('redesign.account.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          setArchiveOpen(true);
        }}
      />
      {detailsOpen ? (
        <RedesignSheet visible title={t('account.tab.details')} onClose={() => setDetailsOpen(false)} testID="account-details-sheet">
          <DetailsBlock
            account={account}
            link={accountLink}
            currentUserId={user?.id}
            currentUserName={user?.name}
            onArchive={() => {
              setDetailsOpen(false);
              setArchiveOpen(true);
            }}
            onDisconnect={async (linkId) => {
              if (!user) return;
              try {
                await bank.disconnectBank(user.workspaceId, linkId);
                loadBankLinks();
              } catch (e) {
                if (e instanceof ApiError) void e;
              }
            }}
            onResetMapping={() => void repo.clearImportMapping(account.id)}
          />
        </RedesignSheet>
      ) : null}
      {importOpen ? (
        <AccountImportSheet
          account={account}
          initialText={dropped?.kind === 'csv' ? dropped.text : null}
          initialStatement={dropped?.kind === 'statement' ? dropped : null}
          onClose={closeImport}
          onImported={(importId, _count) => {
            void importId;
            if (reviewing && user) {
              void bank.importReviewed(user.workspaceId, reviewing).then(loadPending, () => null);
              setReviewing(null);
            }
          }}
        />
      ) : null}
      {editOpen ? <EditAccountSheet account={account} onClose={closeEdit} /> : null}
      {valueOpen ? <UpdateValueSheet account={account} current={sign(balance)} onClose={closeValue} /> : null}
      {snapshot && archiveOpen ? (
        <ArchiveSheet account={account} balance={balance} snapshot={snapshot} onClose={() => setArchiveOpen(false)} />
      ) : null}
      {sheet === 'holding' ? <HoldingSheet accountId={account.id} onClose={() => setSheet(null)} /> : null}
      {sheet === 'buy' ? <TradeSheet direction="buy" onClose={() => setSheet(null)} /> : null}
      {sheet === 'sell' ? <TradeSheet direction="sell" onClose={() => setSheet(null)} /> : null}
      {sheet === 'dividend' ? <DividendSheet onClose={() => setSheet(null)} /> : null}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
    </>
  ) : null;

  if (embedded) {
    return (
      <View testID="account-embedded" style={{ flex: 1 }}>
        {body}
        {overlays}
      </View>
    );
  }
  if (phone) {
    return (
      <>
        <DetailChrome title={account?.name ?? t('accounts.title')} onBack={goBack} trailing={moreTrailing}>
          {body}
        </DetailChrome>
        {overlays}
      </>
    );
  }
  return (
    <AppFrame title={account?.name ?? t('accounts.title')}>
      {body}
      {overlays}
    </AppFrame>
  );
}

function RegisterRowLine({
  row,
  sign,
  privacy,
  onOpen,
}: {
  row: RegisterRow;
  sign: (v: bigint) => bigint;
  privacy: boolean;
  onOpen: () => void;
}) {
  const line = privacy ? PRIVACY_MASK : formatNaira(sign(row.line), { signed: true });
  const running = privacy ? PRIVACY_MASK : formatNaira(sign(row.running));
  const subtitle = `${line}, ${shortDate(row.event.date)}`;
  return (
    <RedesignListRow
      testID={`reg-${row.event.id}`}
      title={row.title}
      subtitle={subtitle}
      trailing={running}
      onPress={onOpen}
    />
  );
}

function ValueList({
  accountId,
  events,
  sign,
  onUpdate,
}: {
  accountId: string;
  events: { id: string; type: string; status: string; date: string; notes?: string | null; lines: { ledgerAccountId: string; amountMinor: bigint }[] }[];
  sign: (v: bigint) => bigint;
  onUpdate: () => void;
}) {
  const list = events.filter(
    (e) =>
      e.type === 'balance_adjustment' &&
      e.status === 'posted' &&
      e.lines.some((l) => l.ledgerAccountId === accountId) &&
      e.lines.some((l) => l.ledgerAccountId.endsWith(':revaluation')),
  );
  if (list.length === 0) {
    return (
      <RedesignEmpty
        title={t('account.noValueUpdates')}
        body={t('account.noValueBody')}
        actionLabel={t('account.updateValue')}
        onAction={onUpdate}
      />
    );
  }
  return (
    <View testID="value-list" style={{ gap: sp.sm }}>
      {list.map((e) => (
        <View key={e.id} style={{ backgroundColor: theme.surface, borderRadius: tokens.shape['radius-md'], padding: sp.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <RedesignText>{monthLong(e.date)}</RedesignText>
            <RedesignText style={{ fontVariant: ['tabular-nums'] }}>
              {formatNaira(sign(e.lines.find((l) => l.ledgerAccountId === accountId)?.amountMinor ?? 0n), { signed: true })}
            </RedesignText>
          </View>
          {e.notes ? (
            <RedesignText variant="helper" tone="textSecondary">
              {e.notes}
            </RedesignText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DetailsBlock({
  account,
  link,
  currentUserId,
  currentUserName,
  onArchive,
  onDisconnect,
  onResetMapping,
}: {
  account: Account;
  link?: BankLink;
  currentUserId?: string;
  currentUserName?: string;
  onArchive: () => void;
  onDisconnect: (linkId: string) => Promise<void>;
  onResetMapping: () => void;
}) {
  const { snapshot } = useWorkspace();
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const history = (snapshot?.reconciles ?? []).filter((r) => r.accountId === account.id);
  const bankStatus = !link
    ? t('account.notConnected')
    : link.status === 'needs_reauth'
      ? t('settings.banks.needsReauth')
      : t('settings.banks.lastSync', {
          when: link.lastSyncedAt ? monthLong(link.lastSyncedAt.slice(0, 10)) : t('settings.banks.syncNever'),
        });
  const who = (finishedBy: string | null | undefined) => {
    if (!finishedBy) return t('account.finishedByUnknown');
    if (currentUserId && finishedBy === currentUserId) return currentUserName?.trim() || t('account.finishedByYou');
    return finishedBy;
  };
  const line = (label: string, value: string, testID?: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md, paddingVertical: sp.sm }}>
      <RedesignText tone="textSecondary">{label}</RedesignText>
      <RedesignText testID={testID}>{value}</RedesignText>
    </View>
  );
  return (
    <View testID="account-details" style={{ backgroundColor: theme.surface, borderRadius: tokens.shape['radius-lg'], padding: sp.lg, gap: sp.xs }}>
      {line(t('accounts.type'), t(`accounts.kind.${account.type}`))}
      {line(t('accounts.institution'), account.institution ?? t('account.none'))}
      {line(t('accounts.last4'), account.last4 ? t('accounts.masked', { last4: account.last4 }) : t('account.none'))}
      {line(t('account.currency'), account.currency)}
      {line(t('account.bankConnection'), bankStatus, 'account-bank-status')}
      {link ? (
        <RedesignButton testID="account-bank-disconnect" kind="secondary" label={t('settings.banks.disconnect')} onPress={() => setDisconnectId(link.id)} />
      ) : null}
      {line(t('account.importSettings'), account.importMapping ? t('account.importRemembered') : t('account.importDefault'))}
      {account.importMapping ? (
        <RedesignButton testID="reset-import-mapping" kind="secondary" label={t('account.resetMapping')} onPress={onResetMapping} />
      ) : null}
      <RedesignText variant="label" accessibilityRole="header">
        {t('account.reconcileHistory')}
      </RedesignText>
      {history.length === 0 ? (
        <RedesignText tone="textSecondary">{t('account.noReconciles')}</RedesignText>
      ) : (
        history.map((r) => (
          <View key={r.id} testID={`reconcile-${r.id}`} style={{ gap: 2, paddingVertical: sp.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: sp.sm }}>
              <RedesignText>{monthLong(r.statementDate)}</RedesignText>
              <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{formatNaira(BigInt(r.statementBalance))}</RedesignText>
            </View>
            <RedesignText variant="helper" tone="textSecondary" testID={`reconcile-who-${r.id}`}>
              {t('account.finishedBy', { who: who(r.finishedBy) })}
            </RedesignText>
          </View>
        ))
      )}
      {!account.archived ? (
        <RedesignButton testID="details-archive" kind="secondary" label={t('account.archive')} onPress={onArchive} />
      ) : null}
      <RedesignDialog
        visible={!!disconnectId}
        title={t('settings.banks.disconnectTitle')}
        body={t('settings.banks.disconnectBody')}
        confirmLabel={t('settings.banks.disconnect')}
        onCancel={() => setDisconnectId(null)}
        onConfirm={() => {
          if (!disconnectId) return;
          const id = disconnectId;
          setDisconnectId(null);
          void onDisconnect(id);
        }}
      />
    </View>
  );
}

import { aiApi, type BankLink } from '@/api/ai';
import { useAuth } from '@/features/auth/AuthProvider';
import { bankConnectAvailable } from '@/features/banking/monoConnect';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  formatDay,
  Icon,
  Menu,
  PillTag,
  Placeholder,
  Popover,
  StatusPill,
  Text,
} from '@/design/components';
import { useSizeClass } from '@/design/size';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_GROUPS, ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { portfolioFigures } from '@/features/investments/helpers';
import { t } from '@/i18n';
import { ledgerBalance, netWorth } from '@/ledger';

import { AccountScreen } from './AccountScreen';
import {
  AccountAvatar,
  AddAccountSheet,
  ArchiveSheet,
  ConnectBankSheet,
  EditAccountSheet,
  UpdateValueSheetForAccount,
} from './accountSheets';
import { accountRows, isInvestmentAccount, reorderAccountIds, sortAccountRows, type AccountRow, type AccountSort } from './helpers';
import { isRedesignEnabled } from '@/design/redesign';
import { RedesignAccountsScreen } from './RedesignAccountsScreen';

const sp = tokens.spacing;

export type { AccountRow };
export { accountRows };

const SORT_OPTIONS: { value: AccountSort; label: string }[] = [
  { value: 'custom', label: t('accounts.sort.custom') },
  { value: 'balance', label: t('accounts.sort.balance') },
  { value: 'name', label: t('accounts.sort.name') },
  { value: 'type', label: t('accounts.sort.type') },
];

export function AccountsScreen() {
  if (isRedesignEnabled()) return <RedesignAccountsScreen />;
  return <LegacyAccountsScreen />;
}

function LegacyAccountsScreen() {
  const { snapshot } = useWorkspace();
  const theme = useTheme();
  const router = useRouter();
  const params = useGlobalSearchParams<{ account?: string; value?: string; connect?: string; view?: string }>();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const landscapeTablet = size !== 'phone' && width >= height;
  const [connectOpen, setConnectOpen] = useState(params.connect === '1');
  const [showArchived, setShowArchived] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [sort, setSort] = useState<AccountSort>('custom');
  const [sortOpen, setSortOpen] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const { repo } = useWorkspace();
  const { client, user } = useAuth();
  const adding = params.account === 'new';
  const editId = params.account && params.account !== 'new' ? params.account : null;
  const valueId = params.value ?? null;
  const viewId = typeof params.view === 'string' ? params.view : null;
  const closeAccountParam = () => router.setParams({ account: undefined });
  const closeValueParam = () => router.setParams({ value: undefined });
  const closeConnect = () => {
    setConnectOpen(false);
    router.setParams({ connect: undefined });
  };

  useEffect(() => {
    if (!user) return;
    const api = aiApi(client);
    void api.bankLinks(user.workspaceId).then(
      (r) => setBankLinks(r.links.filter((l) => l.status !== 'disconnected')),
      () => setBankLinks([]),
    );
  }, [client, user, connectOpen]);

  const syncByAccount = useMemo(() => {
    const map = new Map<string, BankLink>();
    for (const l of bankLinks) map.set(l.accountId, l);
    return map;
  }, [bankLinks]);

  const move = (id: string, by: -1 | 1) => {
    if (!snapshot) return;
    const ids = snapshot.accounts.filter((a) => !a.archived).map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void repo.reorderAccounts(ids);
  };

  const dropOnto = (toId: string) => {
    if (!snapshot || !dragId) return;
    const ids = snapshot.accounts.filter((a) => !a.archived).map((a) => a.id);
    void repo.reorderAccounts(reorderAccountIds(ids, dragId, toId));
    setDragId(null);
  };

  const summary = useMemo(() => {
    if (!snapshot) return null;
    const rows = accountRows(snapshot);
    const live = rows.filter((r) => !r.account.archived);
    const assets = live.filter((r) => r.balance > 0n).reduce((s, r) => s + r.balance, 0n);
    const debts = live.filter((r) => r.balance < 0n).reduce((s, r) => s - r.balance, 0n);
    const groups = ACCOUNT_GROUPS.map((group) => {
      const members = sortAccountRows(
        live.filter((r) => ACCOUNT_KIND_INFO[r.account.type].group === group),
        sort === 'custom' ? 'custom' : sort,
      );
      return { group, rows: members, total: members.reduce((s, r) => s + r.balance, 0n) };
    }).filter((g) => g.rows.length > 0);
    return { assets, debts, groups, archived: rows.filter((r) => r.account.archived), worth: netWorth(snapshot.chart, snapshot.events, '9999-12-31').total };
  }, [snapshot, sort]);

  const editAccount = editId && snapshot ? snapshot.accounts.find((a) => a.id === editId) : undefined;
  const archiveAccount = archiveId && snapshot ? snapshot.accounts.find((a) => a.id === archiveId) : undefined;
  const archiveBalance = archiveAccount && snapshot ? ledgerBalance(archiveAccount.id, snapshot.events) : 0n;

  const openAccount = (id: string) => {
    if (landscapeTablet) {
      router.setParams({ view: id });
      return;
    }
    router.push(`/accounts/${id}`);
  };

  const list = (
    <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }} style={landscapeTablet ? { width: 360, maxWidth: 360, flexGrow: 0 } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
        <View>
          <Text variant="caption" tone="textSecondary">
            {t('accounts.netWorth')}
          </Text>
          {summary ? <Amount testID="net-worth" minor={summary.worth} variant="display-md" /> : <Placeholder width={180} height={36} />}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          {bankConnectAvailable() ? (
            <Button
              testID="connect-bank"
              kind="secondary"
              label={t('accounts.connect')}
              onPress={() => {
                setConnectOpen(true);
                router.setParams({ connect: '1' });
              }}
            />
          ) : null}
          <Button
            testID="accounts-sort"
            kind="secondary"
            label={t('accounts.sort.label', { mode: SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '' })}
            onPress={() => setSortOpen(true)}
          />
          <Button
            testID="reorder-accounts"
            kind="secondary"
            label={reordering ? t('accounts.reorderDone') : t('accounts.reorder')}
            onPress={() => setReordering(!reordering)}
          />
          <Button testID="accounts-add" label={t('accounts.add')} onPress={() => router.setParams({ account: 'new' })} />
        </View>
      </View>

      {!summary ? (
        <Placeholder height={120} />
      ) : summary.groups.length === 0 ? (
        <EmptyState
          title={t('accounts.emptyTitle')}
          body={t('accounts.emptyBody')}
          actionLabel={t('accounts.add')}
          onAction={() => router.setParams({ account: 'new' })}
        />
      ) : (
        <>
          <AssetsDebtsBar assets={summary.assets} debts={summary.debts} />
          {summary.groups.map((g) => (
            <Card key={g.group} testID={`group-${g.group}`} style={{ padding: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: sp['spacing-md'], gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm" accessibilityRole="header">
                  {t(`accounts.group.${g.group}`)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
                  {g.group === 'investments' ? (
                    <Pressable accessibilityRole="link" testID="see-portfolio" onPress={() => router.push('/investments')}>
                      <Text tone="link">{t('accounts.seePortfolio')}</Text>
                    </Pressable>
                  ) : null}
                  <Amount minor={g.total} />
                </View>
              </View>
              {g.rows.map((r) => (
                <AccountLine
                  key={r.account.id}
                  row={r}
                  snapshot={snapshot!}
                  bankLink={syncByAccount.get(r.account.id)}
                  borderColor={theme.border}
                  selected={viewId === r.account.id}
                  onOpen={() => openAccount(r.account.id)}
                  onMove={reordering ? (by) => move(r.account.id, by) : undefined}
                  dragEnabled={Platform.OS === 'web' && (reordering || size !== 'phone')}
                  dragging={dragId === r.account.id}
                  onDragStart={() => setDragId(r.account.id)}
                  onDrop={() => dropOnto(r.account.id)}
                  onMenu={(kind) => {
                    if (kind === 'edit') router.setParams({ account: r.account.id });
                    else if (kind === 'value') router.setParams({ value: r.account.id });
                    else setArchiveId(r.account.id);
                  }}
                />
              ))}
            </Card>
          ))}
          {summary.archived.length > 0 ? (
            <Card style={{ padding: 0 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showArchived }}
                onPress={() => setShowArchived(!showArchived)}
                style={{ padding: sp['spacing-md'], minHeight: 44 }}
              >
                <Text>{t('accounts.archived', { count: summary.archived.length })}</Text>
              </Pressable>
              {showArchived
                ? summary.archived.map((r) => (
                    <View key={r.account.id} style={{ gap: sp['spacing-xxs'] }}>
                      <AccountLine
                        row={r}
                        snapshot={snapshot!}
                        bankLink={syncByAccount.get(r.account.id)}
                        borderColor={theme.border}
                        onOpen={() => openAccount(r.account.id)}
                      />
                      {r.account.closedWithBalance ? (
                        <Text variant="caption" tone="textSecondary" style={{ paddingHorizontal: sp['spacing-md'], paddingBottom: sp['spacing-sm'] }}>
                          {t('account.closedWithBalance')}
                        </Text>
                      ) : null}
                    </View>
                  ))
                : null}
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );

  return (
    <AppFrame title={t('accounts.title')}>
      <View style={{ flex: 1, flexDirection: landscapeTablet ? 'row' : 'column', gap: sp['spacing-lg'] }}>
        {list}
        {landscapeTablet && viewId ? (
          <View testID="accounts-detail-pane" style={{ flex: 1, minWidth: 0 }}>
            <AccountScreen embedded accountId={viewId} />
          </View>
        ) : null}
      </View>
      {adding ? <AddAccountSheet onClose={closeAccountParam} /> : null}
      {connectOpen ? <ConnectBankSheet onClose={closeConnect} /> : null}
      {editAccount ? <EditAccountSheet account={editAccount} onClose={closeAccountParam} /> : null}
      {valueId ? <UpdateValueSheetForAccount accountId={valueId} onClose={closeValueParam} /> : null}
      {archiveAccount && snapshot ? (
        <ArchiveSheet account={archiveAccount} balance={archiveBalance} snapshot={snapshot} onClose={() => setArchiveId(null)} />
      ) : null}
      <Popover visible={sortOpen} onClose={() => setSortOpen(false)} testID="accounts-sort-menu">
        <View style={{ gap: sp['spacing-xs'], minWidth: 200 }}>
          {SORT_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              testID={`sort-${o.value}`}
              onPress={() => {
                setSort(o.value);
                setSortOpen(false);
              }}
              style={{ paddingVertical: sp['spacing-sm'], paddingHorizontal: sp['spacing-md'] }}
            >
              <Text tone={sort === o.value ? 'link' : undefined}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </Popover>
    </AppFrame>
  );
}

function AssetsDebtsBar({ assets, debts }: { assets: bigint; debts: bigint }) {
  const theme = useTheme();
  const total = assets + debts;
  const share = total === 0n ? 0 : Number((assets * 1000n) / total) / 10;
  return (
    <View style={{ gap: sp['spacing-xs'] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="textSecondary">
          {t('accounts.assets')} <Amount minor={assets} variant="caption" />
        </Text>
        <Text variant="caption" tone="textSecondary">
          {t('accounts.debts')} <Amount minor={debts} variant="caption" />
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden' }}>
        <View style={{ width: `${share}%`, height: 8, backgroundColor: theme.primaryFill }} />
      </View>
    </View>
  );
}

function rowCaption(account: Account, link?: BankLink): string {
  const bits: string[] = [];
  if (account.institution) bits.push(account.institution);
  if (account.last4) bits.push(t('accounts.masked', { last4: account.last4 }));
  if (link?.lastSyncedAt) {
    bits.push(t('accounts.syncedAt', { when: formatDay(link.lastSyncedAt.slice(0, 10)) }));
  } else if (account.openedAt) {
    bits.push(t('accounts.updatedOn', { date: formatDay(account.openedAt) }));
  }
  return bits.join(' · ');
}

function AccountLine({
  row,
  snapshot,
  bankLink,
  borderColor,
  selected,
  onOpen,
  onMove,
  dragEnabled,
  dragging,
  onDragStart,
  onDrop,
  onMenu,
}: {
  row: AccountRow;
  snapshot: Snapshot;
  bankLink?: BankLink;
  borderColor: string;
  selected?: boolean;
  onOpen: () => void;
  onMove?: (by: -1 | 1) => void;
  dragEnabled?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDrop?: () => void;
  onMenu?: (kind: 'edit' | 'value' | 'archive') => void;
}) {
  const { account, balance } = row;
  const owes = ACCOUNT_KIND_INFO[account.type].ledger === 'liability';
  const theme = useTheme();
  const showValue = account.type === 'property' || isInvestmentAccount(account.type);
  const holdings = isInvestmentAccount(account.type) ? portfolioFigures(snapshot, account.id) : [];
  const holdingsGainPct =
    holdings.length > 0
      ? (() => {
          const cost = holdings.reduce((s, h) => s + h.cost, 0n);
          const gain = holdings.reduce((s, h) => s + h.gain, 0n);
          return cost === 0n ? null : Number((gain * 10000n) / cost) / 100;
        })()
      : null;
  const menuItems = [
    { key: 'edit', label: t('account.edit'), onPress: () => onMenu?.('edit') },
    ...(showValue ? [{ key: 'value', label: t('account.updateValue'), onPress: () => onMenu?.('value') }] : []),
    { key: 'archive', label: t('account.archive'), onPress: () => onMenu?.('archive') },
  ];
  const webDrag =
    dragEnabled && Platform.OS === 'web'
      ? ({
          draggable: true,
          onDragStart: () => onDragStart?.(),
          onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
          onDrop: () => onDrop?.(),
        } as Record<string, unknown>)
      : {};

  return (
    <View
      testID={dragEnabled ? `drag-account-${account.id}` : undefined}
      {...webDrag}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: borderColor,
        backgroundColor: selected ? theme.tagFill : undefined,
        opacity: dragging ? 0.6 : 1,
      }}
    >
      {onMove ? (
        <View style={{ paddingLeft: sp['spacing-sm'] }}>
          <Pressable
            testID={`up-${account.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.moveUp', { name: account.name })}
            onPress={() => onMove(-1)}
            style={{ minWidth: 44, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronUp size={18} color={theme.text} />
          </Pressable>
          <Pressable
            testID={`down-${account.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.moveDown', { name: account.name })}
            onPress={() => onMove(1)}
            style={{ minWidth: 44, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronDown size={18} color={theme.text} />
          </Pressable>
        </View>
      ) : null}
      <Pressable
        testID={`account-${account.id}`}
        accessibilityRole="link"
        onPress={onOpen}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'], padding: sp['spacing-md'] }}
      >
        <AccountAvatar name={account.name} institution={account.institution} />
        <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
          <Text>{account.name}</Text>
          <Text variant="caption" tone="textSecondary">
            {rowCaption(account, bankLink)}
          </Text>
          {holdings.length > 0 ? (
            <Text testID={`holdings-${account.id}`} variant="caption" tone="textSecondary">
              {t('accounts.holdingsCount', { count: holdings.length })}
              {holdingsGainPct !== null
                ? `  ${holdingsGainPct >= 0 ? t('accounts.gainPct', { pct: holdingsGainPct.toFixed(1) }) : t('accounts.lossPct', { pct: Math.abs(holdingsGainPct).toFixed(1) })}`
                : ''}
            </Text>
          ) : null}
        </View>
        {!account.countInBudget ? <PillTag label={t('accounts.tracking')} /> : null}
        {row.waiting ? <StatusPill label={t('tx.waiting')} kind="pending" /> : null}
        {owes && balance < 0n ? (
          <Text variant="body-tabular">
            {t('accounts.youOwe')} <Amount minor={-balance} />
          </Text>
        ) : (
          <Amount minor={balance} />
        )}
      </Pressable>
      {onMenu ? (
        <Menu
          testID={`account-row-menu-${account.id}`}
          trigger={(open) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.options')}
              onPress={open}
              onLongPress={open}
              style={{ padding: sp['spacing-md'], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon icon={MoreHorizontal} size="nav" />
            </Pressable>
          )}
          items={menuItems}
        />
      ) : null}
    </View>
  );
}

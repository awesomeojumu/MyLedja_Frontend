import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import { aiApi, type BankLink } from '@/api/ai';
import { useAuth } from '@/features/auth/AuthProvider';
import { bankConnectAvailable } from '@/features/banking/monoConnect';
import { useToast } from '@/design/components';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import {
  RedesignAmount,
  RedesignAppFrame,
  RedesignButton,
  RedesignChip,
  RedesignCouldNotLoad,
  RedesignEmpty,
  RedesignField,
  RedesignIcon,
  RedesignListRow,
  RedesignSheet,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import type { Account } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { endOfMonth } from '@/features/dashboard/helpers';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { ledgerBalance, monthOf, monthsEndingAt, netWorth, prevMonth } from '@/ledger';
import { formatNaira, PRIVACY_MASK } from '@/money';

import { AccountScreen } from './AccountScreen';
import { ArchiveSheet, EditAccountSheet, UpdateValueSheetForAccount } from './accountSheets';
import { accountRows, type AccountRow } from './helpers';
import { RedesignAddAccountSheet, RedesignConnectBankSearchSheet } from './RedesignAccountSheets';
import { RedesignConnectBankFlow } from './RedesignConnectBankFlow';
import {
  REDESIGN_ACCOUNT_GROUPS,
  redesignGroupFor,
  redesignGroupLabel,
  sortRedesignRows,
  type RedesignAccountGroup,
} from './redesignGroups';

const sp = tokens.space;

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

function rowSubtitle(account: Account, link?: BankLink): string {
  const parts: string[] = [];
  if (account.last4) {
    parts.push(`•••• ${account.last4}`);
  }
  if (link?.lastSyncedAt) {
    const day = link.lastSyncedAt.slice(0, 10);
    if (day === today()) parts.push(t('redesign.accounts.updatedToday'));
    else parts.push(t('redesign.accounts.updatedOn', { date: monthLong(day) }));
  } else if (account.type === 'cash') {
    parts.push(t('accounts.kind.cash'));
  } else if (account.openedAt) {
    if (account.openedAt === today()) parts.push(t('redesign.accounts.updatedToday'));
    else parts.push(t('redesign.accounts.updatedOn', { date: monthLong(account.openedAt) }));
  } else {
    parts.push(t(`accounts.kind.${account.type}`));
  }
  return parts.join(' · ');
}

function amountText(minor: bigint, privacy: boolean): string {
  if (privacy) return PRIVACY_MASK;
  return formatNaira(minor);
}

function Sparkline({ values }: { values: number[] }) {
  const w = 324;
  const h = 56;
  if (values.length < 2) {
    return (
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} testID="net-worth-sparkline">
        <Path d={`M0 ${h * 0.7} L${w} ${h * 0.3}`} stroke={theme.primary} strokeWidth={2} fill="none" />
      </Svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} testID="net-worth-sparkline">
      <Path d={area} fill={theme.primarySoft} />
      <Path d={line} stroke={theme.primary} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function NetWorthCard({
  worth,
  change,
  own,
  owe,
  spark,
  privacy,
}: {
  worth: bigint;
  change: bigint;
  own: bigint;
  owe: bigint;
  spark: number[];
  privacy: boolean;
}) {
  const changeLabel =
    change === 0n
      ? t('redesign.accounts.changeFlat')
      : t('redesign.accounts.changeMonth', {
          amount: privacy ? PRIVACY_MASK : formatNaira(change, { signed: true }),
        });

  const total = own + owe;
  const assetsRatio = total > 0n ? Math.max(5, Math.min(95, Math.round(Number((own * 100n) / total)))) : 50;
  const debtsRatio = 100 - assetsRatio;

  return (
    <View
      testID="redesign-net-worth-card"
      style={{
        backgroundColor: theme.surface,
        borderRadius: tokens.shape['radius-lg'],
        padding: sp.lg,
        gap: sp.sm,
      }}
    >
      <RedesignText variant="helper" tone="textSecondary">
        {t('accounts.netWorth')}
      </RedesignText>
      <RedesignAmount testID="net-worth" text={privacy ? PRIVACY_MASK : formatNaira(worth)} sizeVariant="display" />
      <RedesignText testID="net-worth-change" variant="helper" tone="textSecondary">
        {changeLabel}
      </RedesignText>
      <Sparkline values={spark} />
      <View style={{ flexDirection: 'row', gap: sp.md, marginTop: sp.xs }}>
        <View style={{ flex: 1, gap: 2 }}>
          <RedesignText variant="helper" tone="textSecondary">
            {t('redesign.accounts.youOwn')}
          </RedesignText>
          <RedesignAmount testID="you-own" text={privacy ? PRIVACY_MASK : formatNaira(own)} sizeVariant="body" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <RedesignText variant="helper" tone="textSecondary">
            {t('redesign.accounts.youOwe')}
          </RedesignText>
          <RedesignAmount testID="you-owe" text={privacy ? PRIVACY_MASK : formatNaira(owe)} sizeVariant="body" />
        </View>
      </View>

      {/* Assets vs. Debts Proportional Ratio Bar */}
      <View testID="net-worth-ratio-bar" style={{ gap: sp.xs, marginTop: sp.xs }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <RedesignText testID="net-worth-ratio-assets" variant="caption" tone="textSecondary">
            {t('redesign.accounts.ratioAssets', { amount: privacy ? PRIVACY_MASK : formatNaira(own) })}
          </RedesignText>
          <RedesignText testID="net-worth-ratio-debts" variant="caption" tone="textSecondary">
            {t('redesign.accounts.ratioDebts', { amount: privacy ? PRIVACY_MASK : formatNaira(owe) })}
          </RedesignText>
        </View>
        <View
          style={{
            height: 8,
            borderRadius: tokens.shape['radius-pill'],
            flexDirection: 'row',
            overflow: 'hidden',
            backgroundColor: theme.surfaceMuted,
          }}
        >
          <View
            style={{
              flex: assetsRatio,
              backgroundColor: theme.primary,
            }}
          />
          <View
            style={{
              flex: debtsRatio,
              backgroundColor: theme.danger,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function GroupBlock({
  group,
  total,
  rows,
  privacy,
  onOpen,
  onLongPress,
  syncByAccount,
  reorderMode,
  onMoveUp,
  onMoveDown,
  onSeePortfolio,
}: {
  group: RedesignAccountGroup;
  total: bigint;
  rows: AccountRow[];
  privacy: boolean;
  onOpen: (id: string) => void;
  onLongPress: (account: Account) => void;
  syncByAccount: Map<string, BankLink>;
  reorderMode: boolean;
  onMoveUp: (account: Account) => void;
  onMoveDown: (account: Account) => void;
  onSeePortfolio?: () => void;
}) {
  return (
    <View testID={`redesign-group-${group}`} style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sp.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
          <RedesignText variant="label">{redesignGroupLabel(group)}</RedesignText>
          {group === 'investments' && onSeePortfolio && (
            <Pressable
              testID="investments-see-portfolio"
              accessibilityRole="link"
              onPress={onSeePortfolio}
              style={{ paddingVertical: sp.xs }}
            >
              <RedesignText tone="primary" variant="helper">
                {t('accounts.seePortfolio')}
              </RedesignText>
            </Pressable>
          )}
        </View>
        <RedesignText variant="helper" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
          {amountText(total, privacy)}
        </RedesignText>
      </View>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          overflow: 'hidden',
        }}
      >
        {rows.map((r, idx) => {
          const isTracking = !r.account.countInBudget;
          const trackingTag = isTracking ? (
            <View
              testID={`account-tracking-tag-${r.account.id}`}
              style={{
                paddingHorizontal: sp.xs,
                paddingVertical: 1,
                borderRadius: tokens.shape['radius-pill'],
                backgroundColor: theme.surfaceMuted,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <RedesignText variant="caption" tone="textSecondary">
                {t('redesign.accounts.tracking')}
              </RedesignText>
            </View>
          ) : undefined;

          const reorderControls = reorderMode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
              {idx > 0 && (
                <Pressable
                  testID={`account-move-up-${r.account.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('redesign.accounts.moveUp')}
                  onPress={() => onMoveUp(r.account)}
                  style={{ padding: sp.xs }}
                >
                  <RedesignIcon name="chevron-up" size={18} color={theme.text} />
                </Pressable>
              )}
              {idx < rows.length - 1 && (
                <Pressable
                  testID={`account-move-down-${r.account.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('redesign.accounts.moveDown')}
                  onPress={() => onMoveDown(r.account)}
                  style={{ padding: sp.xs }}
                >
                  <RedesignIcon name="chevron-down" size={18} color={theme.text} />
                </Pressable>
              )}
            </View>
          ) : undefined;

          return (
            <RedesignListRow
              key={r.account.id}
              testID={`account-${r.account.id}`}
              title={r.account.name}
              subtitle={rowSubtitle(r.account, syncByAccount.get(r.account.id))}
              trailing={amountText(r.balance, privacy)}
              onPress={() => onOpen(r.account.id)}
              onLongPress={() => onLongPress(r.account)}
              badge={trackingTag}
              trailingAction={reorderControls}
            />
          );
        })}
      </View>
    </View>
  );
}

export function RedesignAccountsScreen() {
  const { snapshot, repo } = useWorkspace();
  const { privacy, setPrivacy } = useDesign();
  const router = useRouter();
  const toast = useToast();
  const addTx = useOptionalAddTransaction();
  const params = useGlobalSearchParams<{ account?: string; value?: string; connect?: string; view?: string }>();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const landscapeTablet = size !== 'phone' && width >= height;
  const phone = size === 'phone';

  const [connectBankLabel, setConnectBankLabel] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'cash' | 'credit' | 'investments' | 'property'>('all');
  const [reorderMode, setReorderMode] = useState(false);
  const [actionAccount, setActionAccount] = useState<Account | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const { client, user } = useAuth();
  const adding = params.account === 'new';
  const editId = params.account && params.account !== 'new' ? params.account : null;
  const valueId = params.value ?? null;
  const viewId = typeof params.view === 'string' ? params.view : null;
  const connectSearch = params.connect === '1' && !connectBankLabel;

  const closeAccountParam = () => router.setParams({ account: undefined });
  const closeValueParam = () => router.setParams({ value: undefined });
  const closeConnect = () => {
    setConnectBankLabel(null);
    router.setParams({ connect: undefined });
  };

  useEffect(() => {
    if (!user) return;
    const api = aiApi(client);
    void api.bankLinks(user.workspaceId).then(
      (r) => setBankLinks(r.links.filter((l) => l.status !== 'disconnected')),
      () => setBankLinks([]),
    );
  }, [client, user, connectSearch, connectBankLabel]);

  const syncByAccount = useMemo(() => {
    const map = new Map<string, BankLink>();
    for (const l of bankLinks) map.set(l.accountId, l);
    return map;
  }, [bankLinks]);

  const summary = useMemo(() => {
    if (!snapshot) return null;
    const rows = accountRows(snapshot);
    const live = rows.filter((r) => !r.account.archived);

    // Apply search filter
    const query = searchQuery.trim().toLowerCase();
    const searched = query
      ? live.filter(
          (r) =>
            r.account.name.toLowerCase().includes(query) ||
            (r.account.institution && r.account.institution.toLowerCase().includes(query)) ||
            (r.account.last4 && r.account.last4.includes(query)),
        )
      : live;

    const own = live.filter((r) => r.balance > 0n).reduce((s, r) => s + r.balance, 0n);
    const owe = live.filter((r) => r.balance < 0n).reduce((s, r) => s - r.balance, 0n);

    // Apply category / group filter
    const groups = REDESIGN_ACCOUNT_GROUPS.map((group) => {
      // Check group match with filter chip
      if (selectedFilter === 'cash' && group !== 'everyday' && group !== 'savings') return null;
      if (selectedFilter === 'credit' && group !== 'creditLoans') return null;
      if (selectedFilter === 'investments' && group !== 'investments') return null;
      if (selectedFilter === 'property' && group !== 'property' && group !== 'other') return null;

      const members = sortRedesignRows(searched.filter((r) => redesignGroupFor(r.account.type) === group));
      return { group, rows: members, total: members.reduce((s, r) => s + r.balance, 0n) };
    })
      .filter((g): g is { group: RedesignAccountGroup; rows: AccountRow[]; total: bigint } => g !== null && g.rows.length > 0);

    const month = monthOf(today());
    const worthNow = netWorth(snapshot.chart, snapshot.events, endOfMonth(month)).total;
    const worthPrev = netWorth(snapshot.chart, snapshot.events, endOfMonth(prevMonth(month))).total;
    const sparkMonths = monthsEndingAt(month, 6);
    const spark = sparkMonths.map((m) => Number(netWorth(snapshot.chart, snapshot.events, endOfMonth(m)).total) / 100);

    return {
      own,
      owe,
      groups,
      worth: worthNow,
      change: worthNow - worthPrev,
      spark,
      archived: rows.filter((r) => r.account.archived),
    };
  }, [snapshot, searchQuery, selectedFilter]);

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

  const openAdd = () => router.setParams({ account: 'new' });
  const openConnect = () => {
    setConnectBankLabel(null);
    router.setParams({ connect: '1' });
  };

  const handleSyncAll = async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      if (user) {
        const api = aiApi(client);
        const r = await api.bankLinks(user.workspaceId);
        setBankLinks(r.links.filter((l) => l.status !== 'disconnected'));
      }
      toast.show(t('redesign.accounts.syncFinished'));
    } catch {
      toast.show(t('redesign.accounts.syncFinished'));
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleMoveAccount = async (account: Account, direction: 'up' | 'down') => {
    if (!snapshot) return;
    const group = redesignGroupFor(account.type);
    const groupAccounts = snapshot.accounts
      .filter((a) => !a.archived && redesignGroupFor(a.type) === group)
      .sort((a, b) => a.order - b.order);
    const index = groupAccounts.findIndex((a) => a.id === account.id);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groupAccounts.length) return;
    const target = groupAccounts[targetIndex]!;
    const currentOrder = account.order;
    const targetOrder = target.order === currentOrder ? (direction === 'up' ? currentOrder - 1 : currentOrder + 1) : target.order;
    await repo.updateAccount({ ...account, order: targetOrder });
    await repo.updateAccount({ ...target, order: currentOrder });
  };

  const topTrailing = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
      <Pressable
        testID="accounts-privacy-toggle"
        accessibilityRole="button"
        accessibilityLabel={t('redesign.accounts.discreetMode')}
        onPress={() => setPrivacy(!privacy)}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <RedesignIcon name={privacy ? 'eye-off' : 'eye'} size={22} color={theme.text} />
      </Pressable>
      <Pressable
        testID="accounts-top-add"
        accessibilityRole="button"
        accessibilityLabel={t('redesign.accounts.add')}
        onPress={openAdd}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <RedesignIcon name="plus" size={24} color={theme.text} />
      </Pressable>
    </View>
  );

  const body = (
    <View style={{ flex: 1, flexDirection: landscapeTablet ? 'row' : 'column', gap: sp.lg }}>
      <ScrollView
        testID="redesign-accounts-scroll"
        contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}
        style={landscapeTablet ? { width: 360, maxWidth: 360, flexGrow: 0 } : undefined}
      >
        {loadError ? (
          <RedesignCouldNotLoad
            onRetry={() => {
              setLoadError(false);
              void repo.load().catch(() => setLoadError(true));
            }}
          />
        ) : !summary ? (
          <View testID="redesign-accounts-loading" style={{ gap: sp.md }}>
            <RedesignSkeleton height={180} />
            <RedesignSkeleton height={28} />
            <RedesignSkeleton height={120} />
            <RedesignSkeleton height={120} />
          </View>
        ) : summary.groups.length === 0 && !searchQuery && selectedFilter === 'all' ? (
          <RedesignEmpty
            title={t('redesign.accounts.emptyTitle')}
            body={t('redesign.accounts.emptyBody')}
            actionLabel={t('redesign.accounts.add')}
            onAction={openAdd}
          />
        ) : (
          <>
            {!phone ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: sp.md, flexWrap: 'wrap' }}>
                <View>
                  <RedesignText variant="title">{t('accounts.title')}</RedesignText>
                  <RedesignText variant="helper" tone="textSecondary">
                    {t('redesign.accounts.count', {
                      count: summary.groups.reduce((n, g) => n + g.rows.length, 0),
                    })}
                  </RedesignText>
                </View>
                <View style={{ flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pressable
                    testID="accounts-privacy-toggle"
                    accessibilityRole="button"
                    accessibilityLabel={t('redesign.accounts.discreetMode')}
                    onPress={() => setPrivacy(!privacy)}
                    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <RedesignIcon name={privacy ? 'eye-off' : 'eye'} size={22} color={theme.text} />
                  </Pressable>
                  <RedesignButton
                    testID="accounts-sync-all"
                    kind="secondary"
                    label={isSyncingAll ? t('redesign.accounts.syncing') : t('redesign.accounts.syncAll')}
                    onPress={() => void handleSyncAll()}
                  />
                  <RedesignButton
                    testID="accounts-reorder-toggle"
                    kind="secondary"
                    label={reorderMode ? t('redesign.accounts.reorderDone') : t('redesign.accounts.reorder')}
                    onPress={() => setReorderMode(!reorderMode)}
                  />
                  {bankConnectAvailable() ? (
                    <RedesignButton testID="connect-bank" kind="secondary" label={t('redesign.accounts.connect')} onPress={openConnect} />
                  ) : null}
                  <RedesignButton testID="accounts-add" label={t('redesign.accounts.add')} onPress={openAdd} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <RedesignButton
                  testID="accounts-reorder-toggle"
                  kind="secondary"
                  label={reorderMode ? t('redesign.accounts.reorderDone') : t('redesign.accounts.reorder')}
                  onPress={() => setReorderMode(!reorderMode)}
                />
                <RedesignButton
                  testID="accounts-sync-all"
                  kind="secondary"
                  label={isSyncingAll ? t('redesign.accounts.syncing') : t('redesign.accounts.syncAll')}
                  onPress={() => void handleSyncAll()}
                />
              </View>
            )}

            <NetWorthCard
              worth={summary.worth}
              change={summary.change}
              own={summary.own}
              owe={summary.owe}
              spark={summary.spark}
              privacy={privacy}
            />

            {/* Quick Search & Filter Chips */}
            <View style={{ gap: sp.sm }}>
              <RedesignField
                testID="accounts-search"
                label={t('redesign.accounts.searchPlaceholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('redesign.accounts.searchPlaceholder')}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.xs }}>
                <RedesignChip
                  testID="accounts-filter-all"
                  label={t('redesign.accounts.filterAll')}
                  selected={selectedFilter === 'all'}
                  onPress={() => setSelectedFilter('all')}
                />
                <RedesignChip
                  testID="accounts-filter-cash"
                  label={t('redesign.accounts.filterCash')}
                  selected={selectedFilter === 'cash'}
                  onPress={() => setSelectedFilter('cash')}
                />
                <RedesignChip
                  testID="accounts-filter-credit"
                  label={t('redesign.accounts.filterCredit')}
                  selected={selectedFilter === 'credit'}
                  onPress={() => setSelectedFilter('credit')}
                />
                <RedesignChip
                  testID="accounts-filter-investments"
                  label={t('redesign.accounts.filterInvestments')}
                  selected={selectedFilter === 'investments'}
                  onPress={() => setSelectedFilter('investments')}
                />
                <RedesignChip
                  testID="accounts-filter-property"
                  label={t('redesign.accounts.filterProperty')}
                  selected={selectedFilter === 'property'}
                  onPress={() => setSelectedFilter('property')}
                />
              </ScrollView>
            </View>

            {!phone ? (
              <RedesignText variant="label">{t('redesign.accounts.yourAccounts')}</RedesignText>
            ) : null}

            {summary.groups.map((g) => (
              <GroupBlock
                key={g.group}
                group={g.group}
                total={g.total}
                rows={g.rows}
                privacy={privacy}
                onOpen={openAccount}
                onLongPress={(account) => setActionAccount(account)}
                syncByAccount={syncByAccount}
                reorderMode={reorderMode}
                onMoveUp={(acc) => void handleMoveAccount(acc, 'up')}
                onMoveDown={(acc) => void handleMoveAccount(acc, 'down')}
                onSeePortfolio={() => router.push('/investments')}
              />
            ))}

            {/* Collapsible Archived Drawer */}
            {summary.archived.length > 0 && (
              <View testID="accounts-archived-drawer" style={{ gap: sp.sm }}>
                <Pressable
                  testID="accounts-archived-toggle"
                  accessibilityRole="button"
                  onPress={() => setArchivedOpen(!archivedOpen)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sp.xs }}
                >
                  <RedesignText variant="label" tone="textSecondary">
                    {t('redesign.accounts.archivedDrawer', { count: summary.archived.length })}
                  </RedesignText>
                  <RedesignIcon name={archivedOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
                </Pressable>
                {archivedOpen && (
                  <View
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: tokens.shape['radius-lg'],
                      overflow: 'hidden',
                    }}
                  >
                    {summary.archived.map((r) => (
                      <RedesignListRow
                        key={r.account.id}
                        testID={`account-archived-${r.account.id}`}
                        title={r.account.name}
                        subtitle={rowSubtitle(r.account)}
                        trailing={amountText(r.balance, privacy)}
                        onPress={() => openAccount(r.account.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {phone ? (
              <View style={{ flexDirection: 'row', gap: sp.sm }}>
                {bankConnectAvailable() ? (
                  <View style={{ flex: 1 }}>
                    <RedesignButton
                      testID="connect-bank"
                      kind="secondary"
                      label={t('redesign.accounts.connect')}
                      onPress={openConnect}
                      fullWidth
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <RedesignButton testID="accounts-add" label={t('redesign.accounts.add')} onPress={openAdd} fullWidth />
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      {landscapeTablet && viewId ? (
        <View testID="accounts-detail-pane" style={{ flex: 1, minWidth: 0 }}>
          <AccountScreen embedded accountId={viewId} />
        </View>
      ) : null}
    </View>
  );

  const sheets = (
    <>
      {adding ? <RedesignAddAccountSheet onClose={closeAccountParam} /> : null}
      {connectSearch ? (
        <RedesignConnectBankSearchSheet
          onClose={closeConnect}
          onContinue={(label) => {
            setConnectBankLabel(label);
          }}
        />
      ) : null}
      {connectBankLabel ? (
        <RedesignConnectBankFlow
          bankLabel={connectBankLabel}
          onClose={closeConnect}
          onManual={() => {
            closeConnect();
            openAdd();
          }}
        />
      ) : null}
      {editAccount ? <EditAccountSheet account={editAccount} onClose={closeAccountParam} /> : null}
      {valueId ? <UpdateValueSheetForAccount accountId={valueId} onClose={closeValueParam} /> : null}
      {archiveAccount && snapshot ? (
        <ArchiveSheet account={archiveAccount} balance={archiveBalance} snapshot={snapshot} onClose={() => setArchiveId(null)} />
      ) : null}

      {/* Account Quick Action Bottom Sheet */}
      {actionAccount && (
        <RedesignSheet
          visible={!!actionAccount}
          title={actionAccount.name}
          testID="account-action-sheet"
          onClose={() => setActionAccount(null)}
        >
          <View style={{ gap: sp.sm, paddingVertical: sp.sm }}>
            <RedesignButton
              testID="account-action-add-tx"
              kind="secondary"
              label={t('redesign.accounts.actionAddTx')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                if (addTx) {
                  addTx.open('expense', { accountId: accId });
                } else {
                  router.push({ pathname: '/transactions', params: { new: 'expense', accountId: accId } });
                }
              }}
              fullWidth
            />
            <RedesignButton
              testID="account-action-transfer"
              kind="secondary"
              label={t('redesign.accounts.actionTransfer')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                router.push({ pathname: '/transactions', params: { new: 'transfer', from: accId } });
              }}
              fullWidth
            />
            <RedesignButton
              testID="account-action-reconcile"
              kind="secondary"
              label={t('redesign.accounts.actionReconcile')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                router.push(`/accounts/${accId}/reconcile`);
              }}
              fullWidth
            />
            <RedesignButton
              testID="account-action-update-value"
              kind="secondary"
              label={t('redesign.accounts.actionUpdateValue')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                router.setParams({ value: accId });
              }}
              fullWidth
            />
            <RedesignButton
              testID="account-action-edit"
              kind="secondary"
              label={t('redesign.accounts.actionEdit')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                router.setParams({ account: accId });
              }}
              fullWidth
            />
            <RedesignButton
              testID="account-action-archive"
              kind="secondary"
              label={t('redesign.accounts.actionArchive')}
              onPress={() => {
                const accId = actionAccount.id;
                setActionAccount(null);
                setArchiveId(accId);
              }}
              fullWidth
            />
          </View>
        </RedesignSheet>
      )}
    </>
  );

  if (phone) {
    return (
      <>
        <RedesignAppFrame title={t('accounts.title')} trailingExtra={topTrailing}>
          {body}
        </RedesignAppFrame>
        {sheets}
      </>
    );
  }

  return (
    <AppFrame title={t('accounts.title')}>
      {body}
      {sheets}
    </AppFrame>
  );
}

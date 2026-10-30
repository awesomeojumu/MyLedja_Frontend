import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import { aiApi, type BankLink } from '@/api/ai';
import { useAuth } from '@/features/auth/AuthProvider';
import { bankConnectAvailable } from '@/features/banking/monoConnect';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import {
  RedesignAmount,
  RedesignAppFrame,
  RedesignButton,
  RedesignCouldNotLoad,
  RedesignEmpty,
  RedesignIcon,
  RedesignListRow,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import type { Account } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { endOfMonth } from '@/features/dashboard/helpers';
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
  if (link?.lastSyncedAt) {
    const day = link.lastSyncedAt.slice(0, 10);
    if (day === today()) return t('redesign.accounts.updatedToday');
    return t('redesign.accounts.updatedOn', { date: monthLong(day) });
  }
  if (account.type === 'cash') return t('accounts.kind.cash');
  if (account.openedAt) {
    if (account.openedAt === today()) return t('redesign.accounts.updatedToday');
    return t('redesign.accounts.updatedOn', { date: monthLong(account.openedAt) });
  }
  return t(`accounts.kind.${account.type}`);
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
    </View>
  );
}

function GroupBlock({
  group,
  total,
  rows,
  privacy,
  onOpen,
  syncByAccount,
}: {
  group: RedesignAccountGroup;
  total: bigint;
  rows: AccountRow[];
  privacy: boolean;
  onOpen: (id: string) => void;
  syncByAccount: Map<string, BankLink>;
}) {
  return (
    <View testID={`redesign-group-${group}`} style={{ gap: sp.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sp.xs }}>
        <RedesignText variant="label">{redesignGroupLabel(group)}</RedesignText>
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
        {rows.map((r) => (
          <RedesignListRow
            key={r.account.id}
            testID={`account-${r.account.id}`}
            title={r.account.name}
            subtitle={rowSubtitle(r.account, syncByAccount.get(r.account.id))}
            trailing={amountText(r.balance, privacy)}
            onPress={() => onOpen(r.account.id)}
          />
        ))}
      </View>
    </View>
  );
}

export function RedesignAccountsScreen() {
  const { snapshot, repo } = useWorkspace();
  const { privacy } = useDesign();
  const router = useRouter();
  const params = useGlobalSearchParams<{ account?: string; value?: string; connect?: string; view?: string }>();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const landscapeTablet = size !== 'phone' && width >= height;
  const phone = size === 'phone';
  const [connectBankLabel, setConnectBankLabel] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const [loadError, setLoadError] = useState(false);
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
    const own = live.filter((r) => r.balance > 0n).reduce((s, r) => s + r.balance, 0n);
    const owe = live.filter((r) => r.balance < 0n).reduce((s, r) => s - r.balance, 0n);
    const groups = REDESIGN_ACCOUNT_GROUPS.map((group) => {
      const members = sortRedesignRows(live.filter((r) => redesignGroupFor(r.account.type) === group));
      return { group, rows: members, total: members.reduce((s, r) => s + r.balance, 0n) };
    }).filter((g) => g.rows.length > 0);
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
  }, [snapshot]);

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

  const plusTrailing = (
    <Pressable
      testID="accounts-top-add"
      accessibilityRole="button"
      accessibilityLabel={t('redesign.accounts.add')}
      onPress={openAdd}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="plus" size={24} color={theme.text} />
    </Pressable>
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
        ) : summary.groups.length === 0 ? (
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
                <View style={{ flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap' }}>
                  {bankConnectAvailable() ? (
                    <RedesignButton testID="connect-bank" kind="secondary" label={t('redesign.accounts.connect')} onPress={openConnect} />
                  ) : null}
                  <RedesignButton testID="accounts-add" label={t('redesign.accounts.add')} onPress={openAdd} />
                </View>
              </View>
            ) : null}

            <NetWorthCard
              worth={summary.worth}
              change={summary.change}
              own={summary.own}
              owe={summary.owe}
              spark={summary.spark}
              privacy={privacy}
            />

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
                syncByAccount={syncByAccount}
              />
            ))}

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
    </>
  );

  if (phone) {
    return (
      <>
        <RedesignAppFrame title={t('accounts.title')} trailingExtra={plusTrailing}>
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

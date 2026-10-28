import { bankConnectAvailable } from '@/features/banking/monoConnect';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  Icon,
  Menu,
  PillTag,
  Placeholder,
  Popover,
  StatusPill,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_GROUPS, ACCOUNT_KIND_INFO, type Account } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';
import { holdingsValueByAccount, wealthAt } from '@/features/investments/helpers';
import { today } from '@/features/transactions/helpers';
import { ledgerBalance } from '@/ledger';

import {
  AccountAvatar,
  AddAccountSheet,
  ArchiveSheet,
  ConnectBankSheet,
  EditAccountSheet,
  UpdateValueSheetForAccount,
} from './accountSheets';
import { sortAccountRows, type AccountSort } from './helpers';

const sp = tokens.spacing;

export type AccountRow = { account: Account; balance: bigint; waiting: boolean };

/**
 * Balances as signed contributions to net worth: what you owe is negative (P08-02). An investment account
 * also holds its holdings at market value (TECH-SPEC 6.8).
 */
export function accountRows(snapshot: Snapshot): AccountRow[] {
  const held = holdingsValueByAccount(snapshot, today());
  return snapshot.accounts.map((account) => {
    const balance = ledgerBalance(account.id, snapshot.events) + (held.get(account.id) ?? 0n);
    const waiting = snapshot.events.some((e) => snapshot.waiting.has(e.id) && e.lines.some((l) => l.ledgerAccountId === account.id));
    return { account, balance, waiting };
  });
}

const SORT_OPTIONS: { value: AccountSort; label: string }[] = [
  { value: 'custom', label: t('accounts.sort.custom') },
  { value: 'balance', label: t('accounts.sort.balance') },
  { value: 'name', label: t('accounts.sort.name') },
  { value: 'type', label: t('accounts.sort.type') },
];

export function AccountsScreen() {
  const { snapshot } = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [sort, setSort] = useState<AccountSort>('custom');
  const [sortOpen, setSortOpen] = useState(false);
  const [rowSheet, setRowSheet] = useState<{ id: string; kind: 'edit' | 'value' | 'archive' } | null>(null);
  const { repo } = useWorkspace();
  const move = (id: string, by: -1 | 1) => {
    if (!snapshot) return;
    const ids = snapshot.accounts.filter((a) => !a.archived).map((a) => a.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void repo.reorderAccounts(ids);
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
    return { assets, debts, groups, archived: rows.filter((r) => r.account.archived), worth: wealthAt(snapshot, today()).total };
  }, [snapshot, sort]);

  const rowAccount = rowSheet && snapshot ? snapshot.accounts.find((a) => a.id === rowSheet.id) : undefined;
  const rowBalance = rowAccount && snapshot ? ledgerBalance(rowAccount.id, snapshot.events) : 0n;

  return (
    <AppFrame title={t('accounts.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
          <View>
            <Text variant="caption" tone="textSecondary">
              {t('accounts.netWorth')}
            </Text>
            {summary ? <Amount testID="net-worth" minor={summary.worth} variant="display-md" /> : <Placeholder width={180} height={36} />}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
            {bankConnectAvailable() ? (
              <Button testID="connect-bank" kind="secondary" label={t('accounts.connect')} onPress={() => setConnectOpen(true)} />
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
            <Button testID="accounts-add" label={t('accounts.add')} onPress={() => setAdding(true)} />
          </View>
        </View>

        {!summary ? (
          <Placeholder height={120} />
        ) : summary.groups.length === 0 ? (
          <EmptyState title={t('accounts.emptyTitle')} body={t('accounts.emptyBody')} actionLabel={t('accounts.add')} onAction={() => setAdding(true)} />
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
                      <Pressable
                        accessibilityRole="link"
                        testID="see-portfolio"
                        onPress={() => toast.show(t('accounts.portfolioLater'))}
                      >
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
                    borderColor={theme.border}
                    onMove={reordering ? (by) => move(r.account.id, by) : undefined}
                    onMenu={(kind) => setRowSheet({ id: r.account.id, kind })}
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
                {showArchived ? summary.archived.map((r) => <AccountLine key={r.account.id} row={r} borderColor={theme.border} />) : null}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
      {adding ? <AddAccountSheet onClose={() => setAdding(false)} /> : null}
      {connectOpen ? <ConnectBankSheet onClose={() => setConnectOpen(false)} /> : null}
      {rowSheet?.kind === 'edit' && rowAccount ? <EditAccountSheet account={rowAccount} onClose={() => setRowSheet(null)} /> : null}
      {rowSheet?.kind === 'value' && rowSheet.id ? <UpdateValueSheetForAccount accountId={rowSheet.id} onClose={() => setRowSheet(null)} /> : null}
      {rowSheet?.kind === 'archive' && rowAccount && snapshot ? (
        <ArchiveSheet account={rowAccount} balance={rowBalance} snapshot={snapshot} onClose={() => setRowSheet(null)} />
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

function AccountLine({
  row,
  borderColor,
  onMove,
  onMenu,
}: {
  row: AccountRow;
  borderColor: string;
  onMove?: (by: -1 | 1) => void;
  onMenu?: (kind: 'edit' | 'value' | 'archive') => void;
}) {
  const { account, balance } = row;
  const owes = ACCOUNT_KIND_INFO[account.type].ledger === 'liability';
  const router = useRouter();
  const theme = useTheme();
  const showValue = account.type === 'property' || account.type === 'investment';
  const menuItems = [
    { key: 'edit', label: t('account.edit'), onPress: () => onMenu?.('edit') },
    ...(showValue ? [{ key: 'value', label: t('account.updateValue'), onPress: () => onMenu?.('value') }] : []),
    { key: 'archive', label: t('account.archive'), onPress: () => onMenu?.('archive') },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: borderColor }}>
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
        onPress={() => router.push(`/accounts/${account.id}`)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'], padding: sp['spacing-md'] }}
      >
        <AccountAvatar name={account.name} institution={account.institution} />
        <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
          <Text>{account.name}</Text>
          <Text variant="caption" tone="textSecondary">
            {[account.institution, account.last4 ? t('accounts.masked', { last4: account.last4 }) : null, t('accounts.syncedNow')]
              .filter(Boolean)
              .join(' · ')}
          </Text>
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

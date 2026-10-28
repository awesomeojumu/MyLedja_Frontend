import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  AmountInput,
  Button,
  Card,
  DatePicker,
  EmptyState,
  Footer,
  InlineError,
  PillTag,
  Placeholder,
  Sheet,
  StatusPill,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { ACCOUNT_GROUPS, ACCOUNT_KIND_INFO, ACCOUNT_KINDS, type Account, type AccountKind } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { ledgerBalance, netWorth } from '@/ledger';

const sp = tokens.spacing;

export type AccountRow = { account: Account; balance: bigint; waiting: boolean };

/** Balances as signed contributions to net worth: what you owe is negative (P08-02). */
export function accountRows(snapshot: Snapshot): AccountRow[] {
  return snapshot.accounts.map((account) => {
    const balance = ledgerBalance(account.id, snapshot.events);
    const waiting = snapshot.events.some((e) => snapshot.waiting.has(e.id) && e.lines.some((l) => l.ledgerAccountId === account.id));
    return { account, balance, waiting };
  });
}

export function AccountsScreen() {
  const { snapshot } = useWorkspace();
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reordering, setReordering] = useState(false);
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
      const members = live.filter((r) => ACCOUNT_KIND_INFO[r.account.type].group === group);
      return { group, rows: members, total: members.reduce((s, r) => s + r.balance, 0n) };
    }).filter((g) => g.rows.length > 0);
    return { assets, debts, groups, archived: rows.filter((r) => r.account.archived), worth: netWorth(snapshot.chart, snapshot.events, '9999-12-31').total };
  }, [snapshot]);

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
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: sp['spacing-md'] }}>
                  <Text variant="heading-sm" accessibilityRole="header">
                    {t(`accounts.group.${g.group}`)}
                  </Text>
                  <Amount minor={g.total} />
                </View>
                {g.rows.map((r) => (
                  <AccountLine key={r.account.id} row={r} borderColor={theme.border} onMove={reordering ? (by) => move(r.account.id, by) : undefined} />
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

function AccountLine({ row, borderColor, onMove }: { row: AccountRow; borderColor: string; onMove?: (by: -1 | 1) => void }) {
  const { account, balance } = row;
  const owes = ACCOUNT_KIND_INFO[account.type].ledger === 'liability';
  const router = useRouter();
  const theme = useTheme();
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
        <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
          <Text>{account.name}</Text>
          <Text variant="caption" tone="textSecondary">
            {[account.institution, account.last4 ? t('accounts.masked', { last4: account.last4 }) : null].filter(Boolean).join(' · ')}
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
    </View>
  );
}

function AddAccountSheet({ onClose }: { onClose: () => void }) {
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
        <View accessibilityLabel={t('accounts.type')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
          {ACCOUNT_KINDS.map((k) => (
            <PillTag
              key={k}
              testID={`type-${k}`}
              label={t(`accounts.kind.${k}`)}
              selected={type === k}
              onPress={() => {
                setType(k);
                setCountInBudget(ACCOUNT_KIND_INFO[k].countInBudget);
              }}
            />
          ))}
        </View>
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

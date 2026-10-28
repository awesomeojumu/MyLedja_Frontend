import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  Amount,
  Button,
  Card,
  Confirm,
  EmptyState,
  InlineError,
  Placeholder,
  Select,
  Sheet,
  Text,
  TextInput,
  AmountInput,
  formatDay,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { PersonDebt } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { DebtsPaymentSheet } from './DebtsPaymentSheet';
import { debtOriginalAmount, debtProgress, nextInstallment } from './schedule';
import { debtRows, debtTotals, findRecentPayment, type DebtFilter } from './helpers';

const sp = tokens.spacing;
const FILTERS: DebtFilter[] = ['all', 'owedToMe', 'iOwe', 'settled'];

export function DebtsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const theme = useTheme();
  const onDate = today();
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [lendOpen, setLendOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<PersonDebt | null>(null);
  const [payBalance, setPayBalance] = useState<bigint>(0n);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{ accountId: string; principal: bigint; interest: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (snapshot ? debtRows(snapshot, filter, onDate) : null), [snapshot, filter, onDate]);
  const totals = rows && snapshot ? debtTotals(debtRows(snapshot, 'all', onDate)) : null;
  const bankLoans = useMemo(() => snapshot?.accounts.filter((a) => a.type === 'loan' && !a.archived) ?? [], [snapshot]);

  async function saveListPayment(debt: PersonDebt, balance: bigint, input: { accountId: string; principal: bigint; interest: bigint; force?: boolean }) {
    setError(null);
    const dup = snapshot ? findRecentPayment(debt.id, snapshot, input.principal, onDate) : null;
    if (dup && !input.force) {
      setDuplicateConfirm({ ...input });
      return;
    }
    const r = await repo.recordDebtPayment(debt.id, { accountId: input.accountId, amount: input.principal, date: onDate, interest: input.interest });
    if (!r.ok) setError(ledgerMessage(r.error));
    else setPayDebt(null);
  }

  return (
    <AppFrame title={t('debts.title')}>
      {totals ? (
        <View testID="debts-summary" style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
          <SummaryTile label={t('debts.theyOwe')} amount={totals.owedToMe} />
          <SummaryTile label={t('debts.iOwe')} amount={totals.iOwe} />
          <SummaryTile label={t('debts.net')} amount={totals.net} emphasize />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            testID={`debts-filter-${f}`}
            kind={filter === f ? 'primary-pill' : 'secondary'}
            label={t(`debts.filter.${f}`)}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
        <Button testID="debts-lent" label={t('debts.iLent')} onPress={() => setLendOpen(true)} />
        <Button testID="debts-borrowed" kind="secondary" label={t('debts.iBorrowed')} onPress={() => setBorrowOpen(true)} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!rows ? (
        <Placeholder height={120} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('debts.emptyTitle')} body={t('debts.emptyBody')} actionLabel={t('debts.iLent')} onAction={() => setLendOpen(true)} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
          {rows.map(({ debt, balance }) => {
            const original = snapshot ? debtOriginalAmount(debt.id, snapshot) : 0n;
            const progress = snapshot ? debtProgress(debt.id, snapshot, balance) : 0;
            const next = snapshot ? nextInstallment(debt, snapshot, onDate) : null;
            return (
              <Card key={debt.id} testID={`debt-row-${debt.id}`} style={{ gap: sp['spacing-sm'] }}>
                <Pressable accessibilityRole="button" onPress={() => router.push(`/debts/${debt.id}`)}>
                  <Text variant="heading-sm">{debt.name}</Text>
                  <Text tone="textSecondary">{debt.direction === 'owedToMe' ? t('debts.theyOweLabel') : t('debts.iOweLabel')}</Text>
                  {original > 0n ? (
                    <Text tone="textSecondary">
                      <Amount minor={balance} variant="caption" /> {t('debts.of')} <Amount minor={original} variant="caption" />
                    </Text>
                  ) : (
                    <Amount minor={balance} />
                  )}
                  {original > 0n ? (
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden', marginVertical: sp['spacing-xs'] }}>
                      <View style={{ height: 8, width: `${Math.round(progress * 100)}%`, backgroundColor: theme.primaryFill }} />
                    </View>
                  ) : null}
                  {next ? (
                    <Text variant="caption" tone="textSecondary">
                      {t('debts.dueLabel', { date: formatDay(next.dueDate) })}
                    </Text>
                  ) : null}
                </Pressable>
                {debt.status === 'open' ? (
                  <Button
                    testID={`debt-pay-${debt.id}`}
                    kind="secondary"
                    label={t('debts.recordPayment')}
                    onPress={() => {
                      setPayBalance(balance);
                      setPayDebt(debt);
                    }}
                  />
                ) : (
                  <Text variant="caption" tone="textSecondary">
                    {t('debts.settled')}
                  </Text>
                )}
              </Card>
            );
          })}
          {bankLoans.length > 0 ? (
            <Card testID="debts-bank-loans" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('debts.bankLoansTitle')}</Text>
              <Text tone="textSecondary">{t('debts.bankLoansBody')}</Text>
              {bankLoans.map((a) => (
                <Pressable key={a.id} testID={`debts-bank-${a.id}`} accessibilityRole="link" onPress={() => router.push(`/accounts/${a.id}`)}>
                  <Text>{a.name}</Text>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      )}
      {lendOpen && snapshot ? (
        <OpenDebtSheet
          direction="owedToMe"
          snapshot={snapshot}
          onClose={() => setLendOpen(false)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.openPersonDebt({ ...input, direction: 'owedToMe' });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setLendOpen(false);
          }}
        />
      ) : null}
      {borrowOpen && snapshot ? (
        <OpenDebtSheet
          direction="iOwe"
          snapshot={snapshot}
          onClose={() => setBorrowOpen(false)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.openPersonDebt({ ...input, direction: 'iOwe' });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setBorrowOpen(false);
          }}
        />
      ) : null}
      {payDebt && snapshot ? (
        <DebtsPaymentSheet
          max={payBalance}
          snapshot={snapshot}
          onClose={() => setPayDebt(null)}
          onSave={(input) => saveListPayment(payDebt, payBalance, input)}
        />
      ) : null}
      <Confirm
        visible={duplicateConfirm !== null && payDebt !== null}
        title={t('debts.duplicateTitle')}
        body={t('debts.duplicateBody', { date: onDate })}
        confirmLabel={t('debts.duplicateConfirm')}
        onConfirm={() => {
          if (!duplicateConfirm || !payDebt) return;
          void saveListPayment(payDebt, payBalance, { ...duplicateConfirm, force: true });
          setDuplicateConfirm(null);
        }}
        onCancel={() => setDuplicateConfirm(null)}
      />
    </AppFrame>
  );
}

function SummaryTile({ label, amount, emphasize }: { label: string; amount: bigint; emphasize?: boolean }) {
  return (
    <Card style={{ flex: 1, gap: sp['spacing-xs'], minWidth: 100 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Amount minor={amount} variant={emphasize ? 'heading-sm' : 'body-tabular'} />
    </Card>
  );
}

function OpenDebtSheet({
  direction,
  snapshot,
  onClose,
  onSave,
}: {
  direction: 'owedToMe' | 'iOwe';
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (input: { name: string; accountId: string; amount: bigint; date: string; payeeName?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const title = direction === 'owedToMe' ? t('debts.lendTitle') : t('debts.borrowTitle');
  const caption = direction === 'owedToMe' ? t('debts.lendCaption') : t('debts.borrowCaption');

  return (
    <Sheet
      visible
      title={title}
      onClose={onClose}
      testID="debt-open-sheet"
      footer={
        <Button
          testID="debt-open-save"
          label={t('panel.save')}
          disabled={!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId}
          onPress={() => void onSave({ name, accountId, amount: amountMinor!, date: today(), payeeName: name })}
        />
      }
    >
      <Text tone="textSecondary">{caption}</Text>
      <TextInput testID="debt-name" label={t('debts.personName')} value={name} onChangeText={setName} />
      <AmountInput testID="debt-amount" label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="debt-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}

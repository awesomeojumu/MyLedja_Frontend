import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Amount, Button, Card, EmptyState, InlineError, Placeholder, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { debtRows, debtTotals, type DebtFilter } from './helpers';

const sp = tokens.spacing;
const FILTERS: DebtFilter[] = ['all', 'owedToMe', 'iOwe', 'settled'];

export function DebtsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const [filter, setFilter] = useState<DebtFilter>('all');
  const [lendOpen, setLendOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (snapshot ? debtRows(snapshot, filter, today()) : null), [snapshot, filter]);
  const totals = rows ? debtTotals(debtRows(snapshot!, 'all', today())) : null;
  const bankLoans = useMemo(() => snapshot?.accounts.filter((a) => a.type === 'loan' && !a.archived) ?? [], [snapshot]);

  return (
    <AppFrame title={t('debts.title')}>
      {totals ? (
        <Card style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-xs'] }}>
          <Text tone="textSecondary">
            {t('debts.theyOwe')}: <Amount minor={totals.owedToMe} variant="caption" /> · {t('debts.iOwe')}:{' '}
            <Amount minor={totals.iOwe} variant="caption" />
          </Text>
          <Text variant="heading-sm">
            {t('debts.net')}: <Amount minor={totals.net} variant="heading-sm" />
          </Text>
        </Card>
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
          {rows.map(({ debt, balance }) => (
            <Pressable key={debt.id} testID={`debt-row-${debt.id}`} accessibilityRole="button" onPress={() => router.push(`/debts/${debt.id}`)}>
              <Card style={{ gap: sp['spacing-xs'] }}>
                <Text variant="heading-sm">{debt.name}</Text>
                <Text tone="textSecondary">{debt.direction === 'owedToMe' ? t('debts.theyOweLabel') : t('debts.iOweLabel')}</Text>
                <Amount minor={balance} />
                {debt.status === 'open' ? (
                  <Button testID={`debt-pay-${debt.id}`} kind="secondary" label={t('debts.recordPayment')} onPress={() => router.push(`/debts/${debt.id}`)} />
                ) : (
                  <Text variant="caption" tone="textSecondary">
                    {t('debts.settled')}
                  </Text>
                )}
              </Card>
            </Pressable>
          ))}
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
    </AppFrame>
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

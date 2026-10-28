import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { Amount, Button, Card, EmptyState, InlineError, Placeholder, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { IncomeStream } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthOf } from '@/ledger';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { incomeForMonth, unmatchedIncome } from './helpers';

const sp = tokens.spacing;

export function IncomeScreen() {
  const { snapshot, repo } = useWorkspace();
  const month = monthOf(today());
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => (snapshot ? incomeForMonth(snapshot, month) : null), [snapshot, month]);
  const unmatched = snapshot ? unmatchedIncome(snapshot, month) : 0n;

  return (
    <AppFrame title={t('income.title')}>
      {summary ? (
        <Card style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('income.summaryTitle', { month })}</Text>
          <Text tone="textSecondary">
            {t('income.expected')}: <Amount minor={summary.expected} variant="caption" /> · {t('income.received')}:{' '}
            <Amount minor={summary.received} variant="caption" />
          </Text>
          <Text tone="textSecondary">
            {t('income.stillToCome')}: <Amount minor={summary.expected > summary.received ? summary.expected - summary.received : 0n} variant="caption" />
          </Text>
        </Card>
      ) : null}
      <Button testID="income-add" label={t('income.addStream')} onPress={() => setAddOpen(true)} style={{ marginBottom: sp['spacing-md'] }} />
      {error ? <InlineError message={error} /> : null}
      {!summary ? (
        <Placeholder height={120} />
      ) : summary.rows.length === 0 && unmatched === 0n ? (
        <EmptyState title={t('income.emptyTitle')} body={t('income.emptyBody')} actionLabel={t('income.addStream')} onAction={() => setAddOpen(true)} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
          {summary.rows.map(({ stream, expected, received }) => (
            <StreamCard key={stream.id} stream={stream} expected={expected} received={received} onRecord={async () => {
              setError(null);
              const left = expected > received ? expected - received : expected;
              const r = await repo.recordIncomeReceived(stream.id, { accountId: stream.accountId, amount: left, date: today() });
              if (!r.ok) setError(ledgerMessage(r.error));
            }} />
          ))}
          {unmatched > 0n ? (
            <Card testID="income-unmatched">
              <Text variant="heading-sm">{t('income.unmatchedTitle')}</Text>
              <Amount minor={unmatched} />
            </Card>
          ) : null}
        </ScrollView>
      )}
      {addOpen && snapshot ? (
        <AddStreamSheet
          snapshot={snapshot}
          onClose={() => setAddOpen(false)}
          onSave={async (data) => {
            await repo.addIncomeStream(data);
            setAddOpen(false);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function StreamCard({
  stream,
  expected,
  received,
  onRecord,
}: {
  stream: IncomeStream;
  expected: bigint;
  received: bigint;
  onRecord: () => Promise<void>;
}) {
  return (
    <Card testID={`income-stream-${stream.id}`} style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{stream.name}</Text>
      <Text tone="textSecondary">
        <Amount minor={received} variant="caption" /> {t('goals.of')} <Amount minor={expected} variant="caption" />
      </Text>
      {received < expected ? (
        <Button testID={`income-record-${stream.id}`} kind="secondary" label={t('income.markReceived')} onPress={() => void onRecord()} />
      ) : received > expected ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.aboveExpected')}{' '}
          <Amount minor={received - expected} variant="caption" />
        </Text>
      ) : null}
    </Card>
  );
}

function AddStreamSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (data: Omit<IncomeStream, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'income')?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name }));

  return (
    <Sheet
      visible
      title={t('income.addStreamTitle')}
      onClose={onClose}
      testID="income-add-sheet"
      footer={
        <Button
          testID="income-save"
          label={t('panel.save')}
          disabled={!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId || !categoryId}
          onPress={() =>
            void onSave({
              name: name.trim(),
              kind: 'regular',
              expectedMinor: amountMinor!.toString(),
              accountId,
              categoryId,
              rule: { every: 'month', on: 1 },
              countInBudget: true,
            })
          }
        />
      }
    >
      <TextInput testID="income-name" label={t('income.name')} value={name} onChangeText={setName} />
      <AmountInput testID="income-amount" label={t('income.expectedAmount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="income-account" label={t('income.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Select testID="income-category" label={t('income.category')} options={categories} value={categoryId} onChange={setCategoryId} />
    </Sheet>
  );
}

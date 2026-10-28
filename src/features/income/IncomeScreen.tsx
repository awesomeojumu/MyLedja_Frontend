import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Amount, Button, Card, EmptyState, InlineError, Placeholder, Select, Sheet, Switch, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { IncomeStream, IncomeStreamKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthOf } from '@/ledger';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { incomeForMonth, streamPaymentDots, taxTotalsForYear, unmatchedEvents, unmatchedIncome } from './helpers';

const sp = tokens.spacing;

export function IncomeScreen() {
  const { snapshot, repo } = useWorkspace();
  const month = monthOf(today());
  const year = today().slice(0, 4);
  const [addOpen, setAddOpen] = useState(false);
  const [recordStream, setRecordStream] = useState<IncomeStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => (snapshot ? incomeForMonth(snapshot, month) : null), [snapshot, month]);
  const unmatched = snapshot ? unmatchedIncome(snapshot, month) : 0n;
  const unmatchedList = snapshot ? unmatchedEvents(snapshot, month) : [];
  const taxRows = snapshot ? taxTotalsForYear(snapshot, year) : [];

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
          {summary.steadiness !== null ? (
            <Text tone="textSecondary">{t('income.steadiness', { percent: summary.steadiness })}</Text>
          ) : null}
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
            <StreamCard
              key={stream.id}
              stream={stream}
              snapshot={snapshot!}
              month={month}
              expected={expected}
              received={received}
              onRecord={() => setRecordStream(stream)}
            />
          ))}
          {unmatched > 0n ? (
            <Card testID="income-unmatched" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('income.unmatchedTitle')}</Text>
              <Amount minor={unmatched} />
              {unmatchedList.map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'] }}>
                  <Button
                    testID={`income-link-${e.id}`}
                    kind="secondary"
                    size="sm"
                    label={t('income.linkToStream')}
                    onPress={() => {
                      const stream = snapshot!.incomeStreams[0];
                      if (stream) void repo.linkEventToStream(e.id, stream.id);
                    }}
                  />
                  <Button testID={`income-oneoff-${e.id}`} kind="link" size="sm" label={t('income.markOneOff')} onPress={() => void repo.markIncomeOneOff(e.id)} />
                </View>
              ))}
            </Card>
          ) : null}
          {taxRows.length > 0 ? (
            <Card testID="income-tax-table" style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{t('income.taxTitle', { year })}</Text>
              {taxRows.map((row) => (
                <Text key={row.label} tone="textSecondary">
                  {row.label}: <Amount minor={row.gross} variant="caption" />
                </Text>
              ))}
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
      {recordStream && snapshot ? (
        <RecordIncomeSheet
          stream={recordStream}
          snapshot={snapshot}
          onClose={() => setRecordStream(null)}
          onSave={async (amount) => {
            setError(null);
            const r = await repo.recordIncomeReceived(recordStream.id, { accountId: recordStream.accountId, amount, date: today() });
            if (!r.ok) setError(ledgerMessage(r.error));
            else setRecordStream(null);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function StreamCard({
  stream,
  snapshot,
  month,
  expected,
  received,
  onRecord,
}: {
  stream: IncomeStream;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  month: string;
  expected: bigint;
  received: bigint;
  onRecord: () => void;
}) {
  const dots = streamPaymentDots(stream, snapshot, month);
  return (
    <Card testID={`income-stream-${stream.id}`} style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{stream.name}</Text>
      {!stream.countInBudget ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.offBudget')}
        </Text>
      ) : null}
      <Text tone="textSecondary">
        <Amount minor={received} variant="caption" /> {t('goals.of')} <Amount minor={expected} variant="caption" />
      </Text>
      <View accessibilityRole="text" accessibilityLabel={dots.map((d) => t(`income.dot.${d}`)).join(', ')} style={{ flexDirection: 'row', gap: 4 }}>
        {dots.map((d, i) => (
          <Text key={i} variant="caption">
            {d === 'onTime' ? '●' : d === 'partial' ? '◐' : d === 'missed' ? '○' : '·'}
          </Text>
        ))}
      </View>
      {received < expected ? (
        <Button testID={`income-record-${stream.id}`} kind="secondary" label={t('income.markReceived')} onPress={onRecord} />
      ) : received > expected ? (
        <Text variant="caption" tone="textSecondary">
          {t('income.aboveExpected')} <Amount minor={received - expected} variant="caption" />
        </Text>
      ) : null}
    </Card>
  );
}

function RecordIncomeSheet({
  stream,
  onClose,
  onSave,
}: {
  stream: IncomeStream;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (amount: bigint) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  return (
    <Sheet
      visible
      title={t('income.recordTitle')}
      onClose={onClose}
      testID="income-record-sheet"
      footer={
        <Button
          testID="income-record-save"
          label={t('panel.save')}
          disabled={amountMinor === null || amountMinor <= 0n}
          onPress={() => void onSave(amountMinor!)}
        />
      }
    >
      <Text tone="textSecondary">{stream.name}</Text>
      <AmountInput testID="income-record-amount" label={t('income.receivedAmount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
    </Sheet>
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
  const [kind, setKind] = useState<IncomeStreamKind>('regular');
  const [countInBudget, setCountInBudget] = useState(true);
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'income')?.id ?? '');
  const [taxClass, setTaxClass] = useState('');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'income').map((c) => ({ value: c.id, label: c.name }));
  const kinds: IncomeStreamKind[] = ['regular', 'variable', 'irregular', 'passive'];

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
              kind,
              expectedMinor: amountMinor!.toString(),
              accountId,
              categoryId,
              rule: { every: 'month', on: 1 },
              countInBudget: kind === 'passive' ? countInBudget : true,
              taxClass: taxClass.trim() || undefined,
            })
          }
        />
      }
    >
      <TextInput testID="income-name" label={t('income.name')} value={name} onChangeText={setName} />
      <Select testID="income-kind" label={t('income.kind')} options={kinds.map((k) => ({ value: k, label: t(`income.kind.${k}`) }))} value={kind} onChange={(v) => setKind(v as IncomeStreamKind)} />
      <AmountInput testID="income-amount" label={t('income.expectedAmount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="income-account" label={t('income.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Select testID="income-category" label={t('income.category')} options={categories} value={categoryId} onChange={setCategoryId} />
      <TextInput testID="income-tax-class" label={t('income.taxClass')} value={taxClass} onChangeText={setTaxClass} />
      {kind === 'passive' ? (
        <Switch testID="income-count-budget" label={t('income.countInBudget')} value={countInBudget} onChange={setCountInBudget} />
      ) : null}
    </Sheet>
  );
}

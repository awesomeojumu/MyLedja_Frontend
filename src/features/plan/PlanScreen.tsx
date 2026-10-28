import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Amount, Button, Card, EmptyState, InlineError, Placeholder, Select, Sheet, Text, TextInput, AmountInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Recurring } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { monthOf } from '@/ledger';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { billsForMonth, planSummary, type BillRow } from './recurrence';

const sp = tokens.spacing;
const GROUP_ORDER: BillRow['group'][] = ['overdue', 'dueSoon', 'later', 'paid'];

export function PlanScreen() {
  const { snapshot, repo } = useWorkspace();
  const [month] = useState(monthOf(today()));
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (snapshot ? billsForMonth(snapshot, month, today()) : null), [snapshot, month]);
  const summary = rows ? planSummary(rows) : null;

  return (
    <AppFrame title={t('plan.title')}>
      {summary ? (
        <Card style={{ marginBottom: sp['spacing-md'], gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('plan.summaryTitle', { month })}</Text>
          <Text tone="textSecondary">
            {t('plan.summaryOut', { count: summary.billCount })} · <Amount minor={summary.outTotal} variant="caption" />
          </Text>
          {summary.overdue > 0 ? <Text tone="textSecondary">{t('plan.summaryOverdue', { count: summary.overdue })}</Text> : null}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', marginBottom: sp['spacing-md'] }}>
        <Button testID="plan-add" label={t('plan.addBill')} onPress={() => setAddOpen(true)} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!rows ? (
        <Placeholder height={120} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('plan.emptyTitle')} body={t('plan.emptyBody')} actionLabel={t('plan.addBill')} onAction={() => setAddOpen(true)} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {GROUP_ORDER.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            return (
              <View key={group} style={{ gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm">{t(`plan.group.${group}`)}</Text>
                {groupRows.map((row) => (
                  <BillRowView
                    key={`${row.recurring.id}-${row.dueDate}`}
                    row={row}
                    onMarkPaid={async () => {
                      if (!snapshot) return;
                      setError(null);
                      const categoryId = row.recurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id;
                      const r = await repo.markBillPaid(row.recurring.id, row.dueDate, {
                        accountId: row.recurring.accountId,
                        categoryId,
                        amount: BigInt(row.recurring.amountMinor),
                        date: today(),
                      });
                      if (!r.ok) setError(ledgerMessage(r.error));
                    }}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
      {addOpen && snapshot ? (
        <AddBillSheet
          snapshot={snapshot}
          onClose={() => setAddOpen(false)}
          onSave={async (data) => {
            setError(null);
            await repo.addRecurring(data);
            setAddOpen(false);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function BillRowView({ row, onMarkPaid }: { row: BillRow; onMarkPaid: () => Promise<void> }) {
  const paid = row.occurrence?.status === 'paid';
  return (
    <Card testID={`bill-${row.recurring.id}`} style={{ gap: sp['spacing-xs'] }}>
      <Text variant="heading-sm">{row.recurring.name}</Text>
      <Text tone="textSecondary">
        {row.dueDate} · <Amount minor={BigInt(row.recurring.amountMinor)} variant="caption" />
      </Text>
      {paid ? (
        <Text variant="caption" tone="textSecondary">
          {t('plan.paid')}
        </Text>
      ) : (
        <Button testID={`bill-mark-${row.recurring.id}`} kind="secondary" label={t('plan.markPaid')} onPress={() => void onMarkPaid()} />
      )}
    </Card>
  );
}

function AddBillSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (data: Omit<Recurring, 'id'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(snapshot.accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const [day, setDay] = useState('1');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  return (
    <Sheet
      visible
      title={t('plan.addBillTitle')}
      onClose={onClose}
      testID="plan-add-sheet"
      footer={
        <Button
          testID="plan-save"
          label={t('panel.save')}
          disabled={!name.trim() || amountMinor === null || amountMinor <= 0n || !accountId || !categoryId}
          onPress={() =>
            void onSave({
              kind: 'bill',
              name: name.trim(),
              amountMinor: amountMinor!.toString(),
              accountId,
              categoryId,
              rule: { every: 'month', on: Math.min(31, Math.max(1, Number(day) || 1)) },
              startDate: today(),
            })
          }
        />
      }
    >
      <TextInput testID="plan-name" label={t('plan.name')} value={name} onChangeText={setName} />
      <AmountInput testID="plan-amount" label={t('plan.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="plan-account" label={t('plan.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Select testID="plan-category" label={t('plan.category')} options={categories} value={categoryId} onChange={setCategoryId} />
      <TextInput testID="plan-day" label={t('plan.dayOfMonth')} value={day} onChangeText={setDay} keyboardType="number-pad" />
    </Sheet>
  );
}

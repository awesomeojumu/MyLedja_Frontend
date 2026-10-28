import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  InlineError,
  Placeholder,
  Select,
  Sheet,
  Text,
  TextInput,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Payee } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { payeeRows, yearOf } from './helpers';

const sp = tokens.spacing;

function matches(row: ReturnType<typeof payeeRows>[number], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.payee.name.toLowerCase().includes(q) ||
    row.defaultCategoryName.toLowerCase().includes(q) ||
    (row.payee.aliases ?? []).some((a) => a.toLowerCase().includes(q))
  );
}

export function PayeesScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const year = yearOf(today());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Payee | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!snapshot) return null;
    return payeeRows(snapshot, year).filter((r) => matches(r, query));
  }, [snapshot, year, query]);

  return (
    <AppFrame title={t('payees.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <TextInput testID="payees-search" label={t('payees.search')} value={query} onChangeText={setQuery} />
          </View>
          <Button testID="payees-merge" kind="secondary" label={t('payees.merge')} onPress={() => setMergeOpen(true)} disabled={!snapshot || snapshot.payees.length < 2} />
        </View>
        {error ? <InlineError message={error} /> : null}
        {!rows ? (
          <Placeholder height={120} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('payees.emptyTitle')} body={t('payees.emptyBody')} actionLabel={t('payees.title')} onAction={() => {}} />
        ) : (
          rows.map((row) => (
            <Pressable
              key={row.payee.id}
              testID={`payee-row-${row.payee.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('payees.rowLabel', { name: row.payee.name, count: row.txCount })}
              onPress={() => setSelected(row.payee)}
            >
              <Card style={{ gap: sp['spacing-xs'] }}>
                <Text variant="heading-sm">{row.payee.name}</Text>
                <Text tone="textSecondary">
                  {row.defaultCategoryName ? t('payees.defaultCategory', { name: row.defaultCategoryName }) : t('payees.noDefaultCategory')}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
                  <Text variant="caption" tone="textSecondary">
                    {t('payees.txCount', { count: row.txCount })}
                  </Text>
                  <Text variant="caption" tone="textSecondary">
                    {row.lastUsed ? t('payees.lastUsed', { date: formatDay(row.lastUsed) }) : t('payees.neverUsed')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
                  <Text variant="caption" tone="textSecondary">
                    {t('payees.spentThisYear')}:
                  </Text>
                  <Amount minor={row.spentThisYear} variant="caption" />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      {selected && snapshot ? (
        <PayeeSheet
          payee={selected}
          snapshot={snapshot}
          onClose={() => setSelected(null)}
          onSave={async (p) => {
            setError(null);
            await repo.updatePayee(p);
            toast.show(t('common.saved'));
            setSelected(null);
          }}
        />
      ) : null}

      {mergeOpen && snapshot ? (
        <MergePayeesSheet
          payees={snapshot.payees}
          onClose={() => setMergeOpen(false)}
          onMerge={async (keepId, mergeId) => {
            setError(null);
            const r = await repo.mergePayees(keepId, [mergeId]);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('payees.merged'));
            setMergeOpen(false);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function PayeeSheet({
  payee,
  snapshot,
  onClose,
  onSave,
}: {
  payee: Payee;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (p: Payee) => Promise<void>;
}) {
  const [name, setName] = useState(payee.name);
  const [categoryId, setCategoryId] = useState(payee.defaultCategoryId ?? '');
  const [aliasText, setAliasText] = useState((payee.aliases ?? []).join(', '));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.hidden);
  const options = [{ value: '', label: t('payees.noDefaultCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Sheet
      visible
      title={payee.name}
      onClose={onClose}
      testID="payee-sheet"
      footer={<Button testID="payee-save" label={t('common.save')} onPress={() => void onSave({ ...payee, name: name.trim() || payee.name, defaultCategoryId: categoryId || undefined, aliases: aliasText.split(',').map((s) => s.trim()).filter(Boolean) })} />}
    >
      <TextInput testID="payee-name" label={t('payees.name')} value={name} onChangeText={setName} />
      <Select testID="payee-category" label={t('payees.defaultCategoryLabel')} options={options} value={categoryId} onChange={setCategoryId} />
      <TextInput testID="payee-aliases" label={t('payees.aliases')} value={aliasText} onChangeText={setAliasText} />
      <Text variant="caption" tone="textSecondary">
        {t('payees.aliasesHint')}
      </Text>
    </Sheet>
  );
}

function MergePayeesSheet({
  payees,
  onClose,
  onMerge,
}: {
  payees: Payee[];
  onClose: () => void;
  onMerge: (keepId: string, mergeId: string) => Promise<void>;
}) {
  const [keepId, setKeepId] = useState(payees[0]?.id ?? '');
  const [mergeId, setMergeId] = useState(payees[1]?.id ?? '');
  const options = payees.map((p) => ({ value: p.id, label: p.name }));

  return (
    <Sheet
      visible
      title={t('payees.mergeTitle')}
      onClose={onClose}
      testID="payees-merge-sheet"
      footer={
        <Button
          testID="payees-merge-save"
          label={t('payees.mergeConfirm')}
          disabled={!keepId || !mergeId || keepId === mergeId}
          onPress={() => void onMerge(keepId, mergeId)}
        />
      }
    >
      <Text tone="textSecondary">{t('payees.mergeBody')}</Text>
      <Select testID="payees-merge-keep" label={t('payees.mergeKeep')} options={options} value={keepId} onChange={setKeepId} />
      <Select testID="payees-merge-from" label={t('payees.mergeFrom')} options={options.filter((o) => o.value !== keepId)} value={mergeId} onChange={setMergeId} />
    </Sheet>
  );
}

import { useState } from 'react';
import { View } from 'react-native';

import { Button, Select, Sheet, Switch, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { emptyFilters, type TxFilters } from './filters';

const sp = tokens.spacing;

export function FiltersSheet({
  snapshot,
  filters,
  onClose,
  onApply,
}: {
  snapshot: Snapshot;
  filters: TxFilters;
  onClose: () => void;
  onApply: (f: TxFilters) => void;
}) {
  const [draft, setDraft] = useState<TxFilters>({ ...filters });
  const accounts = [{ value: '', label: t('tx.filter.anyAccount') }, ...snapshot.accounts.map((a) => ({ value: a.id, label: a.name }))];
  const categories = [{ value: '', label: t('tx.filter.anyCategory') }, ...snapshot.categories.map((c) => ({ value: c.id, label: c.name }))];
  const payees = [{ value: '', label: t('tx.filter.anyPayee') }, ...snapshot.payees.map((p) => ({ value: p.id, label: p.name }))];
  const types = [
    { value: '', label: t('tx.filter.anyType') },
    { value: 'expense', label: t('add.kind.expense') },
    { value: 'income', label: t('add.kind.income') },
    { value: 'transfer', label: t('add.kind.transfer') },
  ];
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  return (
    <Sheet
      visible
      title={t('tx.filters')}
      onClose={onClose}
      testID="tx-filters-sheet"
      footer={
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <Button kind="secondary" label={t('tx.filter.clear')} onPress={() => onApply(emptyFilters())} />
          <Button
            testID="tx-filters-apply"
            label={t('tx.filter.apply')}
            onPress={() => {
              const minParsed = minText.trim() ? parseAmount(minText) : null;
              const maxParsed = maxText.trim() ? parseAmount(maxText) : null;
              const amountMin = minParsed && minParsed.ok ? (minParsed.minor < 0n ? -minParsed.minor : minParsed.minor) : undefined;
              const amountMax = maxParsed && maxParsed.ok ? (maxParsed.minor < 0n ? -maxParsed.minor : maxParsed.minor) : undefined;
              onApply({ ...draft, amountMin, amountMax });
            }}
          />
        </View>
      }
    >
      <TextInput testID="tx-filter-from" label={t('tx.filter.from')} value={draft.dateFrom ?? ''} onChangeText={(dateFrom) => setDraft({ ...draft, dateFrom: dateFrom || undefined })} />
      <TextInput testID="tx-filter-to" label={t('tx.filter.to')} value={draft.dateTo ?? ''} onChangeText={(dateTo) => setDraft({ ...draft, dateTo: dateTo || undefined })} />
      <Select testID="tx-filter-account" label={t('add.account')} options={accounts} value={draft.accountId ?? ''} onChange={(accountId) => setDraft({ ...draft, accountId: accountId || undefined })} />
      <Select testID="tx-filter-category" label={t('add.category')} options={categories} value={draft.categoryId ?? ''} onChange={(categoryId) => setDraft({ ...draft, categoryId: categoryId || undefined })} />
      <Select testID="tx-filter-payee" label={t('add.payee')} options={payees} value={draft.payeeId ?? ''} onChange={(payeeId) => setDraft({ ...draft, payeeId: payeeId || undefined })} />
      <Select
        testID="tx-filter-type"
        label={t('tx.filter.type')}
        options={types}
        value={draft.type ?? ''}
        onChange={(type) => setDraft({ ...draft, type: (type || undefined) as TxFilters['type'] })}
      />
      <TextInput testID="tx-filter-min" label={t('tx.filter.amountMin')} value={minText} onChangeText={setMinText} />
      <TextInput testID="tx-filter-max" label={t('tx.filter.amountMax')} value={maxText} onChangeText={setMaxText} />
      <Switch testID="tx-filter-uncategorized" label={t('tx.filter.uncategorized')} value={!!draft.uncategorized} onChange={(uncategorized) => setDraft({ ...draft, uncategorized: uncategorized || undefined })} />
    </Sheet>
  );
}

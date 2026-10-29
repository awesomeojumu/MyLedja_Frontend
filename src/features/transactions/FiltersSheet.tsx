import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, PillTag, Select, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { applyDatePreset, applyFilters, emptyFilters, type DatePreset, type TxFilters } from './filters';
import { rowsFor, today } from './helpers';

const sp = tokens.spacing;

const PRESETS: { value: DatePreset; labelKey: 'tx.filter.presetThisMonth' | 'tx.filter.presetLastMonth' | 'tx.filter.presetLast30' | 'tx.filter.presetLast3Months' | 'tx.filter.presetThisYear' | 'tx.filter.presetLastYear' }[] = [
  { value: 'thisMonth', labelKey: 'tx.filter.presetThisMonth' },
  { value: 'lastMonth', labelKey: 'tx.filter.presetLastMonth' },
  { value: 'last30', labelKey: 'tx.filter.presetLast30' },
  { value: 'last3Months', labelKey: 'tx.filter.presetLast3Months' },
  { value: 'thisYear', labelKey: 'tx.filter.presetThisYear' },
  { value: 'lastYear', labelKey: 'tx.filter.presetLastYear' },
];

const TYPES = ['expense', 'income', 'transfer', 'refund'] as const;
const STATUSES = ['posted', 'pending', 'waiting'] as const;

/** Popup #19 — filters (DESIGN page 11 / addendum PU-19). */
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
  const [minText, setMinText] = useState(filters.amountMin !== undefined ? (Number(filters.amountMin) / 100).toString() : '');
  const [maxText, setMaxText] = useState(filters.amountMax !== undefined ? (Number(filters.amountMax) / 100).toString() : '');

  const matchCount = useMemo(() => {
    const minParsed = minText.trim() ? parseAmount(minText) : null;
    const maxParsed = maxText.trim() ? parseAmount(maxText) : null;
    const amountMin = minParsed && minParsed.ok ? (minParsed.minor < 0n ? -minParsed.minor : minParsed.minor) : undefined;
    const amountMax = maxParsed && maxParsed.ok ? (maxParsed.minor < 0n ? -maxParsed.minor : maxParsed.minor) : undefined;
    const next = { ...draft, amountMin, amountMax };
    return rowsFor(snapshot).filter((r) => applyFilters(r, next, snapshot)).length;
  }, [draft, minText, maxText, snapshot]);

  const build = (): TxFilters => {
    const minParsed = minText.trim() ? parseAmount(minText) : null;
    const maxParsed = maxText.trim() ? parseAmount(maxText) : null;
    const amountMin = minParsed && minParsed.ok ? (minParsed.minor < 0n ? -minParsed.minor : minParsed.minor) : undefined;
    const amountMax = maxParsed && maxParsed.ok ? (maxParsed.minor < 0n ? -maxParsed.minor : maxParsed.minor) : undefined;
    return { ...draft, amountMin, amountMax };
  };

  return (
    <Sheet
      visible
      title={t('tx.filters')}
      onClose={onClose}
      testID="tx-filters-sheet"
      width={480}
      footer={
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
          <Button kind="secondary" testID="tx-filters-clear" label={t('tx.filter.clear')} onPress={() => onApply(emptyFilters())} />
          <Button testID="tx-filters-apply" label={t('tx.filter.showCount', { count: matchCount })} onPress={() => onApply(build())} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {PRESETS.map((p) => (
          <PillTag
            key={p.value}
            testID={`tx-filter-preset-${p.value}`}
            label={t(p.labelKey)}
            onPress={() => setDraft({ ...draft, ...applyDatePreset(p.value, today()) })}
          />
        ))}
      </View>
      <TextInput testID="tx-filter-from" label={t('tx.filter.from')} value={draft.dateFrom ?? ''} onChangeText={(dateFrom) => setDraft({ ...draft, dateFrom: dateFrom || undefined })} />
      <TextInput testID="tx-filter-to" label={t('tx.filter.to')} value={draft.dateTo ?? ''} onChangeText={(dateTo) => setDraft({ ...draft, dateTo: dateTo || undefined })} />
      <Select testID="tx-filter-account" label={t('add.account')} options={accounts} value={draft.accountId ?? ''} onChange={(accountId) => setDraft({ ...draft, accountId: accountId || undefined })} />
      <Select testID="tx-filter-category" label={t('add.category')} options={categories} value={draft.categoryId ?? ''} onChange={(categoryId) => setDraft({ ...draft, categoryId: categoryId || undefined })} />
      <Select testID="tx-filter-payee" label={t('add.payee')} options={payees} value={draft.payeeId ?? ''} onChange={(payeeId) => setDraft({ ...draft, payeeId: payeeId || undefined })} />
      <TextInput testID="tx-filter-tag" label={t('tx.filter.tag')} value={draft.tag ?? ''} onChangeText={(tag) => setDraft({ ...draft, tag: tag.trim() || undefined })} />
      <Text variant="caption" tone="textSecondary">
        {t('tx.filter.type')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {TYPES.map((type) => (
          <PillTag
            key={type}
            testID={`tx-filter-type-${type}`}
            label={t(`panel.type.${type}` as 'panel.type.expense')}
            selected={draft.type === type}
            onPress={() => setDraft({ ...draft, type: draft.type === type ? undefined : type })}
          />
        ))}
      </View>
      <Text variant="caption" tone="textSecondary">
        {t('tx.filter.status')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {STATUSES.map((status) => (
          <PillTag
            key={status}
            testID={`tx-filter-status-${status}`}
            label={t(`tx.filter.status.${status}` as 'tx.filter.status.posted')}
            selected={draft.status === status}
            onPress={() => setDraft({ ...draft, status: draft.status === status ? undefined : status })}
          />
        ))}
      </View>
      <TextInput testID="tx-filter-min" label={t('tx.filter.amountMin')} value={minText} onChangeText={setMinText} />
      <TextInput testID="tx-filter-max" label={t('tx.filter.amountMax')} value={maxText} onChangeText={setMaxText} />
      <Switch testID="tx-filter-uncategorized" label={t('tx.filter.uncategorized')} value={!!draft.uncategorized} onChange={(uncategorized) => setDraft({ ...draft, uncategorized: uncategorized || undefined })} />
      <Switch testID="tx-filter-receipt" label={t('tx.filter.hasReceipt')} value={!!draft.hasReceipt} onChange={(hasReceipt) => setDraft({ ...draft, hasReceipt: hasReceipt || undefined })} />
      <Switch testID="tx-filter-edited" label={t('tx.filter.edited')} value={!!draft.edited} onChange={(edited) => setDraft({ ...draft, edited: edited || undefined })} />
    </Sheet>
  );
}

import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, PillTag, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { parseAmount } from '@/money';

import { applyDatePreset, applyFilters, emptyFilters, toggleId, type DatePreset, type TxFilters, type TxTypeFilter } from './filters';
import { rowsFor, today } from './helpers';

const sp = tokens.spacing;

const PRESETS: {
  value: DatePreset;
  labelKey:
    | 'tx.filter.presetThisMonth'
    | 'tx.filter.presetLastMonth'
    | 'tx.filter.presetLast30'
    | 'tx.filter.presetLast3Months'
    | 'tx.filter.presetThisYear'
    | 'tx.filter.presetLastYear';
}[] = [
  { value: 'thisMonth', labelKey: 'tx.filter.presetThisMonth' },
  { value: 'lastMonth', labelKey: 'tx.filter.presetLastMonth' },
  { value: 'last30', labelKey: 'tx.filter.presetLast30' },
  { value: 'last3Months', labelKey: 'tx.filter.presetLast3Months' },
  { value: 'thisYear', labelKey: 'tx.filter.presetThisYear' },
  { value: 'lastYear', labelKey: 'tx.filter.presetLastYear' },
];

const TYPES: TxTypeFilter[] = ['expense', 'income', 'transfer', 'refund', 'debt', 'goal', 'investment'];
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
  const [minText, setMinText] = useState(filters.amountMin !== undefined ? (Number(filters.amountMin) / 100).toString() : '');
  const [maxText, setMaxText] = useState(filters.amountMax !== undefined ? (Number(filters.amountMax) / 100).toString() : '');
  const [tagDraft, setTagDraft] = useState('');

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
    const next = { ...draft, amountMin, amountMax };
    delete next.accountId;
    delete next.categoryId;
    delete next.payeeId;
    delete next.tag;
    return next;
  };

  const accountIds = draft.accountIds ?? (draft.accountId ? [draft.accountId] : []);
  const categoryIds = draft.categoryIds ?? (draft.categoryId ? [draft.categoryId] : []);
  const payeeIds = draft.payeeIds ?? (draft.payeeId ? [draft.payeeId] : []);
  const tags = draft.tags ?? (draft.tag ? [draft.tag] : []);

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

      <Text variant="caption" tone="textSecondary">
        {t('add.account')}
      </Text>
      <View testID="tx-filter-account" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {snapshot.accounts.map((a) => (
          <PillTag
            key={a.id}
            testID={`tx-filter-account-${a.id}`}
            label={a.name}
            selected={accountIds.includes(a.id)}
            onPress={() => setDraft({ ...draft, accountIds: toggleId(accountIds, a.id), accountId: undefined })}
          />
        ))}
      </View>

      <Text variant="caption" tone="textSecondary">
        {t('add.category')}
      </Text>
      <View testID="tx-filter-category" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {snapshot.categories.map((c) => (
          <PillTag
            key={c.id}
            testID={`tx-filter-category-${c.id}`}
            label={c.name}
            selected={categoryIds.includes(c.id)}
            onPress={() => setDraft({ ...draft, categoryIds: toggleId(categoryIds, c.id), categoryId: undefined })}
          />
        ))}
      </View>

      <Text variant="caption" tone="textSecondary">
        {t('add.payee')}
      </Text>
      <View testID="tx-filter-payee" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {snapshot.payees.map((p) => (
          <PillTag
            key={p.id}
            testID={`tx-filter-payee-${p.id}`}
            label={p.name}
            selected={payeeIds.includes(p.id)}
            onPress={() => setDraft({ ...draft, payeeIds: toggleId(payeeIds, p.id), payeeId: undefined })}
          />
        ))}
      </View>

      <Text variant="caption" tone="textSecondary">
        {t('tx.filter.tag')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {tags.map((tag) => (
          <PillTag key={tag} label={tag} selected onPress={() => setDraft({ ...draft, tags: toggleId(tags, tag), tag: undefined })} />
        ))}
      </View>
      <TextInput
        testID="tx-filter-tag"
        label={t('tx.filter.tag')}
        value={tagDraft}
        onChangeText={setTagDraft}
        onBlur={() => {
          const next = tagDraft.trim();
          if (!next) return;
          setDraft({ ...draft, tags: [...new Set([...tags, next])], tag: undefined });
          setTagDraft('');
        }}
      />

      <Text variant="caption" tone="textSecondary">
        {t('tx.filter.type')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-sm'] }}>
        {TYPES.map((type) => (
          <PillTag
            key={type}
            testID={`tx-filter-type-${type}`}
            label={
              type === 'debt' || type === 'goal' || type === 'investment'
                ? t(`tx.filter.type.${type}` as 'tx.filter.type.debt')
                : t(`panel.type.${type}` as 'panel.type.expense')
            }
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

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';

import {
  Amount,
  Button,
  Card,
  Checkbox,
  EmptyState,
  formatDay,
  InlineError,
  Menu,
  PillTag,
  Placeholder,
  StatusPill,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { useGlobalSearchParams, useRouter } from 'expo-router';

import { useAddTransaction } from './AddTransaction';
import { BulkEditSheet } from './BulkEditSheet';
import { ExportTransactionsSheet } from './ExportTransactionsSheet';
import { TransferMatchSheet } from './TransferMatchSheet';
import { FiltersSheet } from './FiltersSheet';
import { TransactionPanel } from './TransactionPanel';
import { applyFilters, countActive, emptyFilters, filterChips, removeChip, type TxFilters } from './filters';
import { ledgerMessage, rowsFor, today, type Row } from './helpers';

const sp = tokens.spacing;

/** Search matches payee, note, category or amount (P11-02). */
export function matchesSearch(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/[₦,\s]/g, '');
  const amount = (row.amount < 0n ? -row.amount : row.amount).toString();
  const naira = formatNaira(row.amount < 0n ? -row.amount : row.amount).replace(/[₦,]/g, '');
  return (
    row.title.toLowerCase().includes(q) ||
    row.category.toLowerCase().includes(q) ||
    (row.event.notes ?? '').toLowerCase().includes(q) ||
    (digits !== '' && /^\d+(\.\d{0,2})?$/.test(digits) && (naira.startsWith(digits) || amount.startsWith(digits)))
  );
}

// Re-export for tests that import `matches` from TransactionsScreen.
export { matchesSearch as matches };

export function TransactionsScreen() {
  const { repo, snapshot } = useWorkspace();
  const add = useAddTransaction();
  const toast = useToast();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<TxFilters>(emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [transferMatchOpen, setTransferMatchOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useGlobalSearchParams<{ tx?: string }>();

  const filteredRows = useMemo(() => {
    if (!snapshot) return [];
    return rowsFor(snapshot).filter((r) => matchesSearch(r, query) && applyFilters(r, filters, snapshot));
  }, [snapshot, query, filters]);

  const days = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of filteredRows) {
      const list = groups.get(row.event.date) ?? [];
      list.push(row);
      groups.set(row.event.date, list);
    }
    return [...groups.entries()].map(([date, rows]) => ({
      date,
      rows,
      net: rows.filter((r) => r.event.type !== 'transfer').reduce((s, r) => s + r.amount, 0n),
    }));
  }, [filteredRows]);

  const chips = snapshot ? filterChips(filters, snapshot) : [];
  const activeFilterCount = countActive(filters);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const remove = async (row: Row) => {
    setError(null);
    const result = await repo.deleteTransaction(row.event.id, today());
    if (!result.ok) {
      setError(ledgerMessage(result.error));
      return;
    }
    toast.show(t('tx.deleted'), () => void repo.restore(row.event));
  };

  const runBulk = async (field: 'category' | 'payee' | 'delete', value?: string) => {
    setError(null);
    const ids = [...selected];
    if (field === 'delete') {
      const r = await repo.bulkDelete(ids, today());
      if (!r.ok) setError(ledgerMessage(r.error));
      else toast.show(t('tx.bulk.done'));
    } else if (field === 'category' && value) {
      const r = await repo.bulkSetCategory(ids, value);
      if (!r.ok) setError(ledgerMessage(r.error));
      else toast.show(t('tx.bulk.done'));
    } else if (field === 'payee' && value) {
      const r = await repo.bulkSetPayee(ids, value);
      if (!r.ok) setError(ledgerMessage(r.error));
      else toast.show(t('tx.bulk.done'));
    }
    setSelected(new Set());
    setSelectMode(false);
  };

  return (
    <AppFrame title={t('tx.title')}>
      <View
        style={{
          flexDirection: 'row',
          gap: sp['spacing-md'],
          alignItems: 'flex-end',
          marginBottom: sp['spacing-md'],
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 160 }}>
          <TextInput testID="tx-search" label={t('tx.search')} value={query} onChangeText={setQuery} />
        </View>
        <Button
          testID="tx-filters"
          kind="secondary"
          label={activeFilterCount > 0 ? t('tx.filtersCount', { count: activeFilterCount }) : t('tx.filters')}
          onPress={() => setFiltersOpen(true)}
        />
        <Button testID="tx-select" kind="secondary" label={t('tx.select')} onPress={() => setSelectMode((v) => !v)} />
        <Button testID="tx-export" kind="secondary" label={t('tx.export')} onPress={() => setExportOpen(true)} />
        <Button testID="tx-transfer-match" kind="secondary" label={t('tx.transferMatch')} onPress={() => setTransferMatchOpen(true)} />
        <Button testID="tx-add" label={t('tx.add')} onPress={() => add.open('expense')} />
      </View>
      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-md'] }}>
          {chips.map((chip) => (
            <Pressable key={chip.key} testID={`tx-chip-${chip.key}`} accessibilityRole="button" onPress={() => setFilters(removeChip(filters, chip.key))}>
              <PillTag label={`${chip.label} ✕`} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {selectMode && selected.size > 0 ? (
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], flexWrap: 'wrap' }}>
          <Text>{t('tx.selected', { count: selected.size })}</Text>
          <Button testID="tx-bulk" label={t('tx.bulk.edit')} onPress={() => setBulkOpen(true)} />
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      {!snapshot ? (
        <View style={{ gap: sp['spacing-md'] }}>
          <Placeholder height={20} />
          <Placeholder height={56} />
          <Placeholder height={56} />
        </View>
      ) : days.length === 0 && !query && activeFilterCount === 0 ? (
        <EmptyState title={t('tx.emptyTitle')} body={t('tx.emptyBody')} actionLabel={t('tx.add')} onAction={() => add.open('expense')} />
      ) : days.length === 0 ? (
        <Text tone="textSecondary">{t('tx.noMatches')}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {days.map((day) => (
            <View key={day.date} testID={`day-${day.date}`} style={{ gap: sp['spacing-xs'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="textSecondary" accessibilityRole="header">
                  {formatDay(day.date)}
                </Text>
                <Amount minor={day.net} variant="caption" signed />
              </View>
              <Card style={{ padding: 0 }}>
                {day.rows.map((row, i) => (
                  <View
                    key={row.event.id}
                    testID={`tx-${row.event.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp['spacing-md'],
                      padding: sp['spacing-md'],
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    {selectMode ? (
                      <Checkbox testID={`select-${row.event.id}`} checked={selected.has(row.event.id)} onChange={() => toggleSelect(row.event.id)} label="" />
                    ) : null}
                    <Pressable
                      testID={`open-${row.event.id}`}
                      accessibilityRole="button"
                      onPress={() => (selectMode ? toggleSelect(row.event.id) : router.setParams({ tx: row.event.id }))}
                      accessibilityLabel={t('tx.rowLabel', {
                        title: row.title,
                        category: row.category,
                        amount: formatNaira(row.amount, { signed: row.event.type !== 'transfer' }),
                      })}
                      style={{ flex: 1, gap: sp['spacing-xxs'] }}
                    >
                      <Text>{row.title}</Text>
                      <Text variant="caption" tone="textSecondary">
                        {[row.category, row.account].filter(Boolean).join(' · ')}
                      </Text>
                      {row.event.notes ? (
                        <Text variant="caption" tone="textSecondary">
                          {row.event.notes}
                        </Text>
                      ) : null}
                    </Pressable>
                    {row.waiting ? <StatusPill label={t('tx.waiting')} kind="pending" /> : null}
                    <Amount minor={row.amount} signed={row.event.type !== 'transfer'} />
                    {!selectMode ? (
                      <Menu
                        testID={`tx-menu-${row.event.id}`}
                        trigger={(open) => (
                          <Pressable accessibilityRole="button" accessibilityLabel={t('tx.actions')} onPress={open} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                            <MoreHorizontal size={18} color={theme.textSecondary} />
                          </Pressable>
                        )}
                        items={[
                          { key: 'open', label: t('panel.title'), onPress: () => router.setParams({ tx: row.event.id }) },
                          { key: 'delete', label: t('tx.delete'), onPress: () => void remove(row) },
                        ]}
                      />
                    ) : null}
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}
      {params.tx ? <TransactionPanel id={params.tx} onClose={() => router.setParams({ tx: undefined })} /> : null}
      {filtersOpen && snapshot ? (
        <FiltersSheet snapshot={snapshot} filters={filters} onClose={() => setFiltersOpen(false)} onApply={(f) => { setFilters(f); setFiltersOpen(false); }} />
      ) : null}
      {bulkOpen && snapshot ? (
        <BulkEditSheet snapshot={snapshot} count={selected.size} onClose={() => setBulkOpen(false)} onApply={runBulk} />
      ) : null}
      {exportOpen && snapshot ? <ExportTransactionsSheet snapshot={snapshot} onClose={() => setExportOpen(false)} /> : null}
      {transferMatchOpen && snapshot ? <TransferMatchSheet snapshot={snapshot} onClose={() => setTransferMatchOpen(false)} /> : null}
    </AppFrame>
  );
}

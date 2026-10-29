import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View, Platform } from 'react-native';
import { MoreHorizontal, X } from 'lucide-react-native';

import {
  Amount,
  Button,
  Card,
  Checkbox,
  EmptyState,
  formatDay,
  Icon,
  InlineError,
  Menu,
  PillTag,
  Placeholder,
  StatusPill,
  Sheet,
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
import { BulkEditSheet, type BulkField } from './BulkEditSheet';
import { bulkSetAccount } from './bulkActions';
import { ExportTransactionsSheet } from './ExportTransactionsSheet';
import { ImportHintSheet } from './ImportHintSheet';
import { TransferMatchSheet } from './TransferMatchSheet';
import { transferMatchCandidates } from './transferMatch';
import { rowIndicators } from './panelConnected';
import { FiltersSheet } from './FiltersSheet';
import { TransactionPanel } from './TransactionPanel';
import { RefundSheet } from './RefundSheet';
import {
  applyFilters,
  clearFilterParams,
  countActive,
  emptyFilters,
  filterChips,
  filtersFromParams,
  filtersToParams,
  removeChip,
  type TxFilters,
} from './filters';
import { ledgerMessage, rowsFor, today, type Row } from './helpers';
import { deleteSavedView, getSavedView, listSavedViews, renameSavedView, saveView, type SavedView } from './savedViews';
import { parseTags, withTags } from './tags';
import { purchaseCost, refundedSoFar } from '@/ledger';

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

export { matchesSearch as matches };

export function TransactionsScreen() {
  const { repo, snapshot } = useWorkspace();
  const add = useAddTransaction();
  const toast = useToast();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [views, setViews] = useState<SavedView[]>(() => listSavedViews());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useGlobalSearchParams<{
    tx?: string;
    txn?: string;
    transfers?: string;
    refund?: string;
    export?: string;
    receipt?: string;
    view?: string;
    from?: string;
    to?: string;
    account?: string;
    category?: string;
    payee?: string;
    tag?: string;
    type?: string;
    status?: string;
    min?: string;
    max?: string;
    uncategorized?: string;
    hasReceipt?: string;
    edited?: string;
  }>();

  const panelId = params.txn ?? params.tx;
  const filters = useMemo(() => filtersFromParams(params as Record<string, string | undefined>), [params]);
  const exportOpen = params.export === '1';
  const transferMatchOpen = params.transfers === '1';
  const activeViewId = params.view;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        const el = document.querySelector('[data-testid="tx-search"]') as HTMLElement | null;
        el?.focus?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!activeViewId) return;
    const view = getSavedView(activeViewId);
    if (!view) return;
    router.setParams({ ...clearFilterParams(), ...filtersToParams(view.filters), view: activeViewId });
  }, [activeViewId]); // eslint-disable-line react-hooks/exhaustive-deps -- apply saved view once when view id changes

  const setFilters = useCallback(
    (next: TxFilters) => {
      router.setParams({ ...clearFilterParams(), ...filtersToParams(next), view: undefined });
    },
    [router],
  );

  const transferMatches = useMemo(() => (snapshot ? transferMatchCandidates(snapshot).length : 0), [snapshot]);

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

  const openPanel = (id: string) => router.setParams({ tx: id, txn: id });

  const refundEvent = snapshot && params.refund ? snapshot.events.find((e) => e.id === params.refund) : undefined;
  const refundLeft =
    refundEvent && snapshot && refundEvent.type === 'expense'
      ? purchaseCost(snapshot.chart, refundEvent) - refundedSoFar(refundEvent, snapshot.events)
      : 0n;
  const refundAmount =
    refundEvent && snapshot
      ? refundEvent.lines
          .filter((l) => snapshot.accounts.some((a) => a.id === l.ledgerAccountId))
          .reduce((s, l) => s + l.amountMinor, 0n)
      : 0n;

  const runBulk = async (field: BulkField, value?: string) => {
    setError(null);
    const ids = [...selected];
    const before = snapshot ? snapshot.events.filter((e) => ids.includes(e.id)).map((e) => structuredClone(e)) : [];
    let skipped = 0;
    if (field === 'delete') {
      const r = await repo.bulkDelete(ids, today());
      if (!r.ok) setError(ledgerMessage(r.error));
      else {
        toast.show(t('tx.bulk.changed', { count: ids.length }), async () => {
          for (const e of before) await repo.restore(e);
        });
      }
    } else if (field === 'category' && value) {
      const r = await repo.bulkSetCategory(ids, value);
      if (!r.ok) setError(ledgerMessage(r.error));
      else {
        skipped = r.value.skippedReconciled;
        toast.show(t('tx.bulk.changed', { count: ids.length - skipped }), async () => {
          for (const e of before) await repo.restore(e);
        });
      }
    } else if (field === 'payee' && value) {
      const r = await repo.bulkSetPayee(ids, value);
      if (!r.ok) setError(ledgerMessage(r.error));
      else {
        skipped = r.value.skippedReconciled;
        toast.show(t('tx.bulk.changed', { count: ids.length - skipped }), async () => {
          for (const e of before) {
            if (e.payeeId) await repo.setEventPayee(e.id, e.payeeId);
          }
        });
      }
    } else if (field === 'account' && value) {
      const r = await bulkSetAccount(repo, ids, value);
      if (!r.ok) setError(ledgerMessage(r.error as import('@/ledger').LedgerErrorCode));
      else {
        skipped = r.value.skippedReconciled;
        toast.show(t('tx.bulk.changed', { count: ids.length - skipped }), async () => {
          for (const e of before) await repo.restore(e);
        });
      }
    } else if ((field === 'tagAdd' || field === 'tagRemove') && value) {
      for (const id of ids) {
        const ev = snapshot?.events.find((e) => e.id === id);
        if (!ev || ev.reconciledBy) {
          if (ev?.reconciledBy) skipped += 1;
          continue;
        }
        const tags = parseTags(ev.notes);
        const next = field === 'tagAdd' ? [...new Set([...tags, value])] : tags.filter((x) => x !== value);
        await repo.updateNotes(id, withTags(ev.notes, next) ?? '');
      }
      toast.show(t('tx.bulk.changed', { count: ids.length - skipped }));
    }
    if (skipped > 0) toast.show(t('tx.bulk.skippedReconciled', { count: skipped }));
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
        <Button testID="tx-import" kind="secondary" label={t('tx.import')} onPress={() => setImportOpen(true)} />
        <Button testID="tx-select" kind="secondary" label={t('tx.select')} onPress={() => setSelectMode((v) => !v)} />
        <Button testID="tx-export" kind="secondary" label={t('tx.export')} onPress={() => router.setParams({ export: '1' })} />
        <Button testID="tx-transfer-match" kind="secondary" label={t('tx.transferMatch')} onPress={() => router.setParams({ transfers: '1' })} />
        <Button testID="tx-add" label={t('tx.add')} onPress={() => add.open('expense')} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-md'], alignItems: 'center' }}>
        <PillTag
          testID="tx-view-all"
          label={t('tx.viewAll')}
          selected={!activeViewId}
          onPress={() => router.setParams({ view: undefined })}
        />
        {views.map((v) => (
          <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <PillTag
              testID={`tx-view-${v.id}`}
              label={v.name}
              selected={activeViewId === v.id}
              onPress={() => router.setParams({ view: v.id, ...clearFilterParams(), ...filtersToParams(v.filters) })}
            />
            <Menu
              testID={`tx-view-menu-${v.id}`}
              trigger={(open) => (
                <Pressable accessibilityRole="button" accessibilityLabel={t('tx.viewMenu')} onPress={open}>
                  <Icon icon={MoreHorizontal} size={14} color={theme.textSecondary} />
                </Pressable>
              )}
              items={[
                {
                  key: 'rename',
                  label: t('tx.viewRename'),
                  onPress: () => {
                    const name = typeof globalThis.prompt === 'function' ? globalThis.prompt(t('tx.viewRename'), v.name) : v.name;
                    if (name?.trim()) {
                      renameSavedView(v.id, name.trim());
                      setViews(listSavedViews());
                    }
                  },
                },
                {
                  key: 'delete',
                  label: t('tx.viewDelete'),
                  onPress: () => {
                    deleteSavedView(v.id);
                    setViews(listSavedViews());
                    if (activeViewId === v.id) router.setParams({ view: undefined });
                  },
                },
              ]}
            />
          </View>
        ))}
        {activeFilterCount > 0 ? (
          <Button kind="link" testID="tx-save-view" label={t('tx.saveAsView')} onPress={() => setSaveViewOpen(true)} />
        ) : null}
      </View>

      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-xs'], marginBottom: sp['spacing-md'], alignItems: 'center' }}>
          {chips.map((chip) => (
            <Pressable
              key={chip.key}
              testID={`tx-chip-${chip.key}`}
              accessibilityRole="button"
              accessibilityLabel={t('common.dismissChip')}
              onPress={() => setFilters(removeChip(filters, chip.key))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <PillTag label={chip.label} />
              <Icon icon={X} size={12} color={theme.textSecondary} />
            </Pressable>
          ))}
          {chips.length >= 2 ? (
            <Button kind="link" testID="tx-clear-filters" label={t('tx.filter.clear')} onPress={() => setFilters(emptyFilters())} />
          ) : null}
        </View>
      ) : null}
      {selectMode && selected.size > 0 ? (
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], flexWrap: 'wrap' }}>
          <Text>{t('tx.selected', { count: selected.size })}</Text>
          <Button testID="tx-bulk" label={t('tx.bulk.edit')} onPress={() => setBulkOpen(true)} />
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      {transferMatches > 0 ? (
        <Pressable testID="tx-transfer-banner" accessibilityRole="button" onPress={() => router.setParams({ transfers: '1' })} style={{ marginBottom: sp['spacing-md'] }}>
          <Card style={{ padding: sp['spacing-md'] }}>
            <Text>{t('tx.transferBanner', { count: transferMatches })}</Text>
          </Card>
        </Pressable>
      ) : null}
      {!snapshot ? (
        <View style={{ gap: sp['spacing-md'] }}>
          <Placeholder height={20} />
          <Placeholder height={56} />
          <Placeholder height={56} />
        </View>
      ) : days.length === 0 && !query && activeFilterCount === 0 ? (
        <EmptyState title={t('tx.emptyTitle')} body={t('tx.emptyBody')} actionLabel={t('tx.add')} onAction={() => add.open('expense')} />
      ) : days.length === 0 ? (
        <View testID="tx-no-matches">
          <EmptyState title={t('tx.noMatches')} body={t('tx.noMatchesBody')} actionLabel={t('tx.filter.clear')} onAction={() => setFilters(emptyFilters())} />
        </View>
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
                      onPress={() => (selectMode ? toggleSelect(row.event.id) : openPanel(row.event.id))}
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
                      {rowIndicators(row.event).length > 0 ? (
                        <Text variant="micro" tone="textSecondary" testID={`tx-marks-${row.event.id}`}>
                          {rowIndicators(row.event)
                            .map((m) => t(`tx.mark.${m}` as 'tx.mark.split'))
                            .join(' · ')}
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
                          { key: 'open', label: t('panel.title'), onPress: () => openPanel(row.event.id) },
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
      {panelId ? <TransactionPanel id={panelId} onClose={() => router.setParams({ tx: undefined, txn: undefined, receipt: undefined })} /> : null}
      {filtersOpen && snapshot ? (
        <FiltersSheet
          snapshot={snapshot}
          filters={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={(f) => {
            setFilters(f);
            setFiltersOpen(false);
          }}
        />
      ) : null}
      {bulkOpen && snapshot ? (
        <BulkEditSheet snapshot={snapshot} count={selected.size} onClose={() => setBulkOpen(false)} onApply={runBulk} />
      ) : null}
      {exportOpen && snapshot ? <ExportTransactionsSheet snapshot={snapshot} onClose={() => router.setParams({ export: undefined })} /> : null}
      {transferMatchOpen && snapshot ? <TransferMatchSheet snapshot={snapshot} onClose={() => router.setParams({ transfers: undefined })} /> : null}
      {importOpen ? <ImportHintSheet onClose={() => setImportOpen(false)} /> : null}
      {refundEvent && snapshot ? (
        <RefundSheet
          event={refundEvent}
          purchaseAmount={refundAmount}
          left={refundLeft}
          onClose={() => router.setParams({ refund: undefined })}
        />
      ) : null}
      {saveViewOpen ? (
        <SaveViewPrompt
          name={saveViewName}
          onChange={setSaveViewName}
          onClose={() => setSaveViewOpen(false)}
          onSave={() => {
            if (!saveViewName.trim()) return;
            const view = saveView(saveViewName.trim(), filters);
            setViews(listSavedViews());
            setSaveViewOpen(false);
            setSaveViewName('');
            router.setParams({ view: view.id });
            toast.show(t('tx.viewSaved'));
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function SaveViewPrompt({
  name,
  onChange,
  onClose,
  onSave,
}: {
  name: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Sheet visible testID="tx-save-view-sheet" title={t('tx.saveAsView')} onClose={onClose} footer={<Button testID="tx-save-view-confirm" label={t('tx.saveView')} disabled={!name.trim()} onPress={onSave} />}>
      <TextInput testID="tx-save-view-name" label={t('tx.viewName')} value={name} onChangeText={onChange} />
    </Sheet>
  );
}

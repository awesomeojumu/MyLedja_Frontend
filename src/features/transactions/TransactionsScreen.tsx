import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, Platform } from 'react-native';
import { MoreHorizontal, X } from 'lucide-react-native';

import {
  Amount,
  AmountInput,
  Banner,
  Button,
  Card,
  Checkbox,
  DatePicker,
  EmptyState,
  formatDay,
  Icon,
  InlineError,
  Menu,
  PillTag,
  Placeholder,
  Select,
  StatusPill,
  Sheet,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { aiApi } from '@/api/ai';
import { AppFrame } from '@/features/frame/AppFrame';
import { ruleFromPayee } from '@/features/rules/helpers';
import { SyncIssuesSheet, useSyncIssues } from '@/features/sync/SyncIssues';
import { t } from '@/i18n';
import { useOnline } from '@/lib/useOnline';
import { formatNaira } from '@/money';

import { useGlobalSearchParams, useRouter } from 'expo-router';

import { useAddTransaction } from './AddTransaction';
import { BulkEditSheet, type BulkField } from './BulkEditSheet';
import { bulkSetAccount } from './bulkActions';
import { ExportTransactionsSheet } from './ExportTransactionsSheet';
import { ImportHintSheet } from './ImportHintSheet';
import { TransferMatchSheet } from './TransferMatchSheet';
import { transferMatchCandidates } from './transferMatch';
import { markGlyph, rowIndicators } from './panelConnected';
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
import { ledgerMessage, matchesSearch, rowsFor, today, type Row } from './helpers';
import {
  deleteSavedView,
  getSavedView,
  listSavedViews,
  renameSavedView,
  saveView,
  subscribeSavedViews,
} from './savedViews';
import { SwipeRow } from './SwipeRow';
import { parseTags, withTags } from './tags';
import { purchaseCost, refundedSoFar } from '@/ledger';
import { isRedesignEnabled } from '@/design/redesign';
import { RedesignTransactionsScreen } from './RedesignTransactionsScreen';

const sp = tokens.spacing;

export { matchesSearch, matchesSearch as matches } from './helpers';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as HTMLElement;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable;
}

export function TransactionsScreen() {
  if (isRedesignEnabled()) return <RedesignTransactionsScreen />;
  return <LegacyTransactionsScreen />;
}

function LegacyTransactionsScreen() {
  const { repo, snapshot } = useWorkspace();
  const { client, user } = useAuth();
  const online = useOnline();
  const add = useAddTransaction();
  const toast = useToast();
  const theme = useTheme();
  const syncIssues = useSyncIssues();
  const bank = useMemo(() => aiApi(client), [client]);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkField>('category');
  const [importOpen, setImportOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const workspaceId = snapshot?.workspaceId ?? user?.workspaceId;
  const [viewsTick, setViewsTick] = useState(0);
  const views = useMemo(() => {
    void viewsTick;
    return listSavedViews(workspaceId);
  }, [workspaceId, viewsTick]);
  const refreshViews = useCallback(() => setViewsTick((n) => n + 1), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [bankPending, setBankPending] = useState(0);
  const lastClickedId = useRef<string | null>(null);
  const filteredRowsRef = useRef<Row[]>([]);
  const focusIndexRef = useRef(0);
  const openBulk = useCallback((field: BulkField) => {
    setBulkField(field);
    setBulkOpen(true);
  }, []);
  const router = useRouter();
  const params = useGlobalSearchParams<{
    tx?: string;
    txn?: string;
    transfers?: string;
    refund?: string;
    export?: string;
    receipt?: string;
    edit?: string;
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

  useEffect(() => subscribeSavedViews(workspaceId, refreshViews), [workspaceId, refreshViews]);

  useEffect(() => {
    if (!online || !user) return;
    bank.pendingImports(user.workspaceId).then(
      (r) => setBankPending(r.imports.filter((i) => i.source === 'bank').length),
      () => setBankPending(0),
    );
  }, [bank, online, user, snapshot?.waiting.size]);

  useEffect(() => {
    if (!activeViewId) return;
    const view = getSavedView(activeViewId, workspaceId);
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
  const waitingCount = snapshot?.waiting.size ?? 0;

  const filteredRows = useMemo(() => {
    if (!snapshot) return [];
    return rowsFor(snapshot).filter((r) => matchesSearch(r, query) && applyFilters(r, filters, snapshot));
  }, [snapshot, query, filters]);

  const safeFocusIndex = filteredRows.length === 0 ? 0 : Math.min(focusIndex, filteredRows.length - 1);

  useEffect(() => {
    filteredRowsRef.current = filteredRows;
    focusIndexRef.current = safeFocusIndex;
  }, [filteredRows, safeFocusIndex]);

  const openPanel = useCallback((id: string) => router.setParams({ tx: id, txn: id }), [router]);

  const remove = useCallback(
    async (row: Row) => {
      setError(null);
      const result = await repo.deleteTransaction(row.event.id, today());
      if (!result.ok) {
        setError(ledgerMessage(result.error));
        return;
      }
      toast.show(t('tx.deleted'), () => void repo.restore(row.event));
    },
    [repo, toast],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        const el = document.querySelector('[data-testid="tx-search"]') as HTMLElement | null;
        el?.focus?.();
        return;
      }
      if (!filteredRowsRef.current.length) return;
      const rows = filteredRowsRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = rows[focusIndexRef.current];
        if (row) openPanel(row.event.id);
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const row = rows[focusIndexRef.current];
        if (row) router.setParams({ tx: row.event.id, txn: row.event.id, edit: '1' });
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const row = rows[focusIndexRef.current];
        if (row) {
          setSelectMode(true);
          setSelected(new Set([row.event.id]));
          openBulk('category');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const row = rows[focusIndexRef.current];
        if (row) void remove(row);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel, openBulk, remove, router]);

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

  const selectRange = (toId: string) => {
    const fromId = lastClickedId.current;
    if (!fromId) {
      toggleSelect(toId);
      lastClickedId.current = toId;
      return;
    }
    const ids = filteredRows.map((r) => r.event.id);
    const a = ids.indexOf(fromId);
    const b = ids.indexOf(toId);
    if (a < 0 || b < 0) {
      toggleSelect(toId);
      lastClickedId.current = toId;
      return;
    }
    const [lo, hi] = a < b ? [a, b] : [b, a];
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = lo; i <= hi; i++) next.add(ids[i]!);
      return next;
    });
    lastClickedId.current = toId;
  };

  const onRowPress = (id: string, shiftKey: boolean) => {
    if (shiftKey) {
      if (!selectMode) setSelectMode(true);
      selectRange(id);
      return;
    }
    if (selectMode) {
      toggleSelect(id);
      lastClickedId.current = id;
      return;
    }
    openPanel(id);
  };

  const createRuleFromSelected = async () => {
    if (!snapshot) return;
    const firstId = [...selected][0];
    const event = snapshot.events.find((e) => e.id === firstId);
    if (!event?.payeeId) {
      toast.show(t('tx.float.ruleNeedPayee'));
      return;
    }
    const payee = snapshot.payees.find((p) => p.id === event.payeeId);
    if (!payee) return;
    const accountIds = new Set(snapshot.accounts.map((a) => a.id));
    const categoryId = event.lines.find((l) => !accountIds.has(l.ledgerAccountId))?.ledgerAccountId;
    const draft = ruleFromPayee(payee.name, categoryId);
    const rule = await repo.createRule({ ...draft, order: snapshot.rules.length });
    setSelected(new Set());
    setSelectMode(false);
    router.push(`/rules?edit=${rule.id}`);
  };

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
                      renameSavedView(v.id, name.trim(), workspaceId);
                      refreshViews();
                    }
                  },
                },
                {
                  key: 'delete',
                  label: t('tx.viewDelete'),
                  onPress: () => {
                    deleteSavedView(v.id, workspaceId);
                    refreshViews();
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

      {syncIssues.count > 0 ? (
        <Pressable
          testID="tx-sync-issues-banner"
          accessibilityRole="button"
          onPress={() => syncIssues.setOpen(true)}
          style={{ marginBottom: sp['spacing-md'] }}
        >
          <Banner message={t('sync.issuesBanner', { count: syncIssues.count })} />
        </Pressable>
      ) : null}
      {waitingCount > 0 ? (
        <View testID="tx-waiting-banner" style={{ marginBottom: sp['spacing-md'] }}>
          <Banner message={t('tx.waitingBanner', { count: waitingCount })} />
        </View>
      ) : null}
      {bankPending > 0 ? (
        <Pressable
          testID="tx-bank-pending-banner"
          accessibilityRole="button"
          onPress={() => router.push('/accounts')}
          style={{ marginBottom: sp['spacing-md'] }}
        >
          <Banner message={t('tx.bankPendingBanner', { count: bankPending })} />
        </Pressable>
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
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'], paddingBottom: selectMode && selected.size > 0 ? 88 : 0 }}>
          {Platform.OS === 'web' ? <QuickAddRow /> : null}
          {days.map((day) => (
            <View key={day.date} testID={`day-${day.date}`} style={{ gap: sp['spacing-xs'] }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="caption" tone="textSecondary" accessibilityRole="header">
                  {formatDay(day.date)}
                </Text>
                <Amount minor={day.net} variant="caption" signed />
              </View>
              <Card style={{ padding: 0 }}>
                {day.rows.map((row, i) => {
                  const flatIndex = filteredRows.findIndex((r) => r.event.id === row.event.id);
                  const focused = flatIndex === safeFocusIndex;
                  const marks = rowIndicators(row.event, row.waiting);
                  const categorizeRow = () => {
                    setSelectMode(true);
                    setSelected(new Set([row.event.id]));
                    openBulk('category');
                  };
                  return (
                    <SwipeRow
                      key={row.event.id}
                      testID={`tx-swipe-${row.event.id}`}
                      enabled={!selectMode}
                      onDelete={() => void remove(row)}
                      onCategorize={categorizeRow}
                    >
                      <View
                        testID={`tx-${row.event.id}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: sp['spacing-md'],
                          padding: sp['spacing-md'],
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: theme.border,
                          backgroundColor: focused ? theme.tagFill : theme.card,
                        }}
                      >
                        {selectMode ? (
                          <Checkbox testID={`select-${row.event.id}`} checked={selected.has(row.event.id)} onChange={() => toggleSelect(row.event.id)} label="" />
                        ) : null}
                        <Pressable
                          testID={`open-${row.event.id}`}
                          accessibilityRole="button"
                          accessibilityActions={[
                            { name: 'delete', label: t('tx.delete') },
                            { name: 'categorize', label: t('tx.float.categorize') },
                          ]}
                          onAccessibilityAction={(e) => {
                            if (e.nativeEvent.actionName === 'delete') void remove(row);
                            if (e.nativeEvent.actionName === 'categorize') categorizeRow();
                          }}
                          onLongPress={() => {
                            setSelectMode(true);
                            toggleSelect(row.event.id);
                            lastClickedId.current = row.event.id;
                          }}
                          onPress={(e) => {
                            const native = e.nativeEvent as { shiftKey?: boolean };
                            onRowPress(row.event.id, !!native.shiftKey);
                          }}
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
                          {marks.length > 0 ? (
                            <Text
                              variant="micro"
                              tone="textSecondary"
                              testID={`tx-marks-${row.event.id}`}
                              accessibilityLabel={marks.map((m) => t(`tx.mark.${m}` as 'tx.mark.split')).join(', ')}
                            >
                              {marks.map(markGlyph).join('')}
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
                              {
                                key: 'categorize',
                                label: t('tx.float.categorize'),
                                onPress: categorizeRow,
                              },
                              { key: 'delete', label: t('tx.delete'), onPress: () => void remove(row) },
                            ]}
                          />
                        ) : null}
                      </View>
                    </SwipeRow>
                  );
                })}
              </Card>
            </View>
          ))}
        </ScrollView>
      )}

      {selectMode && selected.size > 0 ? (
        <View
          testID="tx-float-bar"
          style={{
            position: 'absolute',
            left: sp['spacing-lg'],
            right: sp['spacing-lg'],
            bottom: sp['spacing-lg'],
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: sp['spacing-sm'],
            padding: sp['spacing-md'],
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: tokens.radius['rounded-lg'],
            alignItems: 'center',
          }}
        >
          <Text>{t('tx.selected', { count: selected.size })}</Text>
          <Button testID="tx-float-categorize" kind="secondary" label={t('tx.float.categorize')} onPress={() => openBulk('category')} />
          <Button testID="tx-float-payee" kind="secondary" label={t('tx.float.payee')} onPress={() => openBulk('payee')} />
          <Button testID="tx-float-tag" kind="secondary" label={t('tx.float.tag')} onPress={() => openBulk('tagAdd')} />
          <Button testID="tx-float-account" kind="secondary" label={t('tx.float.account')} onPress={() => openBulk('account')} />
          <Button testID="tx-float-rule" kind="secondary" label={t('tx.float.createRule')} onPress={() => void createRuleFromSelected()} />
          <Button testID="tx-float-delete" kind="secondary" label={t('tx.delete')} onPress={() => openBulk('delete')} />
        </View>
      ) : null}

      {panelId ? <TransactionPanel id={panelId} onClose={() => router.setParams({ tx: undefined, txn: undefined, receipt: undefined, edit: undefined })} /> : null}
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
        <BulkEditSheet
          key={bulkField}
          snapshot={snapshot}
          count={selected.size}
          initialField={bulkField}
          onClose={() => setBulkOpen(false)}
          onApply={runBulk}
        />
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
            const view = saveView(saveViewName.trim(), filters, workspaceId);
            refreshViews();
            setSaveViewOpen(false);
            setSaveViewName('');
            router.setParams({ view: view.id });
            toast.show(t('tx.viewSaved'));
          }}
        />
      ) : null}
      {syncIssues.open ? (
        <SyncIssuesSheet
          rejected={syncIssues.rejected}
          conflicts={syncIssues.conflicts}
          onClose={() => syncIssues.setOpen(false)}
          onDiscard={async (operationId) => {
            await syncIssues.engine.discard(operationId);
          }}
          onDismissConflict={async (operationId) => {
            await syncIssues.store.dismissConflict(operationId);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

function QuickAddRow() {
  const { repo, snapshot } = useWorkspace();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [payee, setPayee] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);

  const accounts = (snapshot?.accounts.filter((a) => !a.archived) ?? []).map((a) => ({ value: a.id, label: a.name }));
  const categories = (snapshot?.categories.filter((c) => c.kind === 'expense') ?? []).map((c) => ({ value: c.id, label: c.name }));
  const effectiveAccountId = accountId ?? accounts[0]?.value ?? null;

  const save = async () => {
    if (!effectiveAccountId || !categoryId || amountMinor === null || amountMinor <= 0n) return;
    const r = await repo.addTransaction({
      kind: 'expense',
      accountId: effectiveAccountId,
      date,
      payeeName: payee.trim() || undefined,
      parts: [{ categoryId, amount: amountMinor }],
    });
    if (!r.ok) {
      toast.show(ledgerMessage(r.error));
      return;
    }
    toast.show(t('add.saved'), () => void repo.deleteTransaction(r.value.id, r.value.date));
    setPayee('');
    setAmountText('');
    setAmountMinor(null);
  };

  return (
    <View
      testID="tx-quick-add"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'flex-end', marginBottom: sp['spacing-md'] }}
    >
      <View style={{ minWidth: 140 }}>
        <DatePicker testID="tx-quick-date" label={t('add.date')} value={date} onChange={setDate} />
      </View>
      <View style={{ flex: 1, minWidth: 120 }}>
        <TextInput testID="tx-quick-payee" label={t('add.payee')} value={payee} onChangeText={setPayee} onSubmitEditing={() => void save()} />
      </View>
      <View style={{ minWidth: 140 }}>
        <Select testID="tx-quick-category" label={t('add.category')} options={categories} value={categoryId} onChange={setCategoryId} />
      </View>
      <View style={{ minWidth: 140 }}>
        <Select testID="tx-quick-account" label={t('add.account')} options={accounts} value={effectiveAccountId} onChange={setAccountId} />
      </View>
      <View style={{ minWidth: 120 }}>
        <AmountInput
          testID="tx-quick-amount"
          label={t('add.amount')}
          value={amountText}
          onChange={(v, m) => {
            setAmountText(v);
            setAmountMinor(m);
          }}
        />
      </View>
      <Button
        testID="tx-quick-save"
        label={t('common.save')}
        disabled={!effectiveAccountId || !categoryId || amountMinor === null || amountMinor <= 0n}
        onPress={() => void save()}
      />
    </View>
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

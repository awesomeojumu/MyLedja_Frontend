import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import { aiApi } from '@/api/ai';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignBanner,
  RedesignButton,
  RedesignChip,
  RedesignEmpty,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignSheet,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useSizeClass } from '@/design/size';
import { useDesign } from '@/design/ThemeProvider';
import { useAuth } from '@/features/auth/AuthProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ruleFromPayee } from '@/features/rules/helpers';
import { SyncIssuesSheet, useSyncIssues } from '@/features/sync/SyncIssues';
import { t } from '@/i18n';
import { purchaseCost, refundedSoFar } from '@/ledger';
import { useOnline } from '@/lib/useOnline';
import { formatNaira } from '@/money';

import { useAddTransaction } from './AddTransaction';
import { BulkEditSheet, type BulkField } from './BulkEditSheet';
import { bulkSetAccount } from './bulkActions';
import { formatTxDayHeader } from './dayHeader';
import { ExportTransactionsSheet } from './ExportTransactionsSheet';
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
import { FiltersSheet } from './FiltersSheet';
import { ImportHintSheet } from './ImportHintSheet';
import { ledgerMessage, matchesSearch, rowsFor, today, type Row } from './helpers';
import { filtersForPeriod, periodFromFilters, type PeriodChip } from './periodPresets';
import { RefundSheet } from './RefundSheet';
import { getSavedView, listSavedViews, saveView, subscribeSavedViews } from './savedViews';
import { SwipeRow } from './SwipeRow';
import { parseTags, withTags } from './tags';
import { TransactionPanel } from './TransactionPanel';
import { TransferMatchSheet } from './TransferMatchSheet';
import { transferMatchCandidates } from './transferMatch';

const sp = tokens.space;
const density = tokens.density.touch;
const PERIODS: { key: PeriodChip; labelKey: 'tx.filter.presetThisMonth' | 'tx.filter.presetLast3Months' | 'tx.filter.presetThisYear' | 'tx.redesign.periodAll' }[] = [
  { key: 'thisMonth', labelKey: 'tx.filter.presetThisMonth' },
  { key: 'last3Months', labelKey: 'tx.filter.presetLast3Months' },
  { key: 'thisYear', labelKey: 'tx.filter.presetThisYear' },
  { key: 'all', labelKey: 'tx.redesign.periodAll' },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as HTMLElement;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable;
}

function amountSign(row: Row): '+' | '−' | null {
  if (row.event.type === 'transfer') return null;
  return row.amount < 0n ? '−' : row.amount > 0n ? '+' : null;
}

const PRIVACY_MASK = '₦ ••••••';

function amountText(row: Row, hidden: boolean): string {
  if (hidden) return PRIVACY_MASK;
  const mag = row.amount < 0n ? -row.amount : row.amount;
  return formatNaira(mag).replace(/^₦/, '₦');
}

/** Figma phone rows: `{Category|Not sorted}, {Account}` (Mobile 2:1549). */
function rowSubtitle(row: Row): string {
  const category = row.category || t('tx.redesign.notSorted');
  return row.account ? `${category}, ${row.account}` : category;
}

/**
 * Page 11 redesign — Figma Mobile `2:1549` (+ search/filter/empty/states) and Dashboard web `31:937`.
 * Specs win on flows/API; Figma on layout. Flagged behind EXPO_PUBLIC_REDESIGN.
 */
export function RedesignTransactionsScreen() {
  const { repo, snapshot } = useWorkspace();
  const { client, user } = useAuth();
  const online = useOnline();
  const add = useAddTransaction();
  const toast = useToast();
  const { privacy } = useDesign();
  const syncIssues = useSyncIssues();
  const size = useSizeClass();
  const phone = size === 'phone';
  const webTable = size === 'desktop' || size === 'wide' || (size === 'tablet' && !phone);
  const bank = useMemo(() => aiApi(client), [client]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkField, setBulkField] = useState<BulkField>('category');
  const [importOpen, setImportOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [bankPending, setBankPending] = useState(0);
  const [visibleDays, setVisibleDays] = useState(14);
  const lastClickedId = useRef<string | null>(null);
  const filteredRowsRef = useRef<Row[]>([]);
  const focusIndexRef = useRef(0);
  const workspaceId = snapshot?.workspaceId ?? user?.workspaceId;
  const [viewsTick, setViewsTick] = useState(0);
  const views = useMemo(() => {
    void viewsTick;
    return listSavedViews(workspaceId);
  }, [workspaceId, viewsTick]);
  const refreshViews = useCallback(() => setViewsTick((n) => n + 1), []);
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
  const dayIso = today();
  const period = periodFromFilters(filters, dayIso);

  // Default period chip: This month (Figma 2:1549) when URL has no date range.
  useEffect(() => {
    if (params.from || params.to || params.view) return;
    const next = filtersForPeriod('thisMonth', dayIso, emptyFilters());
    router.setParams({ ...clearFilterParams(), ...filtersToParams(next) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount for redesign default
  }, []);

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
  }, [activeViewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilters = useCallback(
    (next: TxFilters) => {
      router.setParams({ ...clearFilterParams(), ...filtersToParams(next), view: undefined });
    },
    [router],
  );

  const setPeriod = (chip: PeriodChip) => {
    setFilters(filtersForPeriod(chip, dayIso, filters));
  };

  const transferMatches = useMemo(() => (snapshot ? transferMatchCandidates(snapshot).length : 0), [snapshot]);
  const waitingCount = snapshot?.waiting.size ?? 0;

  const uncategorizedCount = useMemo(() => {
    if (!snapshot) return 0;
    return rowsFor(snapshot).filter((r) => applyFilters(r, { uncategorized: true }, snapshot)).length;
  }, [snapshot]);

  const filteredRows = useMemo(() => {
    if (!snapshot) return [];
    // Figma empty / list omit opening-balance bookkeeping rows.
    return rowsFor(snapshot).filter(
      (r) => r.event.type !== 'opening_balance' && matchesSearch(r, query) && applyFilters(r, filters, snapshot),
    );
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
        if (phone) setSearchOpen(true);
        else {
          const el = document.querySelector('[data-testid="tx-search"]') as HTMLElement | null;
          el?.focus?.();
        }
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
  }, [openPanel, openBulk, remove, router, phone]);

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

  const shownDays = days.slice(0, visibleDays);
  const chips = snapshot ? filterChips(filters, snapshot) : [];
  const activeFilterCount = countActive(filters);

  const monthRange = filtersForPeriod('thisMonth', dayIso, {});
  const monthRows = snapshot
    ? rowsFor(snapshot).filter((r) => applyFilters(r, monthRange, snapshot) && r.event.type !== 'opening_balance')
    : [];
  const monthOut = monthRows.filter((r) => r.amount < 0n && r.event.type !== 'transfer').reduce((s, r) => s + r.amount, 0n);
  const monthCount = monthRows.length;

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

  const sortUncategorized = () => {
    setFilters({ ...filters, uncategorized: true });
  };

  const topTrailing = phone ? (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        testID="tx-search-btn"
        accessibilityRole="button"
        accessibilityLabel={t('tx.search')}
        onPress={() => setSearchOpen(true)}
        style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <RedesignIcon name="search" size={tokens.size['icon-lg']} color={theme.text} />
      </Pressable>
      <Pressable
        testID="tx-filters"
        accessibilityRole="button"
        accessibilityLabel={activeFilterCount > 0 ? t('tx.filtersCount', { count: activeFilterCount }) : t('tx.redesign.filterTitle')}
        onPress={() => setFiltersOpen(true)}
        style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <RedesignIcon name="filter" size={tokens.size['icon-lg']} color={theme.text} />
      </Pressable>
    </View>
  ) : undefined;

  if (phone && searchOpen) {
    return (
      <AppFrame
        title={t('tx.search')}
        offlineMessage={t('tx.redesign.offline')}
        trailing={
          <Pressable
            testID="tx-search-back"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => {
              setSearchOpen(false);
              setQuery('');
            }}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="arrow-left" size={tokens.size['icon-lg']} color={theme.text} />
          </Pressable>
        }
      >
        <View testID="redesign-tx-search" style={{ gap: sp.lg, flex: 1 }}>
          <RedesignField
            testID="tx-search"
            label={t('tx.search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('tx.redesign.searchPlaceholder')}
            autoFocus
          />
          <RedesignText variant="label" tone="textSecondary">
            {t('tx.redesign.results', { count: filteredRows.length })}
          </RedesignText>
          <ScrollView contentContainerStyle={{ gap: sp.xs }}>
            {filteredRows.map((row) => (
              <RedesignListRow
                key={row.event.id}
                testID={`tx-${row.event.id}`}
                title={row.title}
                subtitle={rowSubtitle(row)}
                trailing={privacy ? PRIVACY_MASK : formatNaira(row.amount, { signed: row.event.type !== 'transfer' })}
                onPress={() => {
                  setSearchOpen(false);
                  openPanel(row.event.id);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </AppFrame>
    );
  }

  const periodChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp.sm, paddingVertical: sp.xs }}>
      {PERIODS.map((p) => (
        <RedesignChip
          key={p.key}
          testID={`tx-period-${p.key}`}
          label={t(p.labelKey)}
          selected={period === p.key}
          onPress={() => setPeriod(p.key)}
        />
      ))}
    </ScrollView>
  );

  const banners = (
    <View style={{ gap: sp.sm }}>
      {uncategorizedCount > 0 ? (
        <RedesignBanner
          testID="tx-uncategorized-banner"
          message={
            phone
              ? t('tx.redesign.needCategory', { count: uncategorizedCount })
              : t('tx.redesign.needCategoryWeb', { count: uncategorizedCount })
          }
          actionLabel={t('tx.redesign.sortThem')}
          onAction={sortUncategorized}
        />
      ) : null}
      {waitingCount > 0 ? (
        <RedesignBanner testID="tx-waiting-banner" message={t('tx.redesign.waitingBanner', { count: waitingCount })} />
      ) : null}
      {bankPending > 0 ? (
        <Pressable testID="tx-bank-pending-banner" accessibilityRole="button" onPress={() => router.push('/accounts')}>
          <RedesignBanner message={t('tx.bankPendingBanner', { count: bankPending })} />
        </Pressable>
      ) : null}
      {transferMatches > 0 ? (
        <Pressable testID="tx-transfer-banner" accessibilityRole="button" onPress={() => router.setParams({ transfers: '1' })}>
          <RedesignBanner message={t('tx.transferBanner', { count: transferMatches })} actionLabel={t('common.review')} onAction={() => router.setParams({ transfers: '1' })} />
        </Pressable>
      ) : null}
      {syncIssues.count > 0 ? (
        <Pressable testID="tx-sync-issues-banner" accessibilityRole="button" onPress={() => syncIssues.setOpen(true)}>
          <RedesignBanner message={t('sync.issuesBanner', { count: syncIssues.count })} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderPhoneRow = (row: Row) => {
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
        <Pressable
          testID={`tx-${row.event.id}`}
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
        >
          <RedesignListRow
            title={row.title}
            subtitle={rowSubtitle(row)}
            trailing={privacy ? PRIVACY_MASK : formatNaira(row.amount, { signed: row.event.type !== 'transfer' })}
          />
        </Pressable>
      </SwipeRow>
    );
  };

  const renderWebRow = (row: Row) => {
    const flatIndex = filteredRows.findIndex((r) => r.event.id === row.event.id);
    const focused = flatIndex === safeFocusIndex;
    const dateLabel = row.event.date.slice(8) + ' ' + t(`date.month.${Number(row.event.date.slice(5, 7))}` as 'date.month.1');
    return (
      <Pressable
        key={row.event.id}
        testID={`tx-${row.event.id}`}
        accessibilityRole="button"
        onLongPress={() => {
          setSelectMode(true);
          toggleSelect(row.event.id);
          lastClickedId.current = row.event.id;
        }}
        onPress={(e) => {
          const native = e.nativeEvent as { shiftKey?: boolean };
          onRowPress(row.event.id, !!native.shiftKey);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: tokens.size['list-row'],
          paddingVertical: sp.sm,
          paddingHorizontal: sp.md,
          gap: sp.md,
          backgroundColor: focused || selected.has(row.event.id) ? theme.primarySoft : 'transparent',
          borderBottomWidth: 1,
          borderColor: theme.border,
        }}
      >
        {selectMode ? (
          <Pressable
            testID={`select-${row.event.id}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected.has(row.event.id) }}
            onPress={() => toggleSelect(row.event.id)}
            style={{ width: 24, height: 24, borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 4, backgroundColor: selected.has(row.event.id) ? theme.primary : theme.surface }}
          />
        ) : (
          <View style={{ width: 24 }} />
        )}
        <RedesignText variant="helper" style={{ width: 72 }}>
          {dateLabel}
        </RedesignText>
        <RedesignText style={{ flex: 1.4 }} numberOfLines={1}>
          {row.title}
        </RedesignText>
        <RedesignText tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {row.category || t('tx.redesign.notSorted')}
        </RedesignText>
        <RedesignText tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {row.account}
        </RedesignText>
        <View style={{ width: 120, alignItems: 'flex-end' }}>
          {privacy ? (
            <RedesignText variant="body" style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={t('money.privacyLabel')}>
              {PRIVACY_MASK}
            </RedesignText>
          ) : (
            <RedesignAmount text={amountText(row, false)} sign={amountSign(row)} sizeVariant="body" />
          )}
        </View>
      </Pressable>
    );
  };

  const listBody = !snapshot ? (
    <View testID="tx-loading" style={{ gap: sp.md }}>
      <RedesignSkeleton height={20} />
      <RedesignSkeleton height={68} />
      <RedesignSkeleton height={68} />
      <RedesignSkeleton height={68} />
    </View>
  ) : days.length === 0 && !query && !filters.uncategorized && (period === 'thisMonth' || period === 'all') && activeFilterCount <= 1 ? (
      <RedesignEmpty
        title={t('tx.emptyTitle')}
        body={t('tx.redesign.emptyBody')}
        secondaryLabel={t('tx.redesign.importFile')}
        onSecondary={() => setImportOpen(true)}
        actionLabel={t('tx.add')}
        onAction={() => add.open('expense')}
        tertiaryLabel={t('tx.redesign.connectBank')}
        onTertiary={() => router.push('/accounts')}
      />
  ) : days.length === 0 ? (
    <View testID="tx-no-matches">
      <RedesignEmpty title={t('tx.noMatches')} body={t('tx.noMatchesBody')} actionLabel={t('tx.filter.clear')} onAction={() => setFilters(emptyFilters())} />
    </View>
  ) : (
    <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: selectMode && selected.size > 0 ? 96 : sp.xl }}>
      {shownDays.map((day) => (
        <View key={day.date} testID={`day-${day.date}`} style={{ gap: sp.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <RedesignText variant="label" tone="textSecondary" accessibilityRole="header">
              {formatTxDayHeader(day.date)}
            </RedesignText>
            <RedesignAmount
              text={privacy ? PRIVACY_MASK : formatNaira(day.net < 0n ? -day.net : day.net)}
              sign={privacy ? null : day.net < 0n ? '−' : day.net > 0n ? '+' : null}
              hidden={privacy}
              sizeVariant="body"
            />
          </View>
          <View style={{ backgroundColor: theme.surface, borderRadius: tokens.shape['radius-md'], overflow: 'hidden' }}>
            {webTable ? (
              <>
                {day === shownDays[0] ? (
                  <View
                    testID="tx-table-header"
                    style={{ flexDirection: 'row', paddingHorizontal: sp.md, paddingVertical: sp.sm, gap: sp.md, borderBottomWidth: 1, borderColor: theme.border }}
                  >
                    <View style={{ width: 24 }} />
                    <RedesignText variant="label" tone="textSecondary" style={{ width: 72 }}>
                      {t('tx.export.col.date')}
                    </RedesignText>
                    <RedesignText variant="label" tone="textSecondary" style={{ flex: 1.4 }}>
                      {t('tx.export.col.payee')}
                    </RedesignText>
                    <RedesignText variant="label" tone="textSecondary" style={{ flex: 1 }}>
                      {t('tx.export.col.category')}
                    </RedesignText>
                    <RedesignText variant="label" tone="textSecondary" style={{ flex: 1 }}>
                      {t('tx.export.col.account')}
                    </RedesignText>
                    <RedesignText variant="label" tone="textSecondary" style={{ width: 120, textAlign: 'right' }}>
                      {t('tx.export.col.amount')}
                    </RedesignText>
                  </View>
                ) : null}
                {day.rows.map(renderWebRow)}
              </>
            ) : (
              day.rows.map(renderPhoneRow)
            )}
          </View>
        </View>
      ))}
      {days.length > visibleDays ? (
        <RedesignButton testID="tx-show-earlier" kind="secondary" label={t('tx.redesign.showEarlier')} onPress={() => setVisibleDays((n) => n + 14)} />
      ) : null}
    </ScrollView>
  );

  return (
    <AppFrame title={t('tx.title')} trailing={topTrailing} offlineMessage={t('tx.redesign.offline')}>
      <View testID="redesign-transactions" style={{ flex: 1, gap: sp.md }}>
        {!phone ? (
          <View style={{ gap: sp.sm }}>
            <RedesignText variant="helper" tone="textSecondary">
              {t('tx.redesign.summary', {
                count: monthCount,
                out: privacy ? PRIVACY_MASK : formatNaira(monthOut < 0n ? -monthOut : monthOut, { signed: true }),
              })}
            </RedesignText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, alignItems: 'center' }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <RedesignField
                  testID="tx-search"
                  label={t('tx.search')}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('tx.redesign.searchPlaceholder')}
                />
              </View>
              {periodChips}
              <RedesignButton testID="tx-filters" kind="secondary" label={t('tx.redesign.filterTitle')} onPress={() => setFiltersOpen(true)} />
              <RedesignButton testID="tx-import" kind="secondary" label={t('tx.import')} onPress={() => setImportOpen(true)} />
              <RedesignButton testID="tx-select" kind="secondary" label={t('tx.select')} onPress={() => setSelectMode((v) => !v)} />
              <RedesignButton testID="tx-export" kind="secondary" label={t('tx.export')} onPress={() => router.setParams({ export: '1' })} />
              <RedesignButton testID="tx-add" label={t('tx.add')} onPress={() => add.open('expense')} />
            </View>
          </View>
        ) : (
          periodChips
        )}

        {chips.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, alignItems: 'center' }}>
            {chips.map((chip) => (
              <RedesignChip
                key={chip.key}
                testID={`tx-chip-${chip.key}`}
                label={`${chip.label} ×`}
                onPress={() => setFilters(removeChip(filters, chip.key))}
              />
            ))}
            {chips.length >= 2 ? (
              <RedesignButton testID="tx-clear-filters" kind="link" label={t('tx.filter.clear')} onPress={() => setFilters(emptyFilters())} />
            ) : null}
            <RedesignButton testID="tx-save-view" kind="link" label={t('tx.saveAsView')} onPress={() => setSaveViewOpen(true)} />
          </View>
        ) : null}

        {banners}
        {error ? <RedesignInlineError message={error} /> : null}
        {listBody}

        {selectMode && selected.size > 0 ? (
          <View
            testID="tx-float-bar"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: sp.md,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: sp.sm,
              padding: sp.md,
              backgroundColor: theme.surface,
              borderRadius: tokens.shape['radius-md'],
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
              boxShadow: tokens.elevation['2'],
            }}
          >
            <RedesignText style={{ flex: 1 }}>{t('tx.selected', { count: selected.size })}</RedesignText>
            <RedesignButton testID="tx-float-categorize" kind="link" label={t('tx.redesign.setCategory')} onPress={() => openBulk('category')} />
            <RedesignButton testID="tx-float-account" kind="link" label={t('tx.redesign.moveAccount')} onPress={() => openBulk('account')} />
            <RedesignButton testID="tx-float-delete" kind="link" label={t('tx.delete')} onPress={() => openBulk('delete')} />
            {!phone ? (
              <>
                <RedesignButton testID="tx-float-payee" kind="link" label={t('tx.float.payee')} onPress={() => openBulk('payee')} />
                <RedesignButton testID="tx-float-tag" kind="link" label={t('tx.float.tag')} onPress={() => openBulk('tagAdd')} />
                <RedesignButton testID="tx-float-rule" kind="link" label={t('tx.float.createRule')} onPress={() => void createRuleFromSelected()} />
              </>
            ) : null}
            <Pressable
              testID="tx-float-clear"
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => {
                setSelected(new Set());
                setSelectMode(false);
              }}
              style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="x" size={tokens.size['icon-md']} color={theme.text} />
            </Pressable>
          </View>
        ) : null}
      </View>

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
      {/* keep views rename available via floating select on web — saved views stay in FiltersSheet/URL */}
      {views.length > 0 && !phone ? (
        <View accessibilityElementsHidden style={{ height: 0, overflow: 'hidden' }}>
          {views.map((v) => (
            <Pressable key={v.id} testID={`tx-view-${v.id}`} onPress={() => router.setParams({ view: v.id, ...clearFilterParams(), ...filtersToParams(v.filters) })} />
          ))}
        </View>
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
    <RedesignSheet
      visible
      testID="tx-save-view-sheet"
      title={t('tx.saveAsView')}
      onClose={onClose}
      footer={<RedesignButton testID="tx-save-view-confirm" label={t('tx.saveView')} disabled={!name.trim()} onPress={onSave} fullWidth />}
    >
      <RedesignField testID="tx-save-view-name" label={t('tx.viewName')} value={name} onChangeText={onChange} />
    </RedesignSheet>
  );
}

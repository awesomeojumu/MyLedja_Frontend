import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Dialog, Icon, maxWidth, Rise, Toast, Txt, useTheme } from "@/design";
import { useDashboardOverlays } from "@/features/dashboard";
import { ReviewBanner, TxHeader, TxSearchCard } from "@/features/transactions/components/TxFeedParts";
import {
  ActiveFilters,
  BulkActionBar,
  BulkPanel,
  DateSheet,
  FilterSheet,
  PickSheet,
  SelectBar,
  type BulkAction,
  type PickOption,
} from "@/features/transactions/components/TxSelectParts";
import { TxDetailPanel, TxPanelHint, TxTable, TxWideHeader } from "@/features/transactions/components/TxTableParts";
import { activeFilterCount, applyBulk, bulkMessage, matchesFilters, NO_FILTERS, voidBulk, type BulkPatch, type FeedFilters } from "@/features/transactions/services/bulk-edit";
import {
  feedCounts,
  groupByDay,
  inMonth,
  matchesFilter,
  matchesSearch,
  monthIndex,
  monthLabel,
  monthSummary,
  tableRows,
  type FeedFilter,
  type TableSort,
} from "@/features/transactions/services/tx-feed";
import { newId } from "@/lib/ids";
import { LiveNotice } from "@/lib/live-notice";
import { nairaAmount, rowKind, toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { LedgerDay, LedgerRow, useActiveWorkspace } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = {
  txns: [] as ApiTransaction[],
  names: {} as Record<string, string>,
  categories: {} as Record<string, string>,
  categoryKinds: {} as Record<string, string>,
};

type SheetName = "filters" | "category" | "account" | "date" | null;

export function TransactionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { requestAdd, setNavHidden } = useDashboardOverlays();
  const { workspaceId } = useActiveWorkspace();
  const thisMonth = monthIndex(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TableSort>({ key: "date", dir: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<SheetName>(null);
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** Desktop and landscape tablets get the table with a details panel. */
  const wide = (t.widthClass === "expanded" || t.widthClass === "large") && !t.portrait;

  // On phones, select mode's action bar takes the tab bar's place.
  useEffect(() => {
    setNavHidden(selecting && !wide);
    return () => setNavHidden(false);
  }, [selecting, wide, setNavHidden]);

  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes, categoriesRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
        session.listCategories(workspaceId).catch(() => ({ data: [] as { id: string; name: string; kind?: string }[] })),
      ]);
      const names = Object.fromEntries(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      ) as Record<string, string>;
      const rows = (Array.isArray(categoriesRes.data) ? categoriesRes.data : []) as { id: string; name: string; kind?: string }[];
      const categories = Object.fromEntries(rows.map((row) => [String(row.id), row.name] as const)) as Record<string, string>;
      const categoryKinds = Object.fromEntries(rows.map((row) => [String(row.id), row.kind ?? "expense"] as const)) as Record<string, string>;
      return { txns: (txRes.data?.transactions ?? []).filter((row) => row.id), names, categories, categoryKinds };
    },
    [session],
  );

  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, EMPTY, "transactions-feed");
  const allTxns = data?.txns ?? [];
  const names = data?.names ?? EMPTY.names;
  const categories = data?.categories ?? EMPTY.categories;
  const categoryKinds = data?.categoryKinds ?? EMPTY.categoryKinds;

  const monthRows = inMonth(allTxns, month);
  const searched = monthRows.filter((row) => matchesSearch(row, query, categories, names));
  const filtered = searched.filter((row) => matchesFilters(row, filters, nairaAmount(row.amount)));
  const counts = feedCounts(filtered);
  const shown = filtered.filter((row) => matchesFilter(row, filter));
  const days = groupByDay(shown, categories, names);
  const summary = known ? monthSummary(allTxns, month, categories) : null;
  const label = monthLabel(month);
  const reviewing = filter === "uncategorised";
  const reviewCount = feedCounts(monthRows).uncategorised;
  const narrowing = Boolean(query) || filter !== "all" || activeFilterCount(filters) > 0;

  const pickedRows = allTxns.filter((row) => picked.has(String(row.id)));
  const pickedTotal = pickedRows.reduce((sum, row) => {
    const kind = rowKind(row.type);
    return kind === "income" ? sum + nairaAmount(row.amount) : kind === "expense" ? sum - nairaAmount(row.amount) : sum;
  }, 0);
  const shownIds = shown.map((row) => String(row.id));
  const allPicked = shownIds.length > 0 && shownIds.every((id) => picked.has(id));

  const categoryOptions: PickOption[] = Object.entries(categories)
    .map(([id, name]) => ({ id, label: name, category: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const usage = new Map<string, number>();
  for (const row of allTxns) if (row.categoryId) usage.set(row.categoryId, (usage.get(row.categoryId) ?? 0) + 1);
  const filterCategories = [...categoryOptions].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  const accountOptions: PickOption[] = Object.entries(names).map(([id, name]) => ({ id, label: name }));
  // Every selected row that takes a category is either expense or income; offer only categories that fit them all.
  const pickedKinds = new Set(pickedRows.map((row) => rowKind(row.type)).filter((k) => k !== "transfer"));
  const bulkCategories = categoryOptions.filter((c) => pickedKinds.size !== 1 || categoryKinds[c.id] === [...pickedKinds][0]);

  const changeMonth = (next: number) => {
    setMonth(Math.min(next, thisMonth));
    if (filter === "uncategorised") setFilter("all");
  };

  const startSelecting = (firstId?: string) => {
    setSelecting(true);
    setSelectedId(null);
    setPicked(firstId ? new Set([firstId]) : new Set());
  };
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
    setSheet(null);
  };
  const togglePick = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(shownIds));

  const runBulk = async (verb: string, patch: BulkPatch | null) => {
    if (!workspaceId || pickedRows.length === 0) return;
    setSheet(null);
    setBulkVoidOpen(false);
    setBusy(true);
    try {
      const result = patch ? await applyBulk(session, workspaceId, pickedRows, patch, newId) : await voidBulk(session, workspaceId, pickedRows);
      setToast(bulkMessage(verb, result));
      stopSelecting();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onBulkAction = (action: BulkAction) => {
    if (action === "void") setBulkVoidOpen(true);
    else setSheet(action);
  };

  const empty = (
    <View style={{ alignItems: "center", gap: t.space.space3, paddingVertical: t.space.space8 }}>
      <Icon name={query ? "search" : "inbox"} size={28} color={t.c.inkMuted} />
      <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center" }}>
        {query ? `Nothing matches "${query.trim()}" in ${label.split(" ")[0]}` : narrowing ? "Nothing matches these filters" : `Nothing recorded in ${label.split(" ")[0]}`}
      </Txt>
      {query ? (
        <Button variant="tertiary" size="sm" onPress={() => setQuery("")}>Clear search</Button>
      ) : activeFilterCount(filters) > 0 ? (
        <Button variant="tertiary" size="sm" onPress={() => setFilters(NO_FILTERS)}>Clear filters</Button>
      ) : month === thisMonth ? (
        <Button variant="secondary" size="sm" icon="plus" onPress={() => requestAdd("expense")}>Add an expense</Button>
      ) : null}
    </View>
  );

  const endNote = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: t.space.space3 }}>
      <Icon name="circle-check" size={14} color={t.c.inkMuted} />
      <Txt variant="caption" color={t.c.inkMuted}>
        {narrowing ? "That's every match" : `That's everything for ${label.split(" ")[0]}`}
      </Txt>
    </View>
  );

  const addCategory = (id: string) => router.push(`/(tabs)/transactions/edit?id=${encodeURIComponent(id)}`);

  const searchCard = (overlap: boolean) => (
    <TxSearchCard
      overlap={overlap}
      query={query}
      onQuery={setQuery}
      filter={filter}
      onFilter={setFilter}
      counts={counts}
      onMoreFilters={() => setSheet("filters")}
    />
  );

  const activeFilters = <ActiveFilters value={filters} categoryNames={categories} accountNames={names} onChange={setFilters} />;

  const sheets = (
    <>
      <FilterSheet
        key={`filters-${sheet === "filters"}`}
        open={sheet === "filters"}
        value={filters}
        categories={filterCategories}
        accounts={accountOptions}
        countFor={(f) => searched.filter((row) => matchesFilters(row, f, nairaAmount(row.amount)) && matchesFilter(row, filter)).length}
        onClose={() => setSheet(null)}
        onApply={(f) => {
          setFilters(activeFilterCount(f) > 0 ? f : NO_FILTERS);
          setSheet(null);
        }}
      />
      <PickSheet
        title="Change category"
        open={sheet === "category"}
        options={bulkCategories}
        onClose={() => setSheet(null)}
        onPick={(categoryId) => runBulk(`Moved to ${categories[categoryId] ?? "category"}:`, { categoryId })}
      />
      <PickSheet
        title="Change account"
        open={sheet === "account"}
        options={accountOptions}
        onClose={() => setSheet(null)}
        onPick={(accountId) => runBulk(`Moved to ${names[accountId] ?? "account"}:`, { accountId })}
      />
      <DateSheet key={`date-${sheet === "date"}`} open={sheet === "date"} onClose={() => setSheet(null)} onPick={(date) => runBulk("Date changed:", { date })} />
      <Dialog
        title={`Void ${picked.size} ${picked.size === 1 ? "transaction" : "transactions"}?`}
        open={bulkVoidOpen}
        onClose={() => setBulkVoidOpen(false)}
        tone="destructive"
        confirmLabel="Void"
        onConfirm={() => runBulk("Voided", null)}
      >
        <Txt>They stop counting in totals, balances and reports, and stay in the audit history.</Txt>
      </Dialog>
    </>
  );

  const toastView = toast ? (
    <View style={{ position: "absolute", left: t.space.space4, right: t.space.space4, bottom: insets.bottom + 96, alignItems: "center" }} pointerEvents="box-none">
      <View style={{ width: "100%", maxWidth: 420 }}>
        <Toast message={toast} onClose={() => setToast(null)} />
      </View>
    </View>
  ) : null;

  if (wide) {
    const rows = tableRows(days, sort);
    const selectedRow = selecting ? null : rows.find((row) => row.id === selectedId) ?? null;
    const selectedRaw = selectedRow ? allTxns.find((row) => String(row.id) === selectedRow.id) : undefined;
    const when = selectedRaw?.occurredAt
      ? new Date(selectedRaw.occurredAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
      : "—";
    const onSort = (key: TableSort["key"]) =>
      setSort((cur) => (cur.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "title" ? "asc" : "desc" }));
    const voidSelected = async () => {
      if (!selectedRow || !workspaceId) return;
      try {
        await session.setTransactionStatus(workspaceId, selectedRow.id, "voided");
        setSelectedId(null);
        refresh();
      } finally {
        setVoidOpen(false);
      }
    };
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 }} keyboardShouldPersistTaps="handled">
          {selecting ? (
            <SelectBar topInset={insets.top} count={picked.size} total={pickedTotal} allSelected={allPicked} onCancel={stopSelecting} onToggleAll={toggleAll} />
          ) : (
            <TxWideHeader
              topInset={insets.top}
              month={label}
              isCurrentMonth={month === thisMonth}
              summary={summary}
              onPrev={() => changeMonth(month - 1)}
              onNext={() => changeMonth(month + 1)}
              onThisMonth={() => changeMonth(thisMonth)}
              onCalendar={() => router.push(`/(tabs)/transactions/calendar?month=${month}`)}
              onSelect={() => startSelecting()}
            />
          )}
          <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", padding: t.space.space6, gap: t.space.space4 }}>
            <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
            <View style={{ flexDirection: "row", gap: t.space.space4, alignItems: "center" }}>
              <View style={{ flex: 1, maxWidth: 640 }}>{searchCard(false)}</View>
              {reviewCount > 0 && !selecting ? (
                <View style={{ flex: 1 }}>
                  <ReviewBanner count={reviewCount} reviewing={reviewing} onPress={() => setFilter(reviewing ? "all" : "uncategorised")} />
                </View>
              ) : null}
            </View>
            {activeFilters}
            <View style={{ flexDirection: "row", gap: t.space.space5, alignItems: "flex-start" }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                {loading && !known ? (
                  <DefaultLoading />
                ) : rows.length === 0 ? (
                  empty
                ) : (
                  <TxTable
                    rows={rows}
                    sort={sort}
                    onSort={onSort}
                    selectedId={selectedId}
                    checkedIds={selecting ? picked : undefined}
                    onSelect={(id) => (selecting ? togglePick(id) : setSelectedId((cur) => (cur === id ? null : id)))}
                    onAddCategory={addCategory}
                    footer={endNote}
                  />
                )}
              </View>
              <View style={{ width: 320 }}>
                {selecting ? (
                  <BulkPanel count={picked.size} total={pickedTotal} busy={busy} onAction={onBulkAction} onCancel={stopSelecting} />
                ) : selectedRow ? (
                  <TxDetailPanel
                    row={selectedRow}
                    when={when}
                    onClose={() => setSelectedId(null)}
                    onEdit={() => router.push(`/(tabs)/transactions/edit?id=${encodeURIComponent(selectedRow.id)}`)}
                    onSplit={() => router.push(`/(tabs)/transactions/split?id=${encodeURIComponent(selectedRow.id)}`)}
                    onRefund={selectedRow.kind === "expense" ? () => router.push(`/(tabs)/transactions/refund?id=${encodeURIComponent(selectedRow.id)}`) : undefined}
                    onHistory={() => router.push(`/(tabs)/transactions/history?id=${encodeURIComponent(selectedRow.id)}`)}
                    onVoid={() => setVoidOpen(true)}
                    onAddCategory={() => addCategory(selectedRow.id)}
                  />
                ) : (
                  <TxPanelHint />
                )}
              </View>
            </View>
          </View>
        </ScrollView>
        <Dialog
          title="Void transaction?"
          open={voidOpen}
          onClose={() => setVoidOpen(false)}
          tone="destructive"
          confirmLabel="Void transaction"
          onConfirm={voidSelected}
        >
          <Txt>Voiding stops this transaction from counting in totals, balances, and reports, while keeping it in the audit history.</Txt>
        </Dialog>
        {sheets}
        {toastView}
      </View>
    );
  }

  const list =
    loading && !known ? (
      <DefaultLoading />
    ) : days.length === 0 ? (
      empty
    ) : (
      <View style={{ gap: t.space.space4 }}>
        {days.map((day) => (
          <LedgerDay key={day.key} label={day.label} net={day.net}>
            {day.items.map((item, i) => (
              <LedgerRow
                key={item.id}
                item={item}
                compact
                last={i === day.items.length - 1}
                selected={selecting ? picked.has(item.id) : undefined}
                onPress={() => (selecting ? togglePick(item.id) : router.push(`/(tabs)/transactions/${item.id}`))}
                onLongPress={selecting ? undefined : () => startSelecting(item.id)}
                onAddCategory={() => addCategory(item.id)}
              />
            ))}
          </LedgerDay>
        ))}
        {endNote}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }} keyboardShouldPersistTaps="handled">
        {selecting ? (
          <SelectBar topInset={insets.top} count={picked.size} total={pickedTotal} allSelected={allPicked} onCancel={stopSelecting} onToggleAll={toggleAll} />
        ) : (
          <TxHeader
            topInset={insets.top}
            month={label}
            isCurrentMonth={month === thisMonth}
            summary={summary}
            onPrev={() => changeMonth(month - 1)}
            onNext={() => changeMonth(month + 1)}
            onThisMonth={() => changeMonth(thisMonth)}
            onCalendar={() => router.push(`/(tabs)/transactions/calendar?month=${month}`)}
            onSelect={() => startSelecting()}
          />
        )}
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center" }}>
          {selecting ? null : searchCard(true)}
          <View style={{ paddingHorizontal: t.space.space3, paddingTop: t.space.space4, gap: t.space.space4 }}>
            <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
            {selecting ? null : activeFilters}
            {reviewCount > 0 && !selecting ? (
              <ReviewBanner count={reviewCount} reviewing={reviewing} onPress={() => setFilter(reviewing ? "all" : "uncategorised")} />
            ) : null}
            <Rise delay={40}>{list}</Rise>
          </View>
        </View>
      </ScrollView>
      {selecting ? <BulkActionBar disabled={picked.size === 0} busy={busy} bottomInset={insets.bottom} onAction={onBulkAction} /> : null}
      {sheets}
      {toastView}
    </View>
  );
}

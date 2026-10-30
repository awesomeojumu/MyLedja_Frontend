import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput as RNTextInput, useWindowDimensions, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, CircleDot, RotateCcw } from 'lucide-react-native';

import {
  Amount,
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  InlineError,
  Placeholder,
  Popover,
  ProgressRing,
  Select,
  SegmentedControl,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { formatNaira, parseAmount, toInputText } from '@/money';
import { monthOf } from '@/ledger';

import { categoryIconByName, defaultIconForName } from './categoryIcons';
import {
  barFor,
  budgetableIncomeOf,
  budgetCategories,
  budgetForMonth,
  categoryTemplateLines,
  groupTotals,
  groupedBudgetCategories,
  incomeReceivedOf,
  monthLabel,
  nextMonth,
  overspentCategories,
  plannedTotalOf,
  prevMonth,
  resolveTemplateLineAmount,
  rowFor,
  shortMonth,
  summaryByType,
  type BudgetGroupBy,
} from './helpers';
import { CoverSheet } from './CoverSheet';
import { EditAmountSheet } from './EditAmountSheet';
import { MoveMoneySheet } from './MoveMoneySheet';
import { TemplatesSheet } from './TemplatesSheet';
import { isRedesignEnabled } from '@/design/redesign';
import { RedesignBudgetScreen } from './RedesignBudgetScreen';

function groupLabel(group: string): string {
  if (group in catalogue) return t(group as TextKey);
  if (group === 'fixed' || group === 'flexible' || group === 'nonMonthly' || group === 'savings') {
    return t(`budget.type.${group}` as TextKey);
  }
  return group;
}

const sp = tokens.spacing;
const c = tokens.color;

function barFill(state: ReturnType<typeof barFor>) {
  if (state === 'over') return c.ruby;
  if (state === 'near') return c.primary;
  return c['primary-soft'];
}

function remainingColor(state: ReturnType<typeof barFor>, theme: ReturnType<typeof useTheme>) {
  if (state === 'over') return theme.error;
  if (state === 'near') return theme.primaryFill;
  return theme.text;
}

export function BudgetScreen() {
  if (isRedesignEnabled()) return <RedesignBudgetScreen />;
  return <LegacyBudgetScreen />;
}

function LegacyBudgetScreen() {
  const { snapshot, repo } = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  // D21: tablet landscape gets 3-month + summary; desktop/wide always; portrait tablet uses strip only.
  const tabletLandscape = size === 'tablet' && landscape;
  const wideEnough = size === 'desktop' || size === 'wide' || tabletLandscape;
  const showSummaryColumn = wideEnough;
  const useInlinePlanned = Platform.OS === 'web';
  const params = useGlobalSearchParams<{
    plan?: string;
    move?: string;
    cover?: string;
    months?: string;
    group?: string;
    templates?: string;
  }>();

  const [month, setMonth] = useState(() => monthOf(today()));
  const templatesOpen = params.templates === '1';
  const setTemplatesOpen = (open: boolean) => {
    if (open) router.setParams({ templates: '1' });
    else router.setParams({ templates: undefined });
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const monthSpan: '1' | '3' = params.months === '3' && wideEnough ? '3' : '1';
  const groupBy: BudgetGroupBy = params.group === 'type' ? 'type' : 'groups';
  const editId = params.plan ?? null;
  const moveOpen = params.move !== undefined;
  const moveFrom = params.move && params.move !== '1' ? params.move : null;
  const coverOpen = params.cover === '1';

  const setMonthSpan = (v: '1' | '3') => router.setParams({ months: v === '1' ? undefined : v });
  const setGroupBy = (v: BudgetGroupBy) => router.setParams({ group: v === 'groups' ? undefined : v });
  const openEdit = (catId: string) => {
    setRowMenuId(null);
    // D12: web edits Planned in the grid cell (Enter/Tab); phone/tablet keep sheet/popover via ?plan=.
    if (useInlinePlanned) {
      setInlineEditId(catId);
      return;
    }
    router.setParams({ plan: catId });
  };
  const closeEdit = () => {
    setInlineEditId(null);
    router.setParams({ plan: undefined });
  };
  const openMove = (fromId?: string) => router.setParams({ move: fromId ?? '1' });
  const closeMove = () => router.setParams({ move: undefined });
  const openCover = () => router.setParams({ cover: '1' });
  const closeCover = () => router.setParams({ cover: undefined });

  const displayMonths = useMemo(() => {
    if (monthSpan === '1') return [month];
    return [prevMonth(prevMonth(month)), prevMonth(month), month];
  }, [month, monthSpan]);

  const model = useMemo(() => {
    if (!snapshot) return null;
    const cats = budgetCategories(snapshot);
    const budget = budgetForMonth(snapshot, month);
    const groups = groupedBudgetCategories(snapshot, groupBy);
    return {
      cats,
      budget,
      groups,
      overspent: overspentCategories(snapshot, month),
      style: snapshot.settings.budgetStyle,
      planned: plannedTotalOf(snapshot, month),
      budgetableIncome: budgetableIncomeOf(snapshot, month),
      incomeReceived: incomeReceivedOf(snapshot, month),
      byType: summaryByType(snapshot, month),
    };
  }, [snapshot, month, groupBy]);

  const categoryOrder = useMemo(() => {
    if (!model) return [];
    return model.groups.flatMap(([, cats]) => cats.map((cat) => cat.id));
  }, [model]);

  const savePlannedFor = async (
    catId: string,
    amount: bigint,
    opts: { carryOver: boolean; note: string },
    andNext?: boolean,
  ) => {
    if (!snapshot) return;
    setError(null);
    const cat = snapshot.categories.find((c) => c.id === catId);
    const prevAmount = repo.assigned(catId, month, snapshot);
    const prevCarry = cat?.carryOver ?? false;
    const prevNote = snapshot.assignNotes.get(`${catId}:${month}`) ?? '';
    if (cat && cat.carryOver !== opts.carryOver) {
      await repo.updateCategory({ ...cat, carryOver: opts.carryOver });
    }
    await repo.setAssigned(catId, month, amount, { note: opts.note });
    toast.show(t('budget.planSaved'), () => {
      void (async () => {
        const current = await repo.load();
        const c2 = current.categories.find((x) => x.id === catId);
        if (c2 && c2.carryOver !== prevCarry) await repo.updateCategory({ ...c2, carryOver: prevCarry });
        await repo.setAssigned(catId, month, prevAmount, { note: prevNote });
      })();
    });
    if (andNext) {
      const i = categoryOrder.indexOf(catId);
      const nextId = i >= 0 ? categoryOrder[i + 1] : undefined;
      if (nextId && useInlinePlanned) {
        setInlineEditId(nextId);
        return;
      }
      if (nextId) {
        router.setParams({ plan: nextId });
        return;
      }
    }
    closeEdit();
  };

  const savePlanned = async (amount: bigint, opts: { carryOver: boolean; note: string }) => {
    if (!editId) return;
    await savePlannedFor(editId, amount, opts);
  };

  const saveInlinePlanned = async (catId: string, amount: bigint, andNext: boolean) => {
    if (!snapshot) return;
    const cat = snapshot.categories.find((c) => c.id === catId);
    const note = snapshot.assignNotes.get(`${catId}:${month}`) ?? '';
    await savePlannedFor(catId, amount, { carryOver: cat?.carryOver ?? false, note }, andNext);
  };

  const openRowMenu = (catId: string) => setRowMenuId(catId);

  return (
    <AppFrame title={t('budget.title')}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View
          testID="budget-month-swipe"
          onTouchStart={(e) => {
            if (size !== 'phone') return;
            swipeStartX.current = e.nativeEvent.pageX;
          }}
          onTouchEnd={(e) => {
            if (size !== 'phone') return;
            const start = swipeStartX.current;
            swipeStartX.current = null;
            if (start == null) return;
            const dx = e.nativeEvent.pageX - start;
            if (dx < -40) setMonth(nextMonth(month));
            else if (dx > 40) setMonth(prevMonth(month));
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp['spacing-md'] }}
        >
          <Pressable
            testID="budget-prev-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.previousMonth')}
            onPress={() => setMonth(prevMonth(month))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={20} color={theme.textSecondary} />
          </Pressable>
          <Text testID="budget-month" variant="heading-sm" accessibilityRole="header">
            {monthLabel(month)}
          </Text>
          <Pressable
            testID="budget-next-month"
            accessibilityRole="button"
            accessibilityLabel={t('date.nextMonth')}
            onPress={() => setMonth(nextMonth(month))}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
          {wideEnough ? (
            <SegmentedControl
              testID="budget-month-span"
              label={t('budget.monthSpan')}
              value={monthSpan}
              onChange={setMonthSpan}
              options={[
                { value: '1', label: t('budget.oneMonth') },
                { value: '3', label: t('budget.threeMonths') },
              ]}
            />
          ) : null}
          <Select
            testID="budget-group-by"
            label={t('budget.groupBy')}
            value={groupBy}
            onChange={(v) => setGroupBy(v as BudgetGroupBy)}
            options={[
              { value: 'groups', label: t('budget.groupGroups') },
              { value: 'type', label: t('budget.groupType') },
            ]}
          />
          <Button testID="budget-more-menu" kind="secondary" label={t('budget.moreMenu')} onPress={() => setMenuOpen(true)} />
        </View>

        {!model ? (
          <Placeholder height={120} />
        ) : model.cats.length === 0 ? (
          <EmptyState title={t('budget.emptyTitle')} body={t('budget.emptyBody')} actionLabel={t('budget.emptyAction')} onAction={() => router.push('/')} />
        ) : (
          <>
            <BudgetBanner
              style={model.style}
              leftToPlan={model.budget.leftToPlan}
              planned={model.planned}
              budgetableIncome={model.budgetableIncome}
              overspentCount={model.overspent.length}
              onCover={openCover}
            />
            {!showSummaryColumn ? <BudgetSummaryStrip snapshot={snapshot!} budget={model.budget} /> : null}
            <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
              <Button testID="budget-move" kind="secondary" label={t('budget.moveMoney')} onPress={() => openMove()} />
              {snapshot && snapshot.assigns.size > 0 ? (
                <Button testID="budget-templates" kind="secondary" label={t('budget.templates')} onPress={() => setTemplatesOpen(true)} />
              ) : null}
              {model.overspent.length > 0 ? (
                <Button
                  testID="budget-cover"
                  kind="secondary"
                  label={t('budget.coverOverspending', { count: model.overspent.length })}
                  onPress={openCover}
                />
              ) : null}
            </View>
            {error ? <InlineError message={error} /> : null}

            <View style={{ flexDirection: showSummaryColumn ? 'row' : 'column', gap: sp['spacing-lg'], alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: sp['spacing-md'], minWidth: 0, width: '100%' }}>
                {monthSpan === '3' ? (
                  <View testID="budget-three-months" style={{ gap: sp['spacing-sm'] }}>
                    <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
                      {displayMonths.map((m) => (
                        <Text key={m} variant="caption" tone={m === month ? undefined : 'textSecondary'}>
                          {shortMonth(m)}
                        </Text>
                      ))}
                    </View>
                    <View testID="budget-columns-3" style={{ flexDirection: 'row', gap: sp['spacing-sm'], paddingHorizontal: sp['spacing-md'] }}>
                      <Text variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                        {t('budget.col.category')}
                      </Text>
                      {displayMonths.map((m) => (
                        <View
                          key={m}
                          style={{
                            width: 168,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            backgroundColor: m === month ? c['primary-bg-subdued-hover'] : undefined,
                            borderRadius: tokens.radius['rounded-sm'],
                            paddingHorizontal: 2,
                          }}
                        >
                          <Text variant="micro" tone={m === month ? undefined : 'textSecondary'}>
                            {t('budget.col.planned')}
                          </Text>
                          <Text variant="micro" tone={m === month ? undefined : 'textSecondary'}>
                            {t('budget.col.spent')}
                          </Text>
                          <Text variant="micro" tone={m === month ? undefined : 'textSecondary'}>
                            {t('budget.col.remaining')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View testID="budget-columns" style={{ flexDirection: 'row', gap: sp['spacing-md'], paddingHorizontal: sp['spacing-md'] }}>
                    <Text variant="caption" tone="textSecondary" style={{ flex: 1 }}>
                      {t('budget.col.category')}
                    </Text>
                    <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                      {t('budget.col.planned')}
                    </Text>
                    <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                      {t('budget.col.spent')}
                    </Text>
                    <Text variant="caption" tone="textSecondary" style={{ width: 88, textAlign: 'right' }}>
                      {t('budget.col.remaining')}
                    </Text>
                  </View>
                )}

                {model.groups.map(([group, cats]) => {
                  const isCollapsed = !!collapsed[group];
                  const totals = groupTotals(
                    snapshot!,
                    month,
                    cats.map((x) => x.id),
                  );
                  const label = groupLabel(group);
                  return (
                    <Card key={group} testID={`budget-group-${group}`} style={{ padding: 0, gap: 0 }}>
                      <Pressable
                        testID={`budget-group-toggle-${group}`}
                        accessibilityRole="button"
                        accessibilityLabel={isCollapsed ? t('budget.expandGroup', { name: label }) : t('budget.collapseGroup', { name: label })}
                        onPress={() => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))}
                        style={{
                          padding: sp['spacing-md'],
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: sp['spacing-sm'],
                          justifyContent: 'space-between',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flexShrink: 1 }}>
                          <Icon icon={ChevronDown} size="row" color={theme.textSecondary} />
                          <Text variant="heading-sm">{label}</Text>
                        </View>
                        <Text variant="caption" tone="textSecondary" testID={`budget-group-total-${group}`}>
                          {t('budget.groupTotal', {
                            planned: formatNaira(totals.planned),
                            spent: formatNaira(totals.spent),
                            remaining: formatNaira(totals.remaining),
                          })}
                        </Text>
                      </Pressable>
                      {isCollapsed
                        ? null
                        : cats.map((cat) => {
                            const row = rowFor(snapshot!, month, cat.id);
                            const state = barFor(snapshot!, month, cat.id);
                            const plan = row.carried + row.assigned;
                            const pct = plan <= 0n ? (row.activity > 0n ? 1 : 0) : Number((row.activity * 1000n) / plan) / 1000;
                            const tplLines = categoryTemplateLines(snapshot!, cat.id);
                            const tplMet =
                              tplLines.length > 0 &&
                              tplLines.every(({ line }) => resolveTemplateLineAmount(snapshot!, month, line) <= row.assigned);
                            const IconTile = categoryIconByName(cat.icon ?? defaultIconForName(cat.name));
                            return (
                              <View
                                key={cat.id}
                                testID={`budget-row-${cat.id}`}
                                style={{
                                  paddingHorizontal: sp['spacing-md'],
                                  paddingVertical: sp['spacing-sm'],
                                  borderTopWidth: 1,
                                  borderTopColor: theme.border,
                                  gap: sp['spacing-xs'],
                                }}
                                // Web right-click menu (D22)
                                {...(Platform.OS === 'web'
                                  ? {
                                      onContextMenu: (e: { preventDefault?: () => void }) => {
                                        e.preventDefault?.();
                                        openRowMenu(cat.id);
                                      },
                                    }
                                  : {})}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-md'] }}>
                                  <Pressable
                                    testID={`budget-name-${cat.id}`}
                                    accessibilityRole="link"
                                    accessibilityLabel={cat.name}
                                    onPress={() => router.push(`/budget/category/${cat.id}`)}
                                    onLongPress={() => openRowMenu(cat.id)}
                                    style={{
                                      flex: 1,
                                      minHeight: 44,
                                      justifyContent: 'center',
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: sp['spacing-sm'],
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <View
                                      testID={`budget-icon-${cat.id}`}
                                      style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: tokens.radius['rounded-sm'],
                                        backgroundColor: c['primary-bg-subdued-hover'],
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <IconTile size={16} color={theme.textSecondary} />
                                    </View>
                                    <Text>{cat.name}</Text>
                                    {cat.carryOver ? (
                                      <View
                                        testID={`budget-mark-carry-${cat.id}`}
                                        accessibilityLabel={t('budget.markCarryOver')}
                                        // @ts-expect-error web title tooltip
                                        title={t('budget.markCarryOver')}
                                      >
                                        <Icon icon={RotateCcw} size="row" color={theme.textSecondary} />
                                      </View>
                                    ) : null}
                                    {tplLines.length > 0 ? (
                                      <View
                                        testID={`budget-mark-template-${cat.id}`}
                                        accessibilityLabel={tplMet ? t('budget.markTemplate') : t('budget.markTemplateUnmet')}
                                        // @ts-expect-error web title tooltip
                                        title={tplMet ? t('budget.markTemplate') : t('budget.markTemplateUnmet')}
                                      >
                                        <Icon icon={CircleDot} size="row" color={tplMet ? theme.textSecondary : c.ruby} />
                                      </View>
                                    ) : null}
                                  </Pressable>
                                  {monthSpan === '3'
                                    ? displayMonths.map((m) => {
                                        const r = rowFor(snapshot!, m, cat.id);
                                        const st = barFor(snapshot!, m, cat.id);
                                        return (
                                          <View
                                            key={m}
                                            testID={`budget-month-cols-${cat.id}-${m}`}
                                            style={{
                                              width: 168,
                                              flexDirection: 'row',
                                              justifyContent: 'space-between',
                                              backgroundColor: m === month ? c['primary-bg-subdued-hover'] : undefined,
                                              borderRadius: tokens.radius['rounded-sm'],
                                              paddingHorizontal: 2,
                                            }}
                                          >
                                            {m === month && inlineEditId === cat.id ? (
                                              <InlinePlannedInput
                                                catId={cat.id}
                                                assigned={r.assigned}
                                                onCommit={(amount, andNext) => void saveInlinePlanned(cat.id, amount, andNext)}
                                                onCancel={() => setInlineEditId(null)}
                                              />
                                            ) : (
                                              <Pressable
                                                testID={m === month ? `budget-planned-${cat.id}` : undefined}
                                                accessibilityRole="button"
                                                onPress={() => {
                                                  setMonth(m);
                                                  openEdit(cat.id);
                                                }}
                                                style={{ minWidth: 48, alignItems: 'flex-end' }}
                                              >
                                                <Amount minor={r.assigned} variant="caption" />
                                              </Pressable>
                                            )}
                                            <Pressable
                                              testID={`budget-spent-${cat.id}-${m}`}
                                              accessibilityRole="link"
                                              accessibilityLabel={t('budget.spentLink', { name: cat.name })}
                                              onPress={() =>
                                                router.push({ pathname: '/transactions', params: { category: cat.id, month: m } })
                                              }
                                              style={{ minWidth: 48, alignItems: 'flex-end' }}
                                            >
                                              <Amount minor={r.activity} variant="caption" />
                                            </Pressable>
                                            <Text
                                              variant="caption"
                                              style={{ color: remainingColor(st, theme), fontVariant: ['tabular-nums'] }}
                                            >
                                              {formatNaira(r.available)}
                                            </Text>
                                          </View>
                                        );
                                      })
                                    : (
                                      <>
                                        {inlineEditId === cat.id ? (
                                          <InlinePlannedInput
                                            catId={cat.id}
                                            assigned={row.assigned}
                                            onCommit={(amount, andNext) => void saveInlinePlanned(cat.id, amount, andNext)}
                                            onCancel={() => setInlineEditId(null)}
                                          />
                                        ) : (
                                          <Pressable
                                            testID={`budget-planned-${cat.id}`}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('budget.editPlanned', { name: cat.name })}
                                            onPress={() => openEdit(cat.id)}
                                            onLongPress={() => openRowMenu(cat.id)}
                                            style={{ width: 88, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
                                          >
                                            <Amount minor={row.assigned} />
                                          </Pressable>
                                        )}
                                        <Pressable
                                          testID={`budget-spent-${cat.id}`}
                                          accessibilityRole="link"
                                          accessibilityLabel={t('budget.spentLink', { name: cat.name })}
                                          onPress={() =>
                                            router.push({ pathname: '/transactions', params: { category: cat.id, month } })
                                          }
                                          style={{ width: 88, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
                                        >
                                          <Amount minor={row.activity} />
                                        </Pressable>
                                        <View style={{ width: 88, alignItems: 'flex-end' }} testID={`budget-remaining-${cat.id}`}>
                                          <Text
                                            variant="body-tabular"
                                            style={{ color: remainingColor(state, theme), fontVariant: ['tabular-nums'] }}
                                          >
                                            {formatNaira(row.available)}
                                          </Text>
                                          {state === 'near' ? (
                                            <Text variant="micro" tone="textSecondary">
                                              {t('budget.nearLimit')}
                                            </Text>
                                          ) : null}
                                          {state === 'over' ? (
                                            <Text variant="micro" style={{ color: theme.error }}>
                                              {t('budget.overBy', { amount: formatNaira(-row.available) })}
                                            </Text>
                                          ) : null}
                                        </View>
                                      </>
                                    )}
                                </View>
                                <View
                                  testID={`budget-bar-${cat.id}`}
                                  accessibilityRole="progressbar"
                                  accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(pct * 100)) }}
                                  style={{ height: 3, width: '90%', backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' }}
                                >
                                  <View style={{ height: 3, width: `${Math.min(100, pct * 100)}%`, backgroundColor: barFill(state) }} />
                                </View>
                              </View>
                            );
                          })}
                    </Card>
                  );
                })}
              </View>

              {showSummaryColumn && snapshot ? (
                <BudgetSummaryColumn
                  snapshot={snapshot}
                  month={month}
                  budget={model.budget}
                  planned={model.planned}
                  incomeReceived={model.incomeReceived}
                  budgetableIncome={model.budgetableIncome}
                  byType={model.byType}
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {snapshot ? (
        <EditAmountSheet
          visible={editId !== null}
          categoryId={editId}
          category={editId ? snapshot.categories.find((c) => c.id === editId) : undefined}
          month={month}
          snapshot={snapshot}
          categoryOrder={categoryOrder}
          onClose={closeEdit}
          onSave={savePlanned}
          onNext={(nextId) => router.setParams({ plan: nextId })}
        />
      ) : null}

      <Popover visible={rowMenuId !== null} onClose={() => setRowMenuId(null)} testID="budget-row-menu">
        <Text variant="heading-sm">{snapshot?.categories.find((c) => c.id === rowMenuId)?.name}</Text>
        <Button
          testID="budget-row-menu-move"
          kind="secondary"
          label={t('budget.moveMoney')}
          onPress={() => {
            const id = rowMenuId;
            setRowMenuId(null);
            if (id) openMove(id);
          }}
        />
        <Button
          testID="budget-row-menu-category"
          kind="secondary"
          label={t('budget.rowViewCategory')}
          onPress={() => {
            if (rowMenuId) router.push(`/budget/category/${rowMenuId}`);
            setRowMenuId(null);
          }}
        />
        <Button
          testID="budget-row-menu-template"
          kind="secondary"
          label={t('budget.rowAddTemplate')}
          onPress={() => {
            setRowMenuId(null);
            setTemplatesOpen(true);
          }}
        />
      </Popover>

      <Popover visible={menuOpen} onClose={() => setMenuOpen(false)} testID="budget-menu-popover">
        <Text variant="heading-sm">{t('budget.moreMenu')}</Text>
        <Button
          testID="budget-menu-copy"
          kind="secondary"
          label={t('budget.menuCopyLast')}
          onPress={() => void repo.copyBudgetMonth(prevMonth(month), month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
        <Button
          testID="budget-menu-averages"
          kind="secondary"
          label={t('budget.menuFillAverages')}
          onPress={() => void repo.fillBudgetFromAverages(month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
        <Button
          testID="budget-menu-templates"
          kind="secondary"
          label={t('budget.menuApplyTemplates')}
          onPress={() => {
            setMenuOpen(false);
            setTemplatesOpen(true);
          }}
        />
        <Button
          testID="budget-menu-zero"
          kind="secondary"
          label={t('budget.menuZero')}
          onPress={() => void repo.clearMonthBudget(month).then(() => { toast.show(t('common.saved')); setMenuOpen(false); })}
        />
      </Popover>

      {snapshot && moveOpen ? (
        <MoveMoneySheet
          visible
          month={month}
          snapshot={snapshot}
          fromCategoryId={moveFrom}
          onClose={closeMove}
          onSave={async (fromId, toId, amount) => {
            const before = await repo.load();
            const fromPrev = repo.assigned(fromId, month, before);
            const toPrev = repo.assigned(toId, month, before);
            const r = await repo.moveAssigned(fromId, toId, month, amount);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.moved'), () => {
              void (async () => {
                await repo.setAssigned(fromId, month, fromPrev);
                await repo.setAssigned(toId, month, toPrev);
              })();
            });
            closeMove();
          }}
        />
      ) : null}

      {snapshot && coverOpen ? (
        <CoverSheet
          visible
          month={month}
          snapshot={snapshot}
          onClose={closeCover}
          onSave={async (covers) => {
            const before = await repo.load();
            const prev = covers.map((cvr) => ({
              id: cvr.overspentId,
              amount: repo.assigned(cvr.overspentId, month, before),
            }));
            const fromPrev = covers.map((cvr) => ({
              id: cvr.fromId,
              amount: cvr.fromId === '__left_to_plan__' ? 0n : repo.assigned(cvr.fromId, month, before),
            }));
            const r = await repo.coverOverspending(month, covers);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.covered'), () => {
              void (async () => {
                for (const p of prev) await repo.setAssigned(p.id, month, p.amount);
                for (const p of fromPrev) {
                  if (p.id !== '__left_to_plan__') await repo.setAssigned(p.id, month, p.amount);
                }
              })();
            });
            closeCover();
          }}
        />
      ) : null}

      <TemplatesSheet visible={templatesOpen} month={month} onClose={() => setTemplatesOpen(false)} />
    </AppFrame>
  );
}

/** D12 — web in-grid Planned edit: Enter saves, Tab saves and moves down. */
function InlinePlannedInput({
  catId,
  assigned,
  onCommit,
  onCancel,
}: {
  catId: string;
  assigned: bigint;
  onCommit: (amount: bigint, andNext: boolean) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(() => toInputText(assigned));
  const [minor, setMinor] = useState<bigint | null>(assigned);
  const done = useRef(false);
  const commit = (andNext: boolean) => {
    if (done.current) return;
    done.current = true;
    if (minor === null || minor < 0n) {
      onCancel();
      return;
    }
    onCommit(minor, andNext);
  };
  return (
    <RNTextInput
      testID={`budget-planned-inline-${catId}`}
      accessibilityLabel={t('budget.editPlanned', { name: catId })}
      autoFocus
      value={text}
      keyboardType="decimal-pad"
      inputMode="decimal"
      selectTextOnFocus
      onChangeText={(next) => {
        setText(next);
        if (next.trim() === '') {
          setMinor(null);
          return;
        }
        const parsed = parseAmount(next);
        setMinor(parsed.ok ? parsed.minor : null);
      }}
      onSubmitEditing={() => commit(false)}
      onKeyPress={(e) => {
        const key = e.nativeEvent.key;
        if (key === 'Tab') {
          (e as { preventDefault?: () => void }).preventDefault?.();
          commit(true);
        } else if (key === 'Escape') {
          done.current = true;
          onCancel();
        }
      }}
      onBlur={() => commit(false)}
      style={{
        width: 88,
        minHeight: 44,
        textAlign: 'right',
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.link,
        borderRadius: tokens.radius['rounded-sm'],
        paddingHorizontal: sp['spacing-xs'],
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}

function BudgetSummaryStrip({
  snapshot,
  budget,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  budget: ReturnType<typeof budgetForMonth>;
}) {
  let planned = 0n;
  let spent = 0n;
  for (const cat of budgetCategories(snapshot)) {
    const row = budget.rows.get(cat.id);
    if (!row) continue;
    planned += row.carried + row.assigned;
    spent += row.activity;
  }
  return (
    <View testID="budget-summary-strip" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryPlanned', { amount: formatNaira(planned) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summarySpent', { amount: formatNaira(spent) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryLeft', { amount: formatNaira(budget.leftToPlan) })}
      </Text>
    </View>
  );
}

function BudgetSummaryColumn({
  snapshot,
  month,
  budget,
  planned,
  incomeReceived,
  budgetableIncome,
  byType,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  month: string;
  budget: ReturnType<typeof budgetForMonth>;
  planned: bigint;
  incomeReceived: bigint;
  budgetableIncome: bigint;
  byType: ReturnType<typeof summaryByType>;
}) {
  let spent = 0n;
  for (const cat of budgetCategories(snapshot)) {
    const row = budget.rows.get(cat.id);
    if (row) spent += row.activity;
  }
  const incomeBase = budgetableIncome > 0n ? budgetableIncome : 1n;
  const ringValue =
    budget.leftToPlan <= 0n
      ? 1
      : Math.max(0, Math.min(1, Number(((incomeBase - budget.leftToPlan) * 1000n) / incomeBase) / 1000));

  return (
    <View
      testID="budget-summary-column"
      style={{
        width: 220,
        gap: sp['spacing-md'],
        padding: sp['spacing-md'],
        backgroundColor: c['primary-bg-subdued-hover'],
        borderRadius: tokens.radius['rounded-md'],
      }}
    >
      <Text variant="heading-sm">{t('budget.summaryTitle')}</Text>
      <View style={{ alignItems: 'center', gap: sp['spacing-sm'] }}>
        <ProgressRing value={ringValue} label={t('budget.summaryRingLabel')} size={72} />
        <Text variant="caption" testID="budget-summary-left-to-plan">
          {t('budget.summaryLeft', { amount: formatNaira(budget.leftToPlan) })}
        </Text>
      </View>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryIncomePlanned', { amount: formatNaira(budgetableIncome) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryIncomeReceived', { amount: formatNaira(incomeReceived) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summarySpendingPlanned', { amount: formatNaira(planned) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summarySpendingSpent', { amount: formatNaira(spent) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summarySavings', { amount: formatNaira(byType.savings.planned) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryTypeFixed', { amount: formatNaira(byType.fixed.planned) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryTypeFlexible', { amount: formatNaira(byType.flexible.planned) })}
      </Text>
      <Text variant="caption" tone="textSecondary">
        {t('budget.summaryTypeNonMonthly', { amount: formatNaira(byType.nonMonthly.planned) })}
      </Text>
      <Text variant="micro" tone="textSecondary">
        {monthLabel(month)}
      </Text>
    </View>
  );
}

function BudgetBanner({
  style,
  leftToPlan,
  planned,
  budgetableIncome,
  overspentCount,
  onCover,
}: {
  style: 'tracking' | 'envelope';
  leftToPlan: bigint;
  planned: bigint;
  budgetableIncome: bigint;
  overspentCount: number;
  onCover: () => void;
}) {
  if (style === 'tracking') {
    return (
      <Banner
        testID="budget-banner"
        message={t('budget.trackingBanner', {
          planned: formatNaira(planned),
          income: formatNaira(budgetableIncome),
        })}
      />
    );
  }
  const over = leftToPlan < 0n;
  return (
    <View
      testID="budget-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: sp['spacing-md'],
        flexWrap: 'wrap',
        backgroundColor: tokens.color['primary-bg-subdued-hover'],
        borderRadius: tokens.radius['rounded-md'],
        padding: sp['spacing-md'],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'], flexShrink: 1 }}>
        {over ? <View testID="budget-over-dot" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ruby }} /> : null}
        <Text>
          {over
            ? t('budget.plannedMore', { amount: formatNaira(-leftToPlan) })
            : t('budget.leftToPlan', { amount: formatNaira(leftToPlan) })}
        </Text>
      </View>
      {overspentCount > 0 ? (
        <Button testID="budget-banner-cover" kind="secondary" label={t('budget.coverOverspending', { count: overspentCount })} onPress={onCover} />
      ) : null}
    </View>
  );
}

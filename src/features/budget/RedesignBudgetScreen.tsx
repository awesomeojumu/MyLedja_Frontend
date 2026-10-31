import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';

import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import type { Snapshot } from '@/data/workspace/repository';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import {
  RedesignAmount,
  RedesignBanner,
  RedesignButton,
  RedesignChip,
  RedesignCouldNotLoad,
  RedesignEmpty,
  RedesignIcon,
  RedesignInlineError,
  RedesignProgress,
  RedesignSheet,
  RedesignSkeleton,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { AppFrame } from '@/features/frame/AppFrame';
import { dueDatesInMonth } from '@/features/plan/recurrence';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { monthOf } from '@/ledger';
import { formatNaira } from '@/money';
import { useToast } from '@/design/components';

import {
  barFor,
  budgetableIncomeOf,
  budgetCategories,
  budgetForMonth,
  groupedBudgetCategories,
  groupTotals,
  incomeReceivedOf,
  nextMonth,
  overspentCategories,
  plannedTotalOf,
  prevMonth,
  rowFor,
  type BudgetGroupBy,
} from './helpers';
import { CoverSheet } from './CoverSheet';
import { EditAmountSheet } from './EditAmountSheet';
import { MoveMoneySheet } from './MoveMoneySheet';
import { TemplatesSheet } from './TemplatesSheet';

const sp = tokens.space;
const density = tokens.density.touch;
/** Figma amounts-hidden (13:6880) — six dots with naira. */
const PRIVACY = '₦ ••••••';

function groupLabel(group: string): string {
  if (group in catalogue) return t(group as TextKey);
  if (group === 'fixed' || group === 'flexible' || group === 'nonMonthly' || group === 'savings') {
    return t(`budget.type.${group}` as TextKey);
  }
  return group;
}

function monthLongLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${t(`date.monthLong.${m}` as TextKey)} ${y}`;
}

function monthNameOnly(month: string): string {
  const m = Number(month.slice(5, 7));
  return t(`date.monthLong.${m}` as TextKey);
}

function money(minor: bigint, privacy: boolean, signed = false): string {
  if (privacy) return PRIVACY;
  return formatNaira(minor, signed ? { signed: true } : undefined);
}

function dueCaption(snapshot: Snapshot, categoryId: string, month: string): string | null {
  const bill = snapshot.recurring.find(
    (r) => r.categoryId === categoryId && (r.kind === 'bill' || r.kind === 'subscription') && !r.cancelled,
  );
  if (!bill) return null;
  const dates = dueDatesInMonth(bill.rule, month, bill.startDate, bill.endDate);
  const due = dates[0];
  if (!due) return null;
  const day = Number(due.slice(8, 10));
  const m = Number(due.slice(5, 7));
  return t('budget.redesign.due', { date: `${day} ${t(`date.monthLong.${m}` as TextKey)}` });
}

function rowCaption(
  snapshot: Snapshot,
  categoryId: string,
  month: string,
  spent: string,
  planned: string,
): string {
  const base = t('budget.redesign.ofPlan', { spent, planned });
  const due = dueCaption(snapshot, categoryId, month);
  return due ? `${base}, ${due}` : base;
}

/**
 * Page 06 redesign — Figma Mobile `3:978` (+ empty/plan/loading/hidden/choose-month)
 * and Dashboard web `31:1245`. Specs win on flows/API; Figma on layout.
 * Flagged behind EXPO_PUBLIC_REDESIGN.
 */
export function RedesignBudgetScreen() {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const { privacy } = useDesign();
  const router = useRouter();
  const size = useSizeClass();
  const { width, height } = useWindowDimensions();
  const phone = size === 'phone';
  const landscape = width > height;
  const tabletLandscape = size === 'tablet' && landscape;
  const wideEnough = size === 'desktop' || size === 'wide' || tabletLandscape;
  const params = useGlobalSearchParams<{
    plan?: string;
    move?: string;
    cover?: string;
    months?: string;
    group?: string;
    templates?: string;
  }>();

  const [month, setMonth] = useState(() => monthOf(today()));
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [chooseMonthOpen, setChooseMonthOpen] = useState(false);
  const swipeStartX = useRef<number | null>(null);

  // Figma Fixed / Flexible sections → group by type
  const groupBy: BudgetGroupBy = params.group === 'groups' ? 'groups' : 'type';
  const monthSpan: '1' | '3' = params.months === '3' && wideEnough ? '3' : '1';
  const editId = params.plan ?? null;
  const moveOpen = params.move !== undefined;
  const moveFrom = params.move && params.move !== '1' ? params.move : null;
  const coverOpen = params.cover === '1';
  const templatesOpen = params.templates === '1';

  const openEdit = (catId: string) => router.setParams({ plan: catId });
  const closeEdit = () => router.setParams({ plan: undefined });
  const openMove = (fromId?: string) => router.setParams({ move: fromId ?? '1' });
  const closeMove = () => router.setParams({ move: undefined });
  const openCover = () => router.setParams({ cover: '1' });
  const closeCover = () => router.setParams({ cover: undefined });
  const setTemplatesOpen = (open: boolean) => router.setParams({ templates: open ? '1' : undefined });

  const model = useMemo(() => {
    if (!snapshot) return null;
    try {
      const cats = budgetCategories(snapshot);
      const budget = budgetForMonth(snapshot, month);
      const groups = groupedBudgetCategories(snapshot, groupBy);
      const planned = plannedTotalOf(snapshot, month);
      const spent = cats.reduce((s, c) => s + (budget.rows.get(c.id)?.activity ?? 0n), 0n);
      const leftToSpend = planned - spent;
      return {
        cats,
        budget,
        groups,
        overspent: overspentCategories(snapshot, month),
        style: snapshot.settings.budgetStyle,
        planned,
        spent,
        leftToSpend,
        budgetableIncome: budgetableIncomeOf(snapshot, month),
        incomeReceived: incomeReceivedOf(snapshot, month),
      };
    } catch {
      return null;
    }
  }, [snapshot, month, groupBy]);

  const categoryOrder = useMemo(() => {
    if (!model) return [];
    return model.groups.flatMap(([, cats]) => cats.map((cat) => cat.id));
  }, [model]);

  const savePlanned = async (amount: bigint, opts: { carryOver: boolean; note: string }) => {
    if (!editId || !snapshot) return;
    setError(null);
    const cat = snapshot.categories.find((c) => c.id === editId);
    const prevAmount = repo.assigned(editId, month, snapshot);
    const prevCarry = cat?.carryOver ?? false;
    const prevNote = snapshot.assignNotes.get(`${editId}:${month}`) ?? '';
    if (cat && cat.carryOver !== opts.carryOver) {
      await repo.updateCategory({ ...cat, carryOver: opts.carryOver });
    }
    await repo.setAssigned(editId, month, amount, { note: opts.note });
    toast.show(t('budget.planSaved'), () => {
      void (async () => {
        const current = await repo.load();
        const c2 = current.categories.find((x) => x.id === editId);
        if (c2 && c2.carryOver !== prevCarry) await repo.updateCategory({ ...c2, carryOver: prevCarry });
        await repo.setAssigned(editId, month, prevAmount, { note: prevNote });
      })();
    });
    closeEdit();
  };

  const copyLastMonth = async () => {
    if (!snapshot) return;
    setError(null);
    const prev = prevMonth(month);
    for (const cat of budgetCategories(snapshot)) {
      const amount = repo.assigned(cat.id, prev, snapshot);
      if (amount > 0n) await repo.setAssigned(cat.id, month, amount);
    }
    toast.show(t('budget.planSaved'));
  };

  const leftToPlan = model?.budget.leftToPlan ?? 0n;
  const showEmptyMonth = !!model && model.cats.length > 0 && model.planned === 0n;

  const topTrailing = (
    <Pressable
      testID="budget-choose-month"
      accessibilityRole="button"
      accessibilityLabel={t('budget.redesign.chooseMonth')}
      onPress={() => setChooseMonthOpen(true)}
      style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="calendar" size={tokens.size['icon-lg']} color={theme.text} />
    </Pressable>
  );

  const summaryCard = model ? (
    <View
      testID="budget-summary"
      style={{
        backgroundColor: theme.surface,
        borderRadius: tokens.shape['radius-lg'],
        padding: sp.lg,
        gap: sp.md,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <RedesignText variant="label" tone="textSecondary">
        {t('budget.redesign.leftToSpend')}
      </RedesignText>
      <RedesignAmount
        text={formatNaira(model.leftToSpend < 0n ? -model.leftToSpend : model.leftToSpend)}
        sign={privacy ? null : model.leftToSpend < 0n ? '−' : null}
        hidden={privacy}
        sizeVariant="display"
        testID="budget-left-to-spend"
      />
      <RedesignProgress
        testID="budget-summary-bar"
        value={Number(model.spent)}
        max={Number(model.planned > 0n ? model.planned : 1n)}
        overPlan={model.leftToSpend < 0n}
      />
      <SummaryLine label={t('budget.redesign.incomeThisMonth')} value={money(model.incomeReceived, privacy, true)} />
      <SummaryLine label={t('budget.col.planned')} value={money(model.planned, privacy)} />
      <SummaryLine label={t('budget.col.spent')} value={money(model.spent, privacy)} />
      {!phone && model.style === 'envelope' && leftToPlan > 0n ? (
        <View style={{ gap: sp.sm, marginTop: sp.sm }}>
          <RedesignText>{t('budget.redesign.notPlannedYet', { amount: money(leftToPlan, privacy) })}</RedesignText>
          <RedesignText variant="helper" tone="textSecondary">
            {t('budget.redesign.planRestBody')}
          </RedesignText>
          <RedesignButton
            testID="budget-plan-the-rest"
            label={t('budget.redesign.planTheRest')}
            onPress={() => {
              const first = categoryOrder[0];
              if (first) openEdit(first);
            }}
            fullWidth
          />
        </View>
      ) : null}
    </View>
  ) : null;

  const groupsList =
    model && snapshot ? (
      <View style={{ gap: sp.lg, flex: 1 }}>
        {model.groups.map(([group, cats]) => {
          const isCollapsed = !!collapsed[group];
          const totals = groupTotals(
            snapshot,
            month,
            cats.map((x) => x.id),
          );
          const label = groupLabel(group);
          return (
            <View key={group} testID={`budget-group-${group}`} style={{ gap: sp.xs }}>
              <Pressable
                testID={`budget-group-toggle-${group}`}
                accessibilityRole="button"
                accessibilityLabel={isCollapsed ? t('budget.expandGroup', { name: label }) : t('budget.collapseGroup', { name: label })}
                onPress={() => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: density.minTarget }}
              >
                <RedesignText variant="label">{label}</RedesignText>
                <RedesignText variant="helper" tone="textSecondary" testID={`budget-group-total-${group}`}>
                  {phone
                    ? money(totals.planned, privacy)
                    : t('budget.redesign.groupPlanned', { amount: money(totals.planned, privacy) })}
                </RedesignText>
              </Pressable>
              {isCollapsed ? null : (
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: tokens.shape['radius-lg'],
                    borderWidth: 1,
                    borderColor: theme.border,
                    overflow: 'hidden',
                  }}
                >
                  {cats.map((cat, idx) => {
                    const row = rowFor(snapshot, month, cat.id);
                    const state = barFor(snapshot, month, cat.id);
                    const plan = row.carried + row.assigned;
                    const over = state === 'over';
                    const caption = privacy
                      ? rowCaption(snapshot, cat.id, month, PRIVACY, PRIVACY)
                      : rowCaption(snapshot, cat.id, month, formatNaira(row.activity), formatNaira(plan));
                    return (
                      <Pressable
                        key={cat.id}
                        testID={`budget-row-${cat.id}`}
                        accessibilityRole="button"
                        onPress={() => openEdit(cat.id)}
                        onLongPress={() => openMove(cat.id)}
                        style={{
                          padding: sp.md,
                          gap: sp.sm,
                          borderTopWidth: idx === 0 ? 0 : 1,
                          borderTopColor: theme.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                          <Pressable
                            testID={`budget-name-${cat.id}`}
                            accessibilityRole="link"
                            onPress={() => router.push(`/budget/category/${cat.id}`)}
                            style={{ flex: 1 }}
                          >
                            <RedesignText>{cat.name}</RedesignText>
                            {!phone && dueCaption(snapshot, cat.id, month) ? (
                              <RedesignText variant="helper" tone="textSecondary">
                                {dueCaption(snapshot, cat.id, month)}
                              </RedesignText>
                            ) : null}
                          </Pressable>
                          {over ? (
                            <View
                              testID={`budget-over-${cat.id}`}
                              style={{
                                borderWidth: 1,
                                borderColor: theme.primary,
                                borderRadius: tokens.shape['radius-pill'],
                                paddingHorizontal: sp.sm,
                                paddingVertical: 2,
                              }}
                            >
                              <RedesignText variant="caption">{t('redesign.overPlan')}</RedesignText>
                            </View>
                          ) : null}
                        </View>
                        {phone ? (
                          <>
                            <RedesignText variant="helper" tone="textSecondary">
                              {caption}
                            </RedesignText>
                            <RedesignProgress
                              testID={`budget-bar-${cat.id}`}
                              value={Number(row.activity)}
                              max={Number(plan > 0n ? plan : 1n)}
                              overPlan={over}
                            />
                          </>
                        ) : (
                          <>
                            <RedesignProgress
                              testID={`budget-bar-${cat.id}`}
                              value={Number(row.activity)}
                              max={Number(plan > 0n ? plan : 1n)}
                              overPlan={over}
                            />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp.md }}>
                              <Pressable testID={`budget-planned-${cat.id}`} onPress={() => openEdit(cat.id)}>
                                <RedesignText variant="helper">
                                  {t('budget.col.planned')}: {money(row.assigned, privacy)}
                                </RedesignText>
                              </Pressable>
                              <Pressable
                                testID={`budget-spent-${cat.id}`}
                                accessibilityRole="link"
                                onPress={() =>
                                  router.push({ pathname: '/transactions', params: { category: cat.id, month } })
                                }
                              >
                                <RedesignText variant="helper" tone="primary">
                                  {t('budget.col.spent')}: {money(row.activity, privacy)}
                                </RedesignText>
                              </Pressable>
                              <RedesignText
                                testID={`budget-remaining-${cat.id}`}
                                variant="helper"
                                tone={over ? 'danger' : 'textSecondary'}
                              >
                                {t('budget.redesign.left')}: {money(row.available, privacy)}
                              </RedesignText>
                            </View>
                          </>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
        <RedesignButton
          testID="budget-add-category"
          kind="secondary"
          label={t('budget.redesign.addCategory')}
          onPress={() => router.push('/settings')}
          fullWidth
        />
      </View>
    ) : null;

  return (
    <AppFrame title={t('budget.title')} trailing={phone ? topTrailing : undefined}>
      <View
        testID="redesign-budget"
        style={{ flex: 1 }}
        onTouchStart={(e) => {
          if (!phone) return;
          swipeStartX.current = e.nativeEvent.pageX;
        }}
        onTouchEnd={(e) => {
          if (!phone) return;
          const start = swipeStartX.current;
          swipeStartX.current = null;
          if (start == null) return;
          const dx = e.nativeEvent.pageX - start;
          if (dx < -40) setMonth(nextMonth(month));
          else if (dx > 40) setMonth(prevMonth(month));
        }}
      >
        <ScrollView contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xl }}>
          {/* Month strip — Figma 3:1026 */}
          <View
            testID="budget-month-swipe"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Pressable
              testID="budget-prev-month"
              accessibilityRole="button"
              accessibilityLabel={t('date.previousMonth')}
              onPress={() => setMonth(prevMonth(month))}
              style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="chevron-left" size={tokens.size['icon-lg']} color={theme.textSecondary} />
            </Pressable>
            <RedesignText testID="budget-month" variant="headline" accessibilityRole="header">
              {monthLongLabel(month)}
            </RedesignText>
            <Pressable
              testID="budget-next-month"
              accessibilityRole="button"
              accessibilityLabel={t('date.nextMonth')}
              onPress={() => setMonth(nextMonth(month))}
              style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
            >
              <RedesignIcon name="chevron-right" size={tokens.size['icon-lg']} color={theme.textSecondary} />
            </Pressable>
          </View>

          {!phone && wideEnough ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, alignItems: 'center' }}>
              <RedesignChip
                testID="budget-span-1"
                label={t('budget.oneMonth')}
                selected={monthSpan === '1'}
                onPress={() => router.setParams({ months: undefined })}
              />
              <RedesignChip
                testID="budget-span-3"
                label={t('budget.threeMonths')}
                selected={monthSpan === '3'}
                onPress={() => router.setParams({ months: '3' })}
              />
              <RedesignChip testID="budget-copy-last" label={t('budget.menuCopyLast')} onPress={() => void copyLastMonth()} />
              <RedesignChip testID="budget-move" label={t('budget.moveMoney')} onPress={() => openMove()} />
              {snapshot && snapshot.assigns.size > 0 ? (
                <RedesignChip testID="budget-templates" label={t('budget.templates')} onPress={() => setTemplatesOpen(true)} />
              ) : null}
            </View>
          ) : null}

          {loadError ? (
            <RedesignCouldNotLoad
              onRetry={() => {
                setLoadError(false);
                void repo.load().catch(() => setLoadError(true));
              }}
            />
          ) : !model && !snapshot ? (
            <View testID="budget-loading" style={{ gap: sp.md }}>
              <RedesignSkeleton height={120} />
              <RedesignSkeleton height={68} />
              <RedesignSkeleton height={68} />
            </View>
          ) : model && model.cats.length === 0 ? (
            <RedesignEmpty
              title={t('budget.emptyTitle')}
              body={t('budget.emptyBody')}
              actionLabel={t('budget.emptyAction')}
              onAction={() => router.push('/')}
            />
          ) : showEmptyMonth ? (
            <RedesignEmpty
              title={t('budget.redesign.emptyTitle', { month: monthNameOnly(month) })}
              body={t('budget.redesign.emptyBody')}
              secondaryLabel={t('budget.menuCopyLast')}
              onSecondary={() => void copyLastMonth()}
              actionLabel={t('budget.redesign.planYourBudget')}
              onAction={() => {
                const first = categoryOrder[0];
                if (first) openEdit(first);
              }}
            />
          ) : model ? (
            <>
              {phone ? summaryCard : null}

              {/* Not planned / tracking banner — phone */}
              {phone && model.style === 'envelope' && leftToPlan !== 0n ? (
                leftToPlan > 0n ? (
                  <View
                    testID="budget-not-planned"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp.md,
                      backgroundColor: theme.primarySoft,
                      borderRadius: tokens.shape['radius-md'],
                      padding: sp.md,
                    }}
                  >
                    <RedesignText style={{ flex: 1 }}>
                      {t('budget.redesign.notPlannedYet', { amount: money(leftToPlan, privacy) })}
                    </RedesignText>
                    <RedesignButton
                      testID="budget-plan-it"
                      kind="link"
                      label={t('budget.redesign.planIt')}
                      onPress={() => {
                        const first = categoryOrder[0];
                        if (first) openEdit(first);
                      }}
                    />
                  </View>
                ) : (
                  <RedesignBanner
                    testID="budget-over-planned"
                    message={t('budget.overPlanned', { amount: money(-leftToPlan, privacy) })}
                  />
                )
              ) : null}
              {model.style !== 'envelope' ? (
                <RedesignBanner
                  testID="budget-tracking-banner"
                  message={t('budget.trackingBanner', {
                    planned: money(model.planned, privacy),
                    income: money(model.budgetableIncome, privacy),
                  })}
                />
              ) : null}
              {model.overspent.length > 0 ? (
                <RedesignBanner
                  testID="budget-cover-banner"
                  message={t('budget.coverOverspending', { count: model.overspent.length })}
                  actionLabel={t('budget.coverAll')}
                  onAction={openCover}
                />
              ) : null}

              {error ? <RedesignInlineError message={error} /> : null}

              {phone ? (
                groupsList
              ) : (
                <View style={{ flexDirection: wideEnough ? 'row' : 'column', gap: sp.lg, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, minWidth: 0, width: '100%' }}>{groupsList}</View>
                  {wideEnough ? <View style={{ width: 320 }}>{summaryCard}</View> : summaryCard}
                </View>
              )}
            </>
          ) : (
            <View testID="budget-loading" style={{ gap: sp.md }}>
              <RedesignSkeleton height={120} />
              <RedesignSkeleton height={68} />
            </View>
          )}
        </ScrollView>
      </View>

      {chooseMonthOpen ? (
        <ChooseMonthSheet
          month={month}
          onClose={() => setChooseMonthOpen(false)}
          onPick={(m) => {
            setMonth(m);
            setChooseMonthOpen(false);
          }}
        />
      ) : null}

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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <RedesignText variant="helper" tone="textSecondary">
        {label}
      </RedesignText>
      <RedesignText variant="helper" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </RedesignText>
    </View>
  );
}

/** Figma choose-month sheet (13:…): year strip + 12-month grid + Show {month}. */
function ChooseMonthSheet({
  month,
  onClose,
  onPick,
}: {
  month: string;
  onClose: () => void;
  onPick: (m: string) => void;
}) {
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const [picked, setPicked] = useState(month);

  return (
    <RedesignSheet visible testID="budget-choose-month-sheet" title={t('budget.redesign.chooseMonth')} onClose={onClose}>
      <View style={{ gap: sp.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            testID="budget-choose-year-prev"
            accessibilityRole="button"
            onPress={() => {
              const next = year - 1;
              setYear(next);
              setPicked(`${next}-${picked.slice(5)}`);
            }}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="chevron-left" size={tokens.size['icon-lg']} color={theme.textSecondary} />
          </Pressable>
          <RedesignText testID="budget-choose-year" variant="headline">
            {String(year)}
          </RedesignText>
          <Pressable
            testID="budget-choose-year-next"
            accessibilityRole="button"
            onPress={() => {
              const next = year + 1;
              setYear(next);
              setPicked(`${next}-${picked.slice(5)}`);
            }}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="chevron-right" size={tokens.size['icon-lg']} color={theme.textSecondary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm }}>
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const value = `${year}-${String(m).padStart(2, '0')}`;
            const selected = picked === value;
            return (
              <View key={value} style={{ width: '31%' }}>
                <RedesignChip
                  testID={`budget-month-option-${value}`}
                  label={t(`date.monthLong.${m}` as TextKey)}
                  selected={selected}
                  onPress={() => setPicked(value)}
                />
              </View>
            );
          })}
        </View>
        <RedesignButton
          testID="budget-show-month"
          label={t('budget.redesign.showMonth', { month: monthLongLabel(picked) })}
          onPress={() => onPick(picked)}
          fullWidth
        />
      </View>
    </RedesignSheet>
  );
}

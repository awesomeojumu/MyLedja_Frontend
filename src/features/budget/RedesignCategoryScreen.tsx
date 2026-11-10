import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { budgetAssignId, type Category } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useDesign } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import {
  RedesignButton,
  RedesignCouldNotLoad,
  RedesignEmpty,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignListRow,
  RedesignProgress,
  RedesignSkeleton,
  RedesignText,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useToast } from '@/design/components';
import { useOptionalAddTransaction } from '@/features/transactions/AddTransaction';
import { ledgerMessage, rowsFor, today } from '@/features/transactions/helpers';
import { parseTags } from '@/features/transactions/tags';
import { catalogue, t, type TextKey } from '@/i18n';
import { monthOf } from '@/ledger';
import { formatNaira } from '@/money';

import {
  assignedOf,
  budgetCategories,
  categoryActivity,
  categoryActiveRules,
  categoryBurnRate,
  categoryMerchantBreakdown,
  categoryTemplateLines,
  categoryUpcomingBills,
  monthsEndingAt,
  overspentCategories,
  periodTotals,
  rowFor,
  shortMonth,
  sixMonthAverage,
} from './helpers';
import { selectHaptic } from './haptics';
import { DeleteCategorySheet, EditCategorySheet, type CategoryDraft } from './CategorySheets';
import { EditAmountSheet } from './EditAmountSheet';
import { MoveMoneySheet } from './MoveMoneySheet';
import { CoverSheet } from './CoverSheet';

const sp = tokens.space;
const density = tokens.density.touch;
const PRIVACY = '₦ ••••••';

function monthLongLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${t(`date.monthLong.${m}` as TextKey)} ${y}`;
}

function dayMonthLong(iso: string): string {
  const d = Number(iso.slice(8, 10));
  const m = Number(iso.slice(5, 7));
  return `${d} ${t(`date.monthLong.${m}` as TextKey)}`;
}

function money(minor: bigint, privacy: boolean, signed = false): string {
  if (privacy) return PRIVACY;
  return formatNaira(minor, signed ? { signed: true } : undefined);
}

function groupLabel(group: string): string {
  if (group in catalogue) return t(group as TextKey);
  return group;
}

function DetailChrome({
  title,
  onBack,
  trailing,
  children,
}: {
  title: string;
  onBack: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RedesignShell>
      <SafeAreaView testID="redesign-category-frame" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <View
          testID="redesign-top-bar"
          style={{
            minHeight: Math.max(tokens.size['top-bar'], tokens.frame.topBarHeadroom),
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: sp.sm,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderColor: theme.border,
            gap: sp.xs,
          }}
        >
          <Pressable
            testID="category-back"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={onBack}
            style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <RedesignIcon name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <RedesignText variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </RedesignText>
          {trailing ?? <View style={{ width: density.minTarget }} />}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaView>
    </RedesignShell>
  );
}

/**
 * Page 07 redesign — Figma Mobile `3:1107` (+ Change plan / Move money / Edit) and Dashboard web `31:1552`.
 * Specs win on Edit/Delete flows (PU-11/12 sheets); Figma on layout. Flagged behind EXPO_PUBLIC_REDESIGN.
 */
export function RedesignCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const params = useGlobalSearchParams<{ category?: string; plan?: string; move?: string; cover?: string; table?: string }>();
  const { snapshot, repo } = useWorkspace();
  const { privacy } = useDesign();
  const toast = useToast();
  const router = useRouter();
  const size = useSizeClass();
  const phone = size === 'phone';
  const wide = size === 'desktop' || size === 'wide';
  const addTx = useOptionalAddTransaction();

  const currentMonth = monthOf(today());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? currentMonth;
  const isHistorical = activeMonth !== currentMonth;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);

  const category = snapshot?.categories.find((c) => c.id === id);
  const isNew = params.category === 'new';
  const editOpen = isNew || params.category === id || params.category === 'edit';
  const planOpen = params.plan === '1' || params.plan === id;
  const moveOpen = params.move !== undefined;
  const coverOpen = params.cover === '1';
  const tableView = params.table === '1';

  const openEdit = () => router.setParams({ category: id });
  const closeEdit = () => router.setParams({ category: undefined });
  const openPlan = () => router.setParams({ plan: '1' });
  const closePlan = () => router.setParams({ plan: undefined });
  const openMove = () => router.setParams({ move: '1' });
  const closeMove = () => router.setParams({ move: undefined });
  const openCover = () => router.setParams({ cover: '1' });
  const closeCover = () => router.setParams({ cover: undefined });

  const model = useMemo(() => {
    if (!snapshot || !category) return null;
    const row = rowFor(snapshot, activeMonth, category.id);
    const avg = sixMonthAverage(snapshot, category.id, activeMonth);
    const months6 = monthsEndingAt(activeMonth, 6);
    const totals = periodTotals(snapshot.events);
    const chartRows = months6.map((m) => {
      const planned = assignedOf(snapshot, category.id, m);
      const spent = categoryActivity(totals, m, category.id);
      return { label: shortMonth(m), value: spent, planned, month: m, over: spent > planned && planned > 0n };
    });
    const txs = rowsFor(snapshot).filter(
      (r) =>
        monthOf(r.event.date) === activeMonth &&
        r.event.lines.some((l) => l.ledgerAccountId === category.id) &&
        r.event.type !== 'transfer' &&
        r.event.type !== 'opening_balance',
    );
    const plan = row.carried + row.assigned;
    const over = row.available < 0n ? -row.available : 0n;
    const donors = budgetCategories(snapshot)
      .filter((c) => c.id !== category.id)
      .map((c) => ({ cat: c, available: rowFor(snapshot, activeMonth, c.id).available }))
      .filter((x) => x.available > 0n)
      .sort((a, b) => (a.available > b.available ? -1 : 1));
    const donor = over > 0n ? donors.find((d) => d.available >= over) ?? donors[0] : undefined;

    const burnRate = categoryBurnRate(row, activeMonth, today());
    const merchants = categoryMerchantBreakdown(snapshot, category.id, activeMonth);
    const upcoming = categoryUpcomingBills(snapshot, category.id, activeMonth);
    const rules = categoryActiveRules(snapshot, category.id);
    const note = snapshot.assignNotes.get(budgetAssignId(category.id, activeMonth)) ?? '';

    return {
      row,
      avg,
      chartRows,
      txs,
      plan,
      over,
      donor,
      burnRate,
      merchants,
      upcoming,
      rules,
      note,
      templates: categoryTemplateLines(snapshot, category.id),
      overspent: overspentCategories(snapshot, activeMonth),
    };
  }, [snapshot, category, activeMonth]);

  const saveCategory = async (draft: CategoryDraft) => {
    if (isNew || !category) {
      await repo.addCategory({
        name: draft.name,
        kind: draft.kind,
        group: draft.group,
        icon: draft.icon,
        budgetType: draft.budgetType,
        essential: draft.essential,
        hidden: draft.hidden,
      });
      toast.show(t('category.saved'));
      closeEdit();
      router.replace('/budget');
      return;
    }
    const next: Category = {
      ...category,
      name: draft.name,
      group: draft.group,
      kind: draft.kind,
      budgetType: draft.budgetType,
      icon: draft.icon,
      essential: draft.essential,
      hidden: draft.hidden,
    };
    await repo.updateCategory(next);
    toast.show(t('category.saved'));
    closeEdit();
  };

  const savePlanned = async (amount: bigint, opts: { carryOver: boolean; note: string }) => {
    if (!category || !snapshot) return;
    const prevAmount = repo.assigned(category.id, activeMonth, snapshot);
    const prevCarry = category.carryOver;
    const prevNote = snapshot.assignNotes.get(`${category.id}:${activeMonth}`) ?? '';
    if (category.carryOver !== opts.carryOver) {
      await repo.updateCategory({ ...category, carryOver: opts.carryOver });
    }
    await repo.setAssigned(category.id, activeMonth, amount, { note: opts.note });
    toast.show(t('budget.planSaved'), () => {
      void (async () => {
        const current = await repo.load();
        const c2 = current.categories.find((x) => x.id === category.id);
        if (c2 && c2.carryOver !== prevCarry) await repo.updateCategory({ ...c2, carryOver: prevCarry });
        await repo.setAssigned(category.id, activeMonth, prevAmount, { note: prevNote });
      })();
    });
    closePlan();
  };

  if (loadError) {
    return (
      <DetailChrome title={t('category.title')} onBack={() => router.replace('/budget')}>
        <RedesignCouldNotLoad
          onRetry={() => {
            setLoadError(false);
            void repo.load().catch(() => setLoadError(true));
          }}
        />
      </DetailChrome>
    );
  }

  if (!snapshot) {
    return (
      <DetailChrome title={t('category.title')} onBack={() => router.replace('/budget')}>
        <View testID="category-loading" style={{ gap: sp.md, padding: sp.lg }}>
          <RedesignSkeleton height={120} />
          <RedesignSkeleton height={160} />
          <RedesignSkeleton height={80} />
        </View>
      </DetailChrome>
    );
  }

  if (!category && !isNew) {
    return (
      <DetailChrome title={t('category.title')} onBack={() => router.replace('/budget')}>
        <RedesignEmpty
          title={t('category.missingTitle')}
          body={t('category.missingBody')}
          actionLabel={t('budget.title')}
          onAction={() => router.replace('/budget')}
        />
      </DetailChrome>
    );
  }

  const title = category?.name ?? t('category.add');
  const trailing = category ? (
    <Pressable
      testID="category-edit"
      accessibilityRole="button"
      accessibilityLabel={t('category.edit')}
      onPress={openEdit}
      style={{ width: density.minTarget, height: density.minTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <RedesignIcon name="edit" size={22} color={theme.text} />
    </Pressable>
  ) : undefined;

  const maxBar = model ? model.chartRows.reduce((m, r) => (r.value > m ? r.value : m), 1n) : 1n;

  const quickActionBar =
    category && model ? (
      <View
        testID="category-quick-actions"
        style={{
          flexDirection: 'row',
          gap: sp.sm,
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <RedesignButton
            testID="category-add-tx"
            kind="primary"
            label={t('category.addTransaction')}
            onPress={() => {
              if (addTx) {
                addTx.open('expense', { categoryId: category.id, date: today() });
              } else {
                router.push({
                  pathname: '/transactions',
                  params: { new: 'expense', categoryId: category.id },
                });
              }
            }}
            fullWidth
          />
        </View>
        {model.over > 0n ? (
          <View style={{ flex: 1 }}>
            <RedesignButton
              testID="category-quick-cover"
              kind="secondary"
              label={t('category.coverAction')}
              onPress={openCover}
              fullWidth
            />
          </View>
        ) : null}
      </View>
    ) : null;

  const statusCard =
    category && model ? (
      <View
        testID="category-status"
        style={{
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.md,
        }}
      >
        {model.over > 0n ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
            <RedesignIcon name="alert" size={18} color={theme.danger} />
            <RedesignText testID="category-over-plan">
              {t('category.redesign.overPlanBy', { amount: money(model.over, privacy) })}
            </RedesignText>
          </View>
        ) : (
          <RedesignText variant="label" tone="textSecondary">
            {t(`category.budgetType.${category.budgetType}`)} · {groupLabel(category.group)}
          </RedesignText>
        )}
        <RedesignText testID="category-of-plan" variant="headline">
          {privacy
            ? t('category.redesign.ofPlan', { spent: PRIVACY, planned: PRIVACY })
            : t('category.redesign.ofPlan', {
                spent: formatNaira(model.row.activity),
                planned: formatNaira(model.plan),
              })}
        </RedesignText>
        <RedesignProgress
          testID="category-status-bar"
          value={Number(model.row.activity)}
          max={Number(model.plan > 0n ? model.plan : 1n)}
          overPlan={model.over > 0n}
        />

        {/* Burn Rate & Daily Velocity / Pacing Gauge */}
        <View testID="category-burn-rate" style={{ gap: sp.xs, paddingTop: sp.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <RedesignText testID="category-pacing-day" variant="caption" tone="textSecondary">
              {t('category.pacingDay', { day: model.burnRate.currentDay, total: model.burnRate.totalDays })}
            </RedesignText>
            {model.burnRate.pace && (
              <View
                testID="category-pacing-badge"
                style={{
                  paddingHorizontal: sp.sm,
                  paddingVertical: 2,
                  borderRadius: tokens.shape['radius-pill'],
                  backgroundColor:
                    model.burnRate.pace === 'over' || model.burnRate.pace === 'fast'
                      ? theme.primarySoft
                      : theme.surface,
                  borderWidth: 1,
                  borderColor:
                    model.burnRate.pace === 'over'
                      ? theme.danger
                      : model.burnRate.pace === 'fast'
                      ? theme.primary
                      : theme.border,
                }}
              >
                <RedesignText
                  variant="caption"
                  tone={
                    model.burnRate.pace === 'over'
                      ? 'danger'
                      : model.burnRate.pace === 'fast'
                      ? 'text'
                      : 'textSecondary'
                  }
                >
                  {model.burnRate.pace === 'over'
                    ? t('category.pacingOver')
                    : model.burnRate.pace === 'fast'
                    ? t('category.pacingFast')
                    : t('category.pacingOnTrack')}
                </RedesignText>
              </View>
            )}
          </View>
          <RedesignText testID="category-daily-velocity" variant="helper">
            {t('category.dailyVelocity', {
              spent: money(model.burnRate.dailyBurn, privacy),
              planned: money(model.burnRate.plannedDailyRate, privacy),
            })}
          </RedesignText>
          <RedesignText testID="category-pacing-forecast" variant="caption" tone="textSecondary">
            {model.burnRate.pace === 'over'
              ? t('category.paceForecastOver', { amount: money(model.over, privacy) })
              : model.burnRate.isProjectedEarly
              ? t('category.paceForecastFast', { day: model.burnRate.limitDay })
              : t('category.paceForecastOnTrack')}
          </RedesignText>
        </View>

        <View style={{ flexDirection: 'row', gap: sp.sm, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <RedesignButton testID="category-change-plan" kind="secondary" label={t('category.redesign.changePlan')} onPress={openPlan} fullWidth />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <RedesignButton testID="category-move-in" kind="secondary" label={t('category.redesign.moveMoneyIn')} onPress={openMove} fullWidth />
          </View>
        </View>
      </View>
    ) : null;

  const historyCard =
    category && model ? (
      <View
        testID="category-history"
        style={{
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.md,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('category.redesign.last6Months')}
          </RedesignText>
          <RedesignText variant="helper" tone="textSecondary" testID="category-avg">
            {t('category.redesign.average', { amount: money(model.avg, privacy) })}
          </RedesignText>
        </View>
        {tableView ? (
          <View testID="category-chart-table" style={{ gap: sp.sm }}>
            {model.chartRows.map((r) => {
              const isSelected = r.month === activeMonth;
              return (
                <Pressable
                  key={r.month}
                  testID={`category-table-${r.month}`}
                  onPress={() => {
                    selectHaptic();
                    setSelectedMonth(r.month);
                  }}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    minHeight: density.minTarget,
                    alignItems: 'center',
                    paddingHorizontal: sp.xs,
                    backgroundColor: isSelected ? theme.primarySoft : 'transparent',
                    borderRadius: tokens.shape['radius-sm'],
                  }}
                >
                  <RedesignText tone={isSelected ? 'primary' : 'text'}>{r.label}</RedesignText>
                  <RedesignText style={{ fontVariant: ['tabular-nums'] }}>{money(r.value, privacy)}</RedesignText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View testID="category-chart" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: sp.sm, height: 140 }}>
            {model.chartRows.map((r) => {
              const pct = maxBar > 0n ? Number((r.value * 100n) / maxBar) / 100 : 0;
              const isSelected = r.month === activeMonth;
              return (
                <Pressable
                  key={r.month}
                  testID={`category-bar-${r.month}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label} ${money(r.value, privacy)}`}
                  onPress={() => {
                    selectHaptic();
                    setSelectedMonth(r.month);
                  }}
                  style={{ flex: 1, alignItems: 'center', gap: sp.xs, height: '100%', justifyContent: 'flex-end' }}
                >
                  <View
                    style={{
                      width: '70%',
                      height: Math.max(4, Math.round(pct * 110)),
                      borderRadius: tokens.shape['radius-sm'],
                      backgroundColor: isSelected ? theme.primary : theme.primarySoft,
                    }}
                  />
                  <RedesignText variant="caption" tone={isSelected ? 'primary' : 'textSecondary'}>
                    {r.label}
                  </RedesignText>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable
            testID="category-view-table"
            accessibilityRole="button"
            onPress={() => router.setParams({ table: tableView ? undefined : '1' })}
          >
            <RedesignText tone="primary" style={{ textDecorationLine: 'underline' }}>
              {tableView ? t('category.redesign.viewAsChart') : t('category.redesign.viewAsTable')}
            </RedesignText>
          </Pressable>
          {isHistorical && (
            <RedesignButton
              testID="category-back-to-current-month"
              kind="soft"
              label={t('category.backToCurrentMonth')}
              onPress={() => {
                selectHaptic();
                setSelectedMonth(null);
              }}
            />
          )}
        </View>
      </View>
    ) : null;

  const merchantsCard =
    category && model ? (
      <View
        testID="category-merchants"
        style={{
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.md,
        }}
      >
        <RedesignText variant="label" tone="textSecondary">
          {t('category.topMerchants')}
        </RedesignText>
        {model.merchants.length === 0 ? (
          <RedesignText tone="textSecondary">{t('category.noMerchants')}</RedesignText>
        ) : (
          model.merchants.map((m, idx) => (
            <View key={m.name} style={{ gap: sp.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <RedesignText testID={`category-merchant-name-${idx}`}>{m.name}</RedesignText>
                <RedesignText testID={`category-merchant-spent-${idx}`} style={{ fontVariant: ['tabular-nums'] }}>
                  {money(m.amount, privacy)} ({m.percentage}%)
                </RedesignText>
              </View>
              <RedesignProgress testID={`category-merchant-bar-${idx}`} value={m.percentage} max={100} />
            </View>
          ))
        )}
      </View>
    ) : null;

  const connectedHubCard =
    category && model ? (
      <View
        testID="category-connected-hub"
        style={{
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.lg,
        }}
      >
        {/* Upcoming Bills */}
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('category.upcomingBillsTitle')}
          </RedesignText>
          {model.upcoming.bills.length === 0 ? (
            <RedesignText tone="textSecondary">{t('category.noUpcomingBills')}</RedesignText>
          ) : (
            <View style={{ gap: sp.xs }}>
              {model.upcoming.bills.map((item) => (
                <View
                  key={item.bill.id}
                  testID={`category-bill-${item.bill.id}`}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <RedesignText>{item.bill.name}</RedesignText>
                  <RedesignText style={{ fontVariant: ['tabular-nums'] }}>
                    {money(BigInt(item.bill.amountMinor), privacy)}
                  </RedesignText>
                </View>
              ))}
              <RedesignText
                testID="category-available-after-bills"
                variant="helper"
                tone="primary"
                style={{ marginTop: sp.xs }}
              >
                {t('category.availableAfterBills', { amount: money(model.upcoming.availableAfterBills, privacy) })}
              </RedesignText>
            </View>
          )}
        </View>

        {/* Auto-categorization Rules */}
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('category.autoRulesTitle')}
          </RedesignText>
          {model.rules.length === 0 ? (
            <RedesignText tone="textSecondary">{t('category.noAutoRules')}</RedesignText>
          ) : (
            model.rules.map((rule) => {
              const pattern = rule.conditions.map((c) => c.value).join(', ');
              return (
                <View key={rule.id} testID={`category-rule-${rule.id}`}>
                  <RedesignText variant="helper">
                    {t('category.ruleMatching', { pattern })}
                  </RedesignText>
                </View>
              );
            })
          )}
          <RedesignButton
            testID="category-add-rule"
            kind="link"
            label={t('category.addAutoRule')}
            onPress={() => router.push({ pathname: '/rules', params: { new: '1', categoryId: category.id } })}
          />
        </View>

        {/* Rollover cushion & Notes */}
        <View style={{ gap: sp.sm }}>
          <RedesignText variant="label" tone="textSecondary">
            {t('category.rolloverCushion')}
          </RedesignText>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <RedesignText variant="helper">{t('category.rolloverCushion')}</RedesignText>
            <RedesignText testID="category-rollover-cushion" variant="helper" style={{ fontVariant: ['tabular-nums'] }}>
              {money(model.row.carried, privacy)}
            </RedesignText>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <RedesignText variant="helper">{t('category.assignedThisMonth')}</RedesignText>
            <RedesignText testID="category-assigned-amount" variant="helper" style={{ fontVariant: ['tabular-nums'] }}>
              {money(model.row.assigned, privacy)}
            </RedesignText>
          </View>

          <View style={{ gap: sp.xs, marginTop: sp.sm }}>
            <RedesignText variant="label" tone="textSecondary">
              {t('category.noteLabel')}
            </RedesignText>
            <RedesignField
              testID="category-note-input"
              label={t('category.noteLabel')}
              value={noteDraft !== null ? noteDraft : (model.note || '')}
              onChangeText={(text) => setNoteDraft(text)}
              placeholder={t('category.notePlaceholder')}
            />
            {noteDraft !== null && noteDraft !== model.note ? (
              <RedesignButton
                testID="category-note-save"
                kind="secondary"
                label={t('category.noteSaved')}
                onPress={async () => {
                  await repo.setAssigned(category.id, activeMonth, model.row.assigned, { note: noteDraft });
                  toast.show(t('category.noteSaved'));
                }}
              />
            ) : null}
          </View>
        </View>
      </View>
    ) : null;

  const txList =
    category && model ? (
      <View style={{ gap: sp.sm }}>
        <RedesignText variant="label" tone="textSecondary">
          {phone ? t('category.redesign.transactions') : t('category.redesign.transactionsIn', { name: category.name })}
        </RedesignText>
        <View
          testID="category-transactions"
          style={{
            backgroundColor: theme.surface,
            borderRadius: tokens.shape['radius-lg'],
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          {model.txs.length === 0 ? (
            <View style={{ padding: sp.lg }}>
              <RedesignText tone="textSecondary">{t('category.noTx')}</RedesignText>
            </View>
          ) : (
            model.txs.slice(0, 12).map((row, idx) => {
              const tags = parseTags(row.event.notes ?? '');
              const tagOrCat = tags[0] ?? row.category;
              const subtitle = phone
                ? `${tagOrCat}, ${dayMonthLong(row.event.date)}`
                : `${tagOrCat} · ${row.account}`;
              const amt = privacy
                ? PRIVACY
                : `${row.amount < 0n ? '−' : row.amount > 0n ? '+' : ''}${formatNaira(row.amount < 0n ? -row.amount : row.amount)}`;
              return (
                <View
                  key={row.event.id}
                  style={{
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <RedesignListRow
                    testID={`category-tx-${row.event.id}`}
                    title={row.title}
                    subtitle={subtitle}
                    trailing={amt}
                    showChevron={false}
                    onPress={() => router.push({ pathname: '/transactions', params: { tx: row.event.id } })}
                  />
                </View>
              );
            })
          )}
        </View>
        <RedesignButton
          testID="category-see-all"
          kind="link"
          label={t('category.seeAll')}
          onPress={() => router.push({ pathname: '/transactions', params: { category: category.id, month: activeMonth } })}
        />
      </View>
    ) : null;

  const sideSummary =
    category && model && wide ? (
      <View
        testID="category-side-summary"
        style={{
          width: 300,
          backgroundColor: theme.surface,
          borderRadius: tokens.shape['radius-lg'],
          borderWidth: 1,
          borderColor: theme.border,
          padding: sp.lg,
          gap: sp.md,
        }}
      >
        <SummaryLine label={t('budget.col.planned')} value={money(model.plan, privacy)} testID="category-planned" />
        <SummaryLine label={t('budget.col.spent')} value={money(model.row.activity, privacy)} testID="category-spent" />
        <SummaryLine
          label={t('budget.redesign.left')}
          value={money(model.row.available, privacy, true)}
          testID="category-remaining"
        />
        {model.over > 0n && model.donor ? (
          <View style={{ gap: sp.sm, marginTop: sp.sm }}>
            <RedesignText variant="helper" tone="textSecondary">
              {t('category.redesign.coverHint', {
                name: model.donor.cat.name,
                available: money(model.donor.available, privacy),
                amount: money(model.over, privacy),
                category: category.name,
              })}
            </RedesignText>
            <RedesignButton
              testID="category-cover-move"
              label={t('category.redesign.moveAmount', { amount: money(model.over, privacy) })}
              onPress={openCover}
              fullWidth
            />
          </View>
        ) : null}
      </View>
    ) : null;

  return (
    <DetailChrome title={title} onBack={() => router.replace('/budget')} trailing={trailing}>
      <ScrollView contentContainerStyle={{ gap: sp.lg, padding: sp.lg, paddingBottom: sp.xl }}>
        {error ? <RedesignInlineError message={error} /> : null}
        {!category || !model ? (
          category ? (
            <View testID="category-loading" style={{ gap: sp.md }}>
              <RedesignSkeleton height={120} />
              <RedesignSkeleton height={160} />
            </View>
          ) : null
        ) : phone || !wide ? (
          <>
            {quickActionBar}
            {statusCard}
            {merchantsCard}
            {historyCard}
            {connectedHubCard}
            {txList}
            {!phone ? (
              <View testID="category-stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.md }}>
                <Stat label={t('budget.col.planned')} value={money(model.plan, privacy)} testID="category-planned" />
                <Stat label={t('budget.col.spent')} value={money(model.row.activity, privacy)} testID="category-spent" />
                <Stat label={t('budget.redesign.left')} value={money(model.row.available, privacy, true)} testID="category-remaining" />
                <Stat label={t('category.sixMonthAvg')} value={money(model.avg, privacy)} testID="category-avg-stat" />
              </View>
            ) : null}
            {monthLongLabel(activeMonth) ? (
              <RedesignText variant="caption" tone="textSecondary" testID="category-month-caption">
                {t('category.redesign.budgetMonth', { month: monthLongLabel(activeMonth) })}
              </RedesignText>
            ) : null}
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: sp.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: sp.lg }}>
              <RedesignText variant="helper" tone="textSecondary">
                {t('category.redesign.budgetMonth', { month: monthLongLabel(activeMonth) })}
              </RedesignText>
              {quickActionBar}
              {statusCard}
              {merchantsCard}
              {historyCard}
              {connectedHubCard}
              {txList}
            </View>
            {sideSummary}
          </View>
        )}
      </ScrollView>

      <EditCategorySheet
        visible={editOpen}
        category={isNew ? null : category ?? null}
        snapshot={snapshot}
        isNew={isNew}
        onClose={closeEdit}
        onSave={saveCategory}
        onCreateGroup={(name, kind) => repo.createCategoryGroup({ name, kind })}
        onDelete={
          category
            ? () => {
                closeEdit();
                setDeleteOpen(true);
              }
            : undefined
        }
      />

      {deleteOpen && category ? (
        <DeleteCategorySheet
          visible
          category={category}
          snapshot={snapshot}
          month={activeMonth}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async (moveTo) => {
            setError(null);
            const r = await repo.deleteCategory(category.id, moveTo, today());
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            const undoId = r.value?.undoId;
            toast.show(t('category.deleted'), undoId ? () => void repo.undoDeleteCategory(undoId, today()) : undefined);
            router.replace('/budget');
          }}
        />
      ) : null}

      {category && planOpen ? (
        <EditAmountSheet
          visible
          categoryId={category.id}
          category={category}
          month={activeMonth}
          snapshot={snapshot}
          categoryOrder={[category.id]}
          onClose={closePlan}
          onSave={savePlanned}
        />
      ) : null}

      {category && moveOpen ? (
        <MoveMoneySheet
          visible
          month={activeMonth}
          snapshot={snapshot}
          fromCategoryId={undefined}
          onClose={closeMove}
          onSave={async (fromId, toId, amount) => {
            const before = await repo.load();
            const fromPrev = repo.assigned(fromId, activeMonth, before);
            const toPrev = repo.assigned(toId, activeMonth, before);
            const r = await repo.moveAssigned(fromId, toId, activeMonth, amount);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.moved'), () => {
              void (async () => {
                await repo.setAssigned(fromId, activeMonth, fromPrev);
                await repo.setAssigned(toId, activeMonth, toPrev);
              })();
            });
            closeMove();
          }}
        />
      ) : null}

      {category && coverOpen ? (
        <CoverSheet
          visible
          month={activeMonth}
          snapshot={snapshot}
          onClose={closeCover}
          onSave={async (covers) => {
            const before = await repo.load();
            const prev = covers.map((cvr) => ({
              id: cvr.overspentId,
              amount: repo.assigned(cvr.overspentId, activeMonth, before),
            }));
            const fromPrev = covers.map((cvr) => ({
              id: cvr.fromId,
              amount: cvr.fromId === '__left_to_plan__' ? 0n : repo.assigned(cvr.fromId, activeMonth, before),
            }));
            const r = await repo.coverOverspending(activeMonth, covers);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('budget.covered'), () => {
              void (async () => {
                for (const p of prev) await repo.setAssigned(p.id, activeMonth, p.amount);
                for (const p of fromPrev) {
                  if (p.id !== '__left_to_plan__') await repo.setAssigned(p.id, activeMonth, p.amount);
                }
              })();
            });
            closeCover();
          }}
        />
      ) : null}
    </DetailChrome>
  );
}

function SummaryLine({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <RedesignText variant="helper" tone="textSecondary">
        {label}
      </RedesignText>
      <RedesignText variant="helper" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </RedesignText>
    </View>
  );
}

function Stat({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View testID={testID} style={{ minWidth: '45%', flexGrow: 1, gap: 2 }}>
      <RedesignText variant="caption" tone="textSecondary">
        {label}
      </RedesignText>
      <RedesignText variant="headline">{value}</RedesignText>
    </View>
  );
}

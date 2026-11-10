import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { Goal } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { Confirm, useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignChip,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignProgress,
  RedesignSegmented,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { ledgerBalance } from '@/ledger';
import { formatNaira, parseAmount, toInputText } from '@/money';
import { today } from '@/features/transactions/helpers';

import {
  activeGoals,
  completedGoals,
  goalCards,
  goalProgress,
  goalSaved,
  goalStatusKind,
  monthsBetween,
  reachesByDate,
  type GoalCard,
} from './helpers';
import { GOAL_URL, parseGoalsTab, type GoalsListTab } from './popupUrl';

const sp = tokens.space;
const shape = tokens.shape;

const MONTH_LONG = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTH_LONG[m] ?? m} ${y}`;
}

function monthOnly(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return MONTH_LONG[m] ?? iso;
}

function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Linear expected savings vs actual — used for "Behind by ₦…". */
function behindByAmount(card: GoalCard, todayIso: string): bigint {
  if (!card.goal.targetDate || card.saved >= card.target) return 0n;
  const start = card.goal.scheduleStarts ?? todayIso.slice(0, 8) + '01';
  const totalMonths = monthsBetween(start, card.goal.targetDate);
  const elapsed = Math.min(totalMonths, monthsBetween(start, todayIso));
  const expected = (card.target * BigInt(elapsed)) / BigInt(totalMonths);
  return expected > card.saved ? expected - card.saved : 0n;
}

function goalCaption(card: GoalCard, todayIso: string): string {
  const kind = goalStatusKind(card, todayIso);
  if (kind === 'done') return t('goals.done');
  if (kind === 'paused') return t('goals.paused');
  if (kind === 'behind') {
    const amt = behindByAmount(card, todayIso);
    if (amt > 0n) return t('goals.redesign.behindBy', { amount: formatNaira(amt) });
    return t('goals.behind');
  }
  if (card.goal.targetDate) {
    const monthsLeft = monthsBetween(todayIso, card.goal.targetDate);
    if (monthsLeft <= 3) return t('goals.redesign.dueIn', { month: monthOnly(card.goal.targetDate) });
    return t('goals.redesign.onTrackFor', { when: monthYear(card.goal.targetDate) });
  }
  return t('goals.onTrack');
}

function ProgressRing({ progress, size = 48, stroke = 5 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.progressTrack} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={theme.progressFill}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Compute account earmark health vs ledger balance. */
function accountEarmarkHealth(accountId: string, snapshot: Snapshot) {
  const account = snapshot.accounts.find((a) => a.id === accountId);
  if (!account) return null;
  const totalEarmarked = snapshot.goals
    .filter((g) => g.accountId === accountId && (g.status === 'active' || g.status === 'paused'))
    .reduce((s, g) => s + goalSaved(g.id, snapshot), 0n);
  const accountBal = ledgerBalance(accountId, snapshot.events);
  const unallocated = accountBal > totalEarmarked ? accountBal - totalEarmarked : 0n;
  const isOverEarmarked = totalEarmarked > accountBal;
  return {
    accountName: account.name,
    totalEarmarked,
    accountBal,
    unallocated,
    isOverEarmarked,
    overBy: isOverEarmarked ? totalEarmarked - accountBal : 0n,
  };
}

/** Modernized Goals Command Center (P14 / DESIGN page 14). */
export function RedesignGoalsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    tab?: string;
    goal?: string;
    allocate?: string;
    take?: string;
    spend?: string;
    goalSchedule?: string;
    edit?: string;
  }>();
  const { snapshot, repo } = useWorkspace();
  const todayIso = today();

  const listTab = parseGoalsTab(params.tab);

  const cards = useMemo(() => (snapshot ? goalCards(snapshot, todayIso) : []), [snapshot, todayIso]);
  const active = useMemo(() => activeGoals(cards, todayIso), [cards, todayIso]);
  const done = useMemo(() => completedGoals(cards), [cards]);

  const totalSaved = active.reduce((s, c) => s + c.saved, 0n);

  const [starter, setStarter] = useState<{ name: string; targetDate?: string } | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const addOpen = params.goal === 'new' || editingGoal !== null || params.edit !== undefined;
  const detailId = typeof params.goal === 'string' && params.goal !== 'new' ? params.goal : null;
  const detailCard = detailId ? cards.find((c) => c.goal.id === detailId) ?? null : null;

  const allocateGoalId = params.allocate;
  const allocateGoal = allocateGoalId && snapshot ? snapshot.goals.find((g) => g.id === allocateGoalId) ?? null : null;

  const spendGoalId = params.take ?? params.spend;
  const spendGoal = spendGoalId && snapshot ? snapshot.goals.find((g) => g.id === spendGoalId) ?? null : null;

  const scheduleGoalId = params.goalSchedule;
  const scheduleGoal = scheduleGoalId && snapshot ? snapshot.goals.find((g) => g.id === scheduleGoalId) ?? null : null;

  const setTab = (tab: GoalsListTab) => {
    router.setParams({ [GOAL_URL.tab]: tab });
  };

  const openStarter = (name: string, monthsOut: number) => {
    const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
    const targetD = new Date(Date.UTC(y, m - 1 + monthsOut, d));
    const targetIso = targetD.toISOString().slice(0, 10);
    setStarter({ name, targetDate: targetIso });
    setEditingGoal(null);
    router.setParams({ goal: 'new' });
  };

  if (detailCard && snapshot) {
    return (
      <GoalDetailView
        snapshot={snapshot}
        card={detailCard}
        todayIso={todayIso}
        onBack={() => router.setParams({ goal: undefined, allocate: undefined, take: undefined, spend: undefined, goalSchedule: undefined })}
        onEdit={() => {
          setEditingGoal(detailCard.goal);
          router.setParams({ edit: detailCard.goal.id });
        }}
        onOpenAllocate={() => router.setParams({ allocate: detailCard.goal.id })}
        onOpenSpend={() => router.setParams({ spend: detailCard.goal.id })}
        onOpenSchedule={() => router.setParams({ goalSchedule: detailCard.goal.id })}
        onPauseResume={async () => {
          const nextStatus = detailCard.goal.status === 'paused' ? 'active' : 'paused';
          await repo.updateGoal({ ...detailCard.goal, status: nextStatus });
          toast.show(nextStatus === 'active' ? t('goals.resumeGoal') : t('goals.pauseGoal'));
        }}
        onMarkDone={async () => {
          await repo.updateGoal({
            ...detailCard.goal,
            status: 'completed',
            completedAt: new Date().toISOString(),
          });
          toast.show(t('goals.reached'));
          router.setParams({ goal: undefined, tab: 'done' });
        }}
        onDelete={async () => {
          await repo.deleteGoal(detailCard.goal.id);
          toast.show(t('common.saved'));
          router.setParams({ goal: undefined });
        }}
        onCatchUpExtend={async (months: number) => {
          const base = detailCard.goal.targetDate ?? todayIso;
          const [y, m, d] = base.split('-').map(Number) as [number, number, number];
          const newDate = new Date(Date.UTC(y, m - 1 + months, d));
          await repo.updateGoal({ ...detailCard.goal, targetDate: newDate.toISOString().slice(0, 10) });
          toast.show(t('common.saved'));
        }}
      />
    );
  }

  return (
    <RedesignShell>
      <SafeAreaView testID="redesign-goals" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={t('goals.title')}
          onBack={() => router.push('/more')}
          trailing={
            <Pressable
              testID="goals-redesign-add"
              accessibilityRole="button"
              accessibilityLabel={t('goals.redesign.addAGoal')}
              onPress={() => {
                setStarter(null);
                setEditingGoal(null);
                router.setParams({ goal: 'new' });
              }}
              style={{
                width: tokens.density.touch.minTarget,
                height: tokens.density.touch.minTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RedesignIcon name="plus" size={24} color={theme.text} />
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
          {/* Segmented Control: In progress | Completed */}
          <RedesignSegmented
            testID="goals-toggle"
            value={listTab}
            onChange={(val) => setTab(val as GoalsListTab)}
            options={[
              { key: 'active', label: t('goals.inProgress') },
              { key: 'done', label: t('goals.completed') },
            ]}
          />

          {listTab === 'active' ? (
            active.length === 0 ? (
              <Card testID="goals-redesign-empty">
                <View style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: theme.surfaceMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RedesignIcon name="target" size={28} color={theme.text} />
                  </View>
                  <RedesignText variant="headline" accessibilityRole="header">
                    {t('goals.redesign.emptyTitle')}
                  </RedesignText>
                  <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                    {t('goals.redesign.emptyBody')}
                  </RedesignText>
                  {/* 1-tap starter idea templates */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs, justifyContent: 'center' }}>
                    <RedesignButton
                      testID="goals-starter-emergency"
                      kind="secondary"
                      label={t('goals.starterEmergency')}
                      onPress={() => openStarter(t('goals.starterEmergency'), 6)}
                    />
                    <RedesignButton
                      testID="goals-starter-rent"
                      kind="secondary"
                      label={t('goals.starterRent')}
                      onPress={() => openStarter(t('goals.starterRent'), 12)}
                    />
                    <RedesignButton
                      testID="goals-starter-school"
                      kind="secondary"
                      label={t('goals.starterSchool')}
                      onPress={() => openStarter(t('goals.starterSchool'), 4)}
                    />
                  </View>
                  <RedesignButton
                    testID="goals-redesign-empty-add"
                    label={t('goals.redesign.addAGoal')}
                    onPress={() => {
                      setStarter(null);
                      setEditingGoal(null);
                      router.setParams({ goal: 'new' });
                    }}
                  />
                </View>
              </Card>
            ) : (
              <>
                <Card testID="goals-redesign-total">
                  <View style={{ padding: sp.lg, gap: sp.sm }}>
                    <RedesignText variant="label" tone="textSecondary">
                      {t('goals.redesign.savedForGoals')}
                    </RedesignText>
                    <RedesignAmount testID="goals-redesign-total-amount" text={formatNaira(totalSaved)} sizeVariant="display" />
                    <RedesignText>{t('goals.redesign.across', { count: String(active.length) })}</RedesignText>
                  </View>
                </Card>

                {active.map((card) => (
                  <Pressable
                    key={card.goal.id}
                    testID={`goals-row-${card.goal.id}`}
                    accessibilityRole="button"
                    onPress={() => router.setParams({ goal: card.goal.id })}
                  >
                    <Card>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg }}>
                        <ProgressRing progress={card.progress} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <RedesignText variant="label">{card.goal.name}</RedesignText>
                            {card.goal.status === 'paused' ? (
                              <RedesignChip label={t('goals.paused')} />
                            ) : null}
                          </View>
                          <RedesignText variant="helper" tone="textSecondary">
                            {t('goals.redesign.of', {
                              saved: formatNaira(card.saved),
                              target: formatNaira(card.target),
                            })}
                          </RedesignText>
                          <RedesignText variant="helper" tone="textSecondary">
                            {goalCaption(card, todayIso)}
                          </RedesignText>
                        </View>
                        <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} />
                      </View>
                    </Card>
                  </Pressable>
                ))}

                <RedesignButton
                  testID="goals-redesign-add-bottom"
                  kind="secondary"
                  label={t('goals.redesign.addAGoal')}
                  fullWidth
                  onPress={() => {
                    setStarter(null);
                    setEditingGoal(null);
                    router.setParams({ goal: 'new' });
                  }}
                />
              </>
            )
          ) : (
            /* Completed Goals Tab */
            done.length === 0 ? (
              <Card testID="goals-completed-empty">
                <View style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
                  <RedesignIcon name="check" size={32} color={theme.primary} />
                  <RedesignText variant="headline">{t('goals.completed')}</RedesignText>
                  <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                    {t('goals.emptyCompleted')}
                  </RedesignText>
                </View>
              </Card>
            ) : (
              done.map((card) => (
                <Pressable
                  key={card.goal.id}
                  testID={`goals-row-${card.goal.id}`}
                  accessibilityRole="button"
                  onPress={() => router.setParams({ goal: card.goal.id })}
                >
                  <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg, opacity: 0.85 }}>
                      <ProgressRing progress={1} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <RedesignText variant="label">{card.goal.name}</RedesignText>
                          <RedesignChip label={t('goals.done')} />
                        </View>
                        <RedesignText variant="helper" tone="textSecondary">
                          {formatNaira(card.saved)}
                        </RedesignText>
                        {card.goal.completedAt ? (
                          <RedesignText testID={`goal-done-date-${card.goal.id}`} variant="caption" tone="textSecondary">
                            {dayMonth(card.goal.completedAt.slice(0, 10))}
                          </RedesignText>
                        ) : null}
                      </View>
                      <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} />
                    </View>
                  </Card>
                </Pressable>
              ))
            )
          )}
        </ScrollView>

        {/* Add / Edit Goal Sheet */}
        {addOpen && snapshot ? (
          <AddGoalSheet
            snapshot={snapshot}
            existing={editingGoal ?? (params.edit ? snapshot.goals.find((g) => g.id === params.edit) : undefined)}
            starter={starter}
            onClose={() => {
              setStarter(null);
              setEditingGoal(null);
              router.setParams({ goal: undefined, edit: undefined });
            }}
            onSave={async (input) => {
              if (editingGoal) {
                await repo.updateGoal({ ...editingGoal, ...input, targetMinor: input.targetMinor.toString() });
                toast.show(t('common.saved'));
              } else {
                const r = await repo.addGoal(input);
                if (r.ok) {
                  toast.show(t('goals.redesign.goalSaved'));
                }
              }
              setStarter(null);
              setEditingGoal(null);
              router.setParams({ goal: undefined, edit: undefined });
            }}
          />
        ) : null}

        {/* Global Allocate Sheet */}
        {allocateGoal && snapshot ? (
          <AllocateSheet
            goal={allocateGoal}
            snapshot={snapshot}
            onClose={() => router.setParams({ allocate: undefined })}
            onSave={async (amount, fromAccountId) => {
              const r = await repo.allocateToGoal(allocateGoal.id, {
                amount,
                date: todayIso,
                fromAccountId,
              });
              if (r.ok) {
                toast.show(t('goals.redesign.moneyAdded'));
                router.setParams({ allocate: undefined });
              }
            }}
          />
        ) : null}

        {/* Global Spend Sheet */}
        {spendGoal && snapshot ? (
          <SpendGoalSheet
            goal={spendGoal}
            snapshot={snapshot}
            onClose={() => router.setParams({ take: undefined, spend: undefined })}
            onSave={async (amount, categoryId) => {
              const r = await repo.spendFromGoal(spendGoal.id, {
                amount,
                date: todayIso,
                accountId: spendGoal.accountId,
                categoryId,
              });
              if (r.ok) {
                toast.show(t('goals.spendSaved'));
                router.setParams({ take: undefined, spend: undefined });
              }
            }}
          />
        ) : null}

        {/* Goal Schedule Sheet */}
        {scheduleGoal && snapshot ? (
          <GoalScheduleSheet
            goal={scheduleGoal}
            snapshot={snapshot}
            todayIso={todayIso}
            onClose={() => router.setParams({ goalSchedule: undefined })}
            onSave={async (sched) => {
              await repo.setGoalSchedule({
                ...scheduleGoal,
                ...sched,
              });
              toast.show(t('goals.scheduleSaved'));
              router.setParams({ goalSchedule: undefined });
            }}
          />
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

function GoalDetailView({
  snapshot,
  card,
  todayIso,
  onBack,
  onEdit,
  onOpenAllocate,
  onOpenSpend,
  onOpenSchedule,
  onPauseResume,
  onMarkDone,
  onDelete,
  onCatchUpExtend,
}: {
  snapshot: Snapshot;
  card: GoalCard;
  todayIso: string;
  onBack: () => void;
  onEdit: () => void;
  onOpenAllocate: () => void;
  onOpenSpend: () => void;
  onOpenSchedule: () => void;
  onPauseResume: () => Promise<void>;
  onMarkDone: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCatchUpExtend: (months: number) => Promise<void>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { repo } = useWorkspace();
  const params = useLocalSearchParams<{
    allocate?: string;
    take?: string;
    spend?: string;
    goalSchedule?: string;
    edit?: string;
  }>();

  const allocateOpen = params.allocate === card.goal.id;
  const spendOpen = params.take === card.goal.id || params.spend === card.goal.id;
  const scheduleOpen = params.goalSchedule === card.goal.id;
  const editOpen = params.edit === card.goal.id;

  const history = snapshot.allocations
    .filter((a) => a.goalId === card.goal.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  const pct = Math.round(card.progress * 100);
  const kind = goalStatusKind(card, todayIso);
  const isDone = kind === 'done' || card.saved >= card.target;
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Earmark health for this goal's account
  const earmarkInfo = accountEarmarkHealth(card.goal.accountId, snapshot);

  // Catch-up recommendations if behind
  const catchUp = useMemo(() => {
    if (kind !== 'behind' || !card.goal.targetDate || card.saved >= card.target) return null;
    const variance = behindByAmount(card, todayIso);
    const monthsLeft = Math.max(1, monthsBetween(todayIso, card.goal.targetDate));
    const left = card.target - card.saved;
    const needed = left / BigInt(monthsLeft) + (left % BigInt(monthsLeft) > 0n ? 1n : 0n);
    const sched = card.goal.scheduleAmountMinor ? BigInt(card.goal.scheduleAmountMinor) : 0n;
    const extra = needed > sched ? needed - sched : needed;

    let extend = 2;
    if (sched > 0n) {
      const periods = Number(left / sched + (left % sched > 0n ? 1n : 0n));
      if (periods > monthsLeft) extend = Math.max(1, periods - monthsLeft);
    }
    return { variance, needed, extra, extend };
  }, [kind, card, todayIso]);

  // Next milestone calculation (25%, 50%, 75%, 100%)
  const milestone = useMemo(() => {
    const steps = [25, 50, 75, 100];
    const next = steps.find((s) => s > pct) ?? 100;
    const targetAtNext = (card.target * BigInt(next)) / 100n;
    const toGo = targetAtNext > card.saved ? targetAtNext - card.saved : 0n;
    return { next, toGo };
  }, [pct, card]);

  // Calm celebration stats
  const monthsActive = useMemo(() => {
    const firstAlloc = history[history.length - 1]?.date;
    const start = card.goal.scheduleStarts ?? firstAlloc ?? todayIso.slice(0, 8) + '01';
    return Math.max(1, monthsBetween(start, todayIso));
  }, [card, history, todayIso]);

  return (
    <RedesignShell>
      <SafeAreaView testID="goals-redesign-detail" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
        <RedesignTopBar
          title={card.goal.name}
          onBack={onBack}
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                testID="goals-redesign-edit"
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
                onPress={onEdit}
                style={{
                  width: tokens.density.touch.minTarget,
                  height: tokens.density.touch.minTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RedesignIcon name="edit" size={22} color={theme.text} />
              </Pressable>
            </View>
          }
        />
        <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: 160 }}>
          {/* Dignified Reached Summary (Principle 10) */}
          {isDone ? (
            <Card testID="goals-reached-card">
              <View style={{ padding: sp.lg, gap: sp.sm, alignItems: 'center' }}>
                <RedesignIcon name="check" size={28} color={theme.primary} />
                <RedesignText variant="headline">{t('goals.redesign.reachedTitle')}</RedesignText>
                <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                  {t('goals.redesign.reachedStats', {
                    saved: formatNaira(card.saved),
                    months: String(monthsActive),
                  })}
                </RedesignText>
              </View>
            </Card>
          ) : null}

          {/* Progress Ring & Milestone Track */}
          <Card testID="goals-redesign-progress">
            <View style={{ padding: sp.lg, alignItems: 'center', gap: sp.md }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <ProgressRing progress={card.progress} size={120} stroke={10} />
                <View style={{ position: 'absolute', alignItems: 'center' }}>
                  <RedesignText variant="display">{String(pct)}</RedesignText>
                  <RedesignText variant="caption" tone="textSecondary">
                    {t('goals.redesign.outOf100')}
                  </RedesignText>
                </View>
              </View>
              <RedesignText>
                {t('goals.redesign.of', { saved: formatNaira(card.saved), target: formatNaira(card.target) })}
              </RedesignText>
              <RedesignText tone="textSecondary">{goalCaption(card, todayIso)}</RedesignText>

              {/* Milestone Markers: 25%, 50%, 75%, 100% */}
              <View testID="goals-milestone-bar" style={{ width: '100%', gap: sp.xs, marginTop: sp.xs }}>
                <RedesignProgress value={Math.min(100, pct)} max={100} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
                  {[25, 50, 75, 100].map((m) => (
                    <RedesignText
                      key={`milestone-${m}`}
                      variant="caption"
                      tone={pct >= m ? 'primary' : 'textSecondary'}
                      style={{ fontWeight: pct >= m ? '700' : '400' }}
                    >
                      {`${m}%`}
                    </RedesignText>
                  ))}
                </View>
                {!isDone ? (
                  <RedesignText variant="caption" tone="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
                    {t('goals.redesign.nextMilestone', {
                      milestone: String(milestone.next),
                      amount: formatNaira(milestone.toGo),
                    })}
                  </RedesignText>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Smart Catch-Up Recommendation if Behind */}
          {catchUp && catchUp.variance > 0n ? (
            <Card testID="goals-catchup-card">
              <View style={{ padding: sp.md, gap: sp.sm, backgroundColor: '#fef3c7', borderRadius: shape['radius-lg'] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                  <RedesignIcon name="alert" size={18} color="#b45309" />
                  <RedesignText variant="label" style={{ color: '#b45309', fontWeight: '700' }}>
                    {t('goals.redesign.behindBy', { amount: formatNaira(catchUp.variance) })}
                  </RedesignText>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
                  <RedesignButton
                    testID="goals-catchup-add"
                    kind="secondary"
                    label={t('goals.redesign.catchUpAdd', { amount: formatNaira(catchUp.extra) })}
                    onPress={onOpenSchedule}
                  />
                  <RedesignButton
                    testID="goals-catchup-extend"
                    kind="secondary"
                    label={t('goals.redesign.catchUpExtend', { months: String(catchUp.extend) })}
                    onPress={() => void onCatchUpExtend(catchUp.extend)}
                  />
                </View>
              </View>
            </Card>
          ) : null}

          {/* Account Earmark Health Indicator (Rules M12 & M13) */}
          {earmarkInfo ? (
            <Card testID="goals-earmark-health">
              <View style={{ padding: sp.md, gap: sp.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                  <RedesignIcon name="bank" size={16} color={earmarkInfo.isOverEarmarked ? '#ef4444' : theme.textSecondary} />
                  <RedesignText
                    variant="caption"
                    style={{ color: earmarkInfo.isOverEarmarked ? '#ef4444' : theme.textSecondary }}
                  >
                    {t('goals.redesign.accountEarmark', {
                      account: earmarkInfo.accountName,
                      earmarked: formatNaira(earmarkInfo.totalEarmarked),
                      available: formatNaira(earmarkInfo.unallocated),
                    })}
                  </RedesignText>
                </View>
                {earmarkInfo.isOverEarmarked ? (
                  <RedesignInlineError
                    message={t('goals.redesign.overEarmarkWarning', { account: earmarkInfo.accountName })}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* Meta Details */}
          <Card>
            {(
              [
                [t('goals.redesign.keptIn'), card.accountName || '—'],
                [t('goals.redesign.monthlyAmount'), card.monthly ? formatNaira(card.monthly) : t('common.notSet')],
                [t('goals.redesign.targetDate'), card.goal.targetDate ? monthYear(card.goal.targetDate) : t('common.notSet')],
                [
                  t('goals.scheduleTitle'),
                  card.goal.scheduleAmountMinor
                    ? `${formatNaira(BigInt(card.goal.scheduleAmountMinor))} · ${card.goal.scheduleEvery ?? 'month'} ${card.goal.scheduleAutoAllocate ? '(Auto)' : ''}`
                    : t('goals.scheduleEmpty'),
                ],
              ] as const
            ).map(([label, value]) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: sp.lg,
                  paddingVertical: sp.md,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  gap: sp.md,
                }}
              >
                <RedesignText tone="textSecondary">{label}</RedesignText>
                <RedesignText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</RedesignText>
              </View>
            ))}
          </Card>

          {/* Quick Actions Menu Strip */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
            <RedesignButton
              kind="secondary"
              label={card.goal.scheduleAmountMinor ? t('goals.editSchedule') : t('goals.addSchedule')}
              onPress={onOpenSchedule}
            />
            <RedesignButton
              kind="secondary"
              label={card.goal.status === 'paused' ? t('goals.resumeGoal') : t('goals.pauseGoal')}
              onPress={() => void onPauseResume()}
            />
            {!isDone ? (
              <RedesignButton
                kind="secondary"
                label={t('goals.markDone')}
                onPress={() => void onMarkDone()}
              />
            ) : null}
            <RedesignButton
              kind="secondary"
              label={t('goals.deleteGoal')}
              onPress={() => setDeleteConfirm(true)}
            />
          </View>

          {/* Allocation History */}
          {history.length > 0 ? (
            <View>
              <RedesignText variant="label" tone="textSecondary" style={{ marginBottom: sp.xs }}>
                {t('goals.redesign.history')}
              </RedesignText>
              <Card>
                {history.map((a) => {
                  const spend = a.kind === 'spend';
                  const amount = BigInt(a.amountMinor);
                  return (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: sp.md,
                        paddingHorizontal: sp.md,
                        paddingVertical: sp.md,
                      }}
                    >
                      <View
                        style={{
                          width: tokens.size.avatar,
                          height: tokens.size.avatar,
                          borderRadius: tokens.size.avatar / 2,
                          backgroundColor: theme.surfaceMuted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <RedesignText variant="label">
                          {(spend ? t('goals.redesign.tookMoneyOut') : t('goals.redesign.addedMoney')).slice(0, 1)}
                        </RedesignText>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <RedesignText>
                          {spend ? t('goals.redesign.tookMoneyOut') : t('goals.redesign.addedMoney')}
                        </RedesignText>
                        <RedesignText variant="helper" tone="textSecondary">
                          {dayMonth(a.date)}
                        </RedesignText>
                      </View>
                      <RedesignText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                        {spend ? `−${formatNaira(amount)}` : `+${formatNaira(amount)}`}
                      </RedesignText>
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom Actions: Add money & Spend from this goal */}
        <View style={{ padding: sp.lg, gap: sp.sm, backgroundColor: theme.page }}>
          <RedesignButton
            testID="goals-redesign-add-money"
            label={t('goals.redesign.addMoney')}
            fullWidth
            onPress={onOpenAllocate}
          />
          <RedesignButton
            testID="goals-redesign-take-money"
            kind="secondary"
            label={t('goals.redesign.takeMoneyOut')}
            fullWidth
            onPress={onOpenSpend}
          />
        </View>

        <Confirm
          visible={deleteConfirm}
          title={t('goals.deleteTitle', { name: card.goal.name })}
          body={t('goals.deleteBody', { amount: formatNaira(card.saved), account: card.accountName || 'Account' })}
          confirmLabel={t('goals.deleteConfirm')}
          onConfirm={() => {
            setDeleteConfirm(false);
            void onDelete();
          }}
          onCancel={() => setDeleteConfirm(false)}
        />

        {allocateOpen ? (
          <AllocateSheet
            goal={card.goal}
            snapshot={snapshot}
            onClose={() => router.setParams({ allocate: undefined })}
            onSave={async (amount, fromAccountId) => {
              const r = await repo.allocateToGoal(card.goal.id, {
                amount,
                date: todayIso,
                fromAccountId,
              });
              if (r.ok) {
                toast.show(t('goals.redesign.moneyAdded'));
                router.setParams({ allocate: undefined });
              }
            }}
          />
        ) : null}

        {spendOpen ? (
          <SpendGoalSheet
            goal={card.goal}
            snapshot={snapshot}
            onClose={() => router.setParams({ take: undefined, spend: undefined })}
            onSave={async (amount, categoryId) => {
              const r = await repo.spendFromGoal(card.goal.id, {
                amount,
                date: todayIso,
                accountId: card.goal.accountId,
                categoryId,
              });
              if (r.ok) {
                toast.show(t('goals.spendSaved'));
                router.setParams({ take: undefined, spend: undefined });
              }
            }}
          />
        ) : null}

        {scheduleOpen ? (
          <GoalScheduleSheet
            goal={card.goal}
            snapshot={snapshot}
            todayIso={todayIso}
            onClose={() => router.setParams({ goalSchedule: undefined })}
            onSave={async (sched) => {
              await repo.setGoalSchedule({
                ...card.goal,
                ...sched,
              });
              toast.show(t('goals.scheduleSaved'));
              router.setParams({ goalSchedule: undefined });
            }}
          />
        ) : null}

        {editOpen ? (
          <AddGoalSheet
            snapshot={snapshot}
            existing={card.goal}
            onClose={() => router.setParams({ edit: undefined })}
            onSave={async (input) => {
              await repo.updateGoal({ ...card.goal, ...input, targetMinor: input.targetMinor.toString() });
              toast.show(t('common.saved'));
              router.setParams({ edit: undefined });
            }}
          />
        ) : null}
      </SafeAreaView>
    </RedesignShell>
  );
}

/** PU-32 Add Money (Allocate) Sheet with before->after preview and Rule M12 captions. */
function AllocateSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (amount: bigint, fromAccountId: string) => Promise<void>;
}) {
  const scheduleDefault = goal.scheduleAmountMinor ? BigInt(goal.scheduleAmountMinor) : null;
  const [amountText, setAmountText] = useState(scheduleDefault ? toInputText(scheduleDefault) : '');
  const [accountId, setAccountId] = useState(goal.accountId);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? t('goals.redesign.chooseOption');
  const fromOther = accountId !== goal.accountId;

  const saved = goalSaved(goal.id, snapshot);
  const target = BigInt(goal.targetMinor);

  const preview = useMemo(() => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n || target <= 0n) return null;
    const before = Math.round(goalProgress(saved, target) * 100);
    const after = Math.round(goalProgress(saved + parsed.minor, target) * 100);
    return { before, after };
  }, [amountText, saved, target]);

  return (
    <RedesignSheet
      testID="goals-redesign-money-sheet"
      visible
      title={t('goals.allocateTitle')}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="goals-redesign-money-save"
          label={t('goals.redesign.confirmAdd')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('goals.redesign.chooseOption'));
              return;
            }
            setSaving(true);
            void onSave(parsed.minor, accountId).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        {/* Rule M12 Educational Reassurance */}
        <RedesignText variant="caption" tone="textSecondary">
          {t('goals.allocateCaption')}
        </RedesignText>
        {fromOther ? (
          <RedesignText variant="caption" tone="textSecondary">
            {t('goals.allocateTransferCaption')}
          </RedesignText>
        ) : null}

        <RedesignField
          testID="goals-redesign-money-amount"
          label={t('goals.redesign.amountLabel')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('goals.redesign.fromAccount')}</RedesignText>
          <Pressable
            testID="goals-redesign-money-account"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setAccountId(a.id);
                    setAccountOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{a.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>

        {preview ? (
          <RedesignText testID="goal-allocate-preview" variant="caption" tone="textSecondary">
            {t('goals.allocatePreviewRange', { before: String(preview.before), after: String(preview.after) })}
          </RedesignText>
        ) : null}

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

/** PU-01 / Rule M13 Spend from Goal Sheet: pre-tagged to goal so envelope isn't marked overspent. */
function SpendGoalSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (amount: bigint, categoryId: string) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const defaultCategory =
    goal.categoryId ??
    snapshot.categories.find((c) => c.kind === 'expense' && !c.deleted)?.id ??
    '';
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.deleted);
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? t('goals.redesign.chooseOption');
  const saved = goalSaved(goal.id, snapshot);

  return (
    <RedesignSheet
      testID="goals-redesign-spend-sheet"
      visible
      title={t('goals.spendTitle')}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="goals-redesign-spend-save"
          label={t('goals.redesign.confirmTake')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            if (parsed.minor > saved) {
              setError(t('goals.redesign.of', { saved: formatNaira(saved), target: formatNaira(saved) }));
              return;
            }
            if (!categoryId) {
              setError(t('goals.redesign.chooseOption'));
              return;
            }
            setSaving(true);
            void onSave(parsed.minor, categoryId).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        {/* Rule M13 Educational Reassurance */}
        <RedesignText variant="caption" tone="textSecondary">
          {t('goals.spendCaption')}
        </RedesignText>

        <RedesignField
          testID="goals-redesign-spend-amount"
          label={t('goals.redesign.amountLabel')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('goals.spendCategory')}</RedesignText>
          <Pressable
            testID="goals-redesign-spend-category"
            onPress={() => setCatOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{categoryName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {catOpen
            ? categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCategoryId(c.id);
                    setCatOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{c.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

/** PU-33 Goal Schedule Sheet: recurring automated contribution with Nigerian Payday chips. */
function GoalScheduleSheet({
  goal,
  snapshot,
  todayIso,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: Snapshot;
  todayIso: string;
  onClose: () => void;
  onSave: (sched: {
    scheduleAmountMinor: string;
    scheduleEvery: 'week' | 'month';
    scheduleDayOfMonth: number;
    scheduleStarts: string;
    scheduleAutoAllocate: boolean;
  }) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState(
    goal.scheduleAmountMinor ? toInputText(BigInt(goal.scheduleAmountMinor)) : '',
  );
  const [every, setEvery] = useState<'week' | 'month'>(goal.scheduleEvery ?? 'month');
  const [day, setDay] = useState(goal.scheduleDayOfMonth ? String(goal.scheduleDayOfMonth) : '28');
  const [starts, setStarts] = useState(goal.scheduleStarts ?? todayIso);
  const [autoAllocate, setAutoAllocate] = useState(goal.scheduleAutoAllocate ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = goalSaved(goal.id, snapshot);
  const target = BigInt(goal.targetMinor);

  const reaches = useMemo(() => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n) return null;
    return reachesByDate(saved, target, parsed.minor, every, starts);
  }, [amountText, saved, target, every, starts]);

  return (
    <RedesignSheet
      testID="goals-schedule-sheet"
      visible
      title={t('goals.scheduleTitle')}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="goals-schedule-save"
          label={t('goals.scheduleSave')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            const d = parseInt(day, 10) || 28;
            setSaving(true);
            void onSave({
              scheduleAmountMinor: parsed.minor.toString(),
              scheduleEvery: every,
              scheduleDayOfMonth: d,
              scheduleStarts: starts,
              scheduleAutoAllocate: autoAllocate,
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="goals-schedule-amount"
          label={t('goals.scheduleAmount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {/* Quick Nigerian Payday Presets */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="caption" tone="textSecondary">
            {t('goals.scheduleDay')}
          </RedesignText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.xs }}>
            <RedesignChip
              label={t('goals.redesign.paydayPreset28')}
              onPress={() => {
                setEvery('month');
                setDay('28');
              }}
            />
            <RedesignChip
              label={t('goals.redesign.paydayPreset1st')}
              onPress={() => {
                setEvery('month');
                setDay('1');
              }}
            />
            <RedesignChip
              label={t('goals.redesign.paydayPresetWeekly')}
              onPress={() => {
                setEvery('week');
              }}
            />
          </View>
        </View>

        <RedesignSegmented
          testID="goals-schedule-every"
          value={every}
          onChange={(v) => setEvery(v as 'week' | 'month')}
          options={[
            { key: 'month', label: t('goals.scheduleMonthly') },
            { key: 'week', label: t('goals.scheduleWeekly') },
          ]}
        />

        {every === 'month' ? (
          <RedesignField
            testID="goals-schedule-day"
            label={t('goals.scheduleDay')}
            value={day}
            onChangeText={setDay}
            keyboardType="number-pad"
            placeholder="28"
          />
        ) : null}

        <RedesignField
          testID="goals-schedule-starts"
          label={t('goals.scheduleStarts')}
          value={starts}
          onChangeText={setStarts}
          placeholder={t('goals.redesign.pickDate')}
        />

        {/* Auto-allocate Switch */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <RedesignText variant="label">{t('goals.scheduleAuto')}</RedesignText>
          <Switch
            testID="goals-schedule-auto"
            value={autoAllocate}
            onValueChange={setAutoAllocate}
            thumbColor={autoAllocate ? theme.primary : theme.textSecondary}
            trackColor={{ false: theme.border, true: theme.primarySoft }}
          />
        </View>

        {reaches ? (
          <RedesignText testID="goals-schedule-reaches" variant="helper" tone="textSecondary">
            {t('goals.scheduleReaches', {
              amount: formatNaira(target),
              date: monthYear(reaches),
            })}
          </RedesignText>
        ) : null}

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

/** PU-31 Add / Edit Goal Sheet with Bidirectional Pacing & Target Calculator. */
function AddGoalSheet({
  snapshot,
  existing,
  starter,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  existing?: Goal;
  starter?: { name: string; targetDate?: string } | null;
  onClose: () => void;
  onSave: (input: {
    name: string;
    targetMinor: bigint;
    accountId: string;
    targetDate?: string;
    categoryId?: string;
    notes?: string;
    alreadySavedMinor?: bigint;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? starter?.name ?? '');
  const [amountText, setAmountText] = useState(
    existing ? toInputText(BigInt(existing.targetMinor)) : '',
  );
  const [targetDate, setTargetDate] = useState(
    existing?.targetDate ?? starter?.targetDate ?? '2027-06-01',
  );
  const [calcMode, setCalcMode] = useState<'date' | 'pace'>('date');
  const [monthlyBudgetText, setMonthlyBudgetText] = useState('');

  const savings = snapshot.accounts.find((a) => a.type === 'savings' && !a.archived);
  const [accountId, setAccountId] = useState(
    existing?.accountId ?? savings?.id ?? snapshot.accounts[0]?.id ?? '',
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [catOpen, setCatOpen] = useState(false);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [alreadyText, setAlreadyText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('goals.redesign.chooseOption');
  const catName = snapshot.categories.find((c) => c.id === categoryId)?.name ?? t('goals.noCategory');

  // Mode 1: By Date -> Monthly Needed
  const monthlyHint = useMemo(() => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n || !targetDate) return null;
    const months = monthsBetween(today(), targetDate);
    const per = parsed.minor / BigInt(months) + (parsed.minor % BigInt(months) > 0n ? 1n : 0n);
    return t('goals.redesign.monthlyHint', { amount: formatNaira(per) });
  }, [amountText, targetDate]);

  // Mode 2: By Monthly Budget -> Reaches By Date
  const paceHint = useMemo(() => {
    const parsedTarget = parseAmount(amountText);
    const parsedMonthly = parseAmount(monthlyBudgetText);
    if (!parsedTarget.ok || parsedTarget.minor <= 0n || !parsedMonthly.ok || parsedMonthly.minor <= 0n) return null;
    const reaches = reachesByDate(0n, parsedTarget.minor, parsedMonthly.minor, 'month', today());
    if (!reaches) return null;
    return t('goals.redesign.paceHint', { when: monthYear(reaches) });
  }, [amountText, monthlyBudgetText]);

  return (
    <RedesignSheet
      testID="goals-redesign-add-sheet"
      visible
      title={existing ? t('goals.editTitle') : t('goals.redesign.newGoal')}
      onClose={onClose}
      dirty={!!name || !!amountText}
      footer={
        <RedesignButton
          testID="goals-redesign-save"
          label={existing ? t('common.save') : t('goals.redesign.createGoal')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!name.trim()) {
              setError(t('goals.redesign.namePlaceholder'));
              return;
            }
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('goals.redesign.chooseOption'));
              return;
            }

            // Already saved safety guard
            let alreadyMinor: bigint | undefined;
            if (alreadyText) {
              const parsedAlready = parseAmount(alreadyText);
              if (parsedAlready.ok && parsedAlready.minor > 0n) {
                const bal = ledgerBalance(accountId, snapshot.events);
                if (parsedAlready.minor > bal) {
                  setError(t('goals.alreadySavedTooHigh'));
                  return;
                }
                alreadyMinor = parsedAlready.minor;
              }
            }

            // Compute targetDate if in pace mode
            let finalTargetDate = targetDate || undefined;
            if (calcMode === 'pace') {
              const parsedMonthly = parseAmount(monthlyBudgetText);
              if (parsedMonthly.ok && parsedMonthly.minor > 0n) {
                const reached = reachesByDate(0n, parsed.minor, parsedMonthly.minor, 'month', today());
                if (reached) finalTargetDate = reached;
              }
            }

            setSaving(true);
            void onSave({
              name: name.trim(),
              targetMinor: parsed.minor,
              accountId,
              targetDate: finalTargetDate,
              categoryId: categoryId || undefined,
              notes: notes.trim() || undefined,
              alreadySavedMinor: alreadyMinor,
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="goals-redesign-name"
          label={t('goals.redesign.whatFor')}
          value={name}
          onChangeText={setName}
          placeholder={t('goals.redesign.namePlaceholder')}
        />
        <RedesignField
          testID="goals-redesign-target"
          label={t('goals.redesign.targetAmount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {/* Bidirectional Pacing Calculator Mode */}
        <View style={{ gap: sp.xs }}>
          <RedesignSegmented
            value={calcMode}
            onChange={(m) => setCalcMode(m as 'date' | 'pace')}
            options={[
              { key: 'date', label: t('goals.redesign.modeByDate') },
              { key: 'pace', label: t('goals.redesign.modeByPace') },
            ]}
          />
        </View>

        {calcMode === 'date' ? (
          <>
            <RedesignField
              testID="goals-redesign-date"
              label={t('goals.redesign.byWhen')}
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder={t('goals.redesign.pickDate')}
            />
            {monthlyHint ? (
              <RedesignText variant="helper" tone="textSecondary">
                {monthlyHint}
              </RedesignText>
            ) : null}
          </>
        ) : (
          <>
            <RedesignField
              testID="goals-redesign-monthly-budget"
              label={t('goals.redesign.monthlyBudgetLabel')}
              value={monthlyBudgetText}
              onChangeText={setMonthlyBudgetText}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            {paceHint ? (
              <RedesignText variant="helper" tone="textSecondary">
                {paceHint}
              </RedesignText>
            ) : null}
          </>
        )}

        {/* Account the money sits in */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('goals.redesign.keepItIn')}</RedesignText>
          <Pressable
            testID="goals-redesign-account"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? snapshot.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      setAccountId(a.id);
                      setAccountOpen(false);
                    }}
                    style={{ padding: sp.md }}
                  >
                    <RedesignText>{a.name}</RedesignText>
                  </Pressable>
                ))
            : null}
        </View>

        {/* Linked budget category (optional) */}
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('goals.budgetCategory')}</RedesignText>
          <Pressable
            testID="goals-redesign-category"
            onPress={() => setCatOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{catName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {catOpen
            ? [{ id: '', name: t('goals.noCategory') }, ...snapshot.categories.filter((c) => c.kind === 'expense' && !c.deleted)].map((c) => (
                <Pressable
                  key={c.id || 'none'}
                  onPress={() => {
                    setCategoryId(c.id);
                    setCatOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{c.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>

        {!existing ? (
          <RedesignField
            testID="goals-redesign-already"
            label={t('goals.alreadySaved')}
            value={alreadyText}
            onChangeText={setAlreadyText}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        ) : null}

        <RedesignField
          testID="goals-redesign-notes"
          label={t('goals.notesOptional')}
          value={notes}
          onChangeText={setNotes}
          placeholder=""
        />

        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

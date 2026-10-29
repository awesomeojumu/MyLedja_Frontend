import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, InlineError, Placeholder, SegmentedControl, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { Goal } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { successHaptic } from '@/features/budget/haptics';

import { GoalCardView } from './GoalCard';
import { GoalPanel } from './GoalPanel';
import { AddGoalSheet, AllocateSheet, GoalScheduleSheet, SpendFromGoalSheet } from './goalSheets';
import { activeGoals, completedGoals, goalCards, gridColumns } from './helpers';
import { GOAL_URL, goalsTabParam, parseGoalsTab, type GoalsListTab } from './popupUrl';

const sp = tokens.spacing;

export function GoalsScreen() {
  const { snapshot, repo } = useWorkspace();
  const size = useSizeClass();
  const cols = gridColumns(size);
  const todayStr = today();
  const params = useLocalSearchParams<{ tab?: string; goal?: string; allocate?: string; goalSchedule?: string }>();
  const router = useRouter();
  const toast = useToast();

  const listTab = parseGoalsTab(typeof params.tab === 'string' ? params.tab : undefined);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [starterName, setStarterName] = useState<string | null>(null);
  const [spendGoal, setSpendGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cards = useMemo(() => (snapshot ? goalCards(snapshot, todayStr) : []), [snapshot, todayStr]);
  const visible = listTab === 'done' ? completedGoals(cards) : activeGoals(cards);

  const goalParam = typeof params.goal === 'string' ? params.goal : undefined;
  const allocateParam = typeof params.allocate === 'string' ? params.allocate : undefined;
  const scheduleParam = typeof params.goalSchedule === 'string' ? params.goalSchedule : undefined;

  const addOpen = goalParam === 'new' || editGoal !== null;
  const selected = goalParam && goalParam !== 'new' && snapshot ? snapshot.goals.find((g) => g.id === goalParam) ?? null : null;
  const selectedCard = selected ? cards.find((c) => c.goal.id === selected.id) ?? null : null;
  const allocateGoal = allocateParam && snapshot ? snapshot.goals.find((g) => g.id === allocateParam) ?? null : null;
  const scheduleGoal = scheduleParam && snapshot ? snapshot.goals.find((g) => g.id === scheduleParam) ?? null : null;

  const setTab = (tab: GoalsListTab) => {
    router.setParams({ [GOAL_URL.tab]: goalsTabParam(tab) });
  };

  const openAdd = (name?: string) => {
    setStarterName(name ?? null);
    setEditGoal(null);
    router.setParams({ [GOAL_URL.goal]: 'new' });
  };

  const clearParams = (...keys: string[]) => {
    const next: Record<string, undefined> = {};
    for (const k of keys) next[k] = undefined;
    router.setParams(next);
  };

  return (
    <AppFrame title={t('goals.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center', marginBottom: sp['spacing-md'] }}>
        <SegmentedControl
          testID="goals-toggle"
          label={t('goals.viewToggle')}
          value={listTab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('goals.inProgress') },
            { value: 'done', label: t('goals.completed') },
          ]}
        />
        <Button testID="goals-add" label={t('goals.add')} onPress={() => openAdd()} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!snapshot ? (
        <Placeholder height={120} />
      ) : visible.length === 0 ? (
        <View style={{ gap: sp['spacing-md'], alignItems: 'center', padding: sp['spacing-xl'] }}>
          <Text variant="heading-sm">{listTab === 'done' ? t('goals.emptyCompleted') : t('goals.emptyTitle')}</Text>
          {listTab === 'active' ? (
            <>
              <Text tone="textSecondary" style={{ textAlign: 'center' }}>
                {t('goals.emptyBody')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], justifyContent: 'center' }}>
                <Button testID="goals-starter-emergency" kind="secondary" label={t('goals.starterEmergency')} onPress={() => openAdd(t('goals.starterEmergency'))} />
                <Button testID="goals-starter-rent" kind="secondary" label={t('goals.starterRent')} onPress={() => openAdd(t('goals.starterRent'))} />
                <Button testID="goals-starter-school" kind="secondary" label={t('goals.starterSchool')} onPress={() => openAdd(t('goals.starterSchool'))} />
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
          {visible.map((card) => (
            <View key={card.goal.id} style={{ width: cols === 1 ? '100%' : `${100 / cols - 1}%`, minWidth: cols === 1 ? undefined : 260, flexGrow: 1 }}>
              <GoalCardView
                card={card}
                today={todayStr}
                onOpen={() => router.setParams({ [GOAL_URL.goal]: card.goal.id })}
                onAllocate={() => router.setParams({ [GOAL_URL.allocate]: card.goal.id })}
                onMenu={(key) => {
                  if (key === 'edit') {
                    setEditGoal(card.goal);
                    router.setParams({ [GOAL_URL.goal]: 'new' });
                    return;
                  }
                  if (key === 'schedule') {
                    router.setParams({ [GOAL_URL.goalSchedule]: card.goal.id });
                    return;
                  }
                  router.setParams({ [GOAL_URL.goal]: card.goal.id });
                }}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {addOpen && snapshot ? (
        <AddGoalSheet
          snapshot={snapshot}
          existing={editGoal ?? undefined}
          initialName={starterName ?? undefined}
          onClose={() => {
            setEditGoal(null);
            setStarterName(null);
            clearParams(GOAL_URL.goal);
          }}
          onSave={async (input) => {
            setError(null);
            if (editGoal) {
              await repo.updateGoal({
                ...editGoal,
                name: input.name,
                targetMinor: input.targetMinor.toString(),
                accountId: input.accountId,
                targetDate: input.targetDate,
                categoryId: input.categoryId,
                icon: input.icon,
                notes: input.notes,
              });
              toast.show(t('common.saved'));
              setEditGoal(null);
              clearParams(GOAL_URL.goal);
              return;
            }
            const r = await repo.addGoal({ ...input, name: starterName ?? input.name });
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('goals.goalAdded'));
            setStarterName(null);
            clearParams(GOAL_URL.goal);
          }}
        />
      ) : null}

      {allocateGoal && snapshot ? (
        <AllocateSheet
          goal={allocateGoal}
          snapshot={snapshot}
          onClose={() => clearParams(GOAL_URL.allocate)}
          onSave={async (amount, date, fromAccountId) => {
            setError(null);
            const r = await repo.allocateToGoal(allocateGoal.id, { amount, date, fromAccountId });
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            if (r.value.completed) {
              successHaptic();
              toast.show(t('goals.reached'));
            }
            clearParams(GOAL_URL.allocate);
          }}
        />
      ) : null}

      {selectedCard && snapshot ? (
        <GoalPanel
          card={selectedCard}
          snapshot={snapshot}
          repo={repo}
          today={todayStr}
          onClose={() => clearParams(GOAL_URL.goal)}
          onEdit={() => {
            setEditGoal(selectedCard.goal);
            router.setParams({ [GOAL_URL.goal]: 'new' });
          }}
          onSchedule={() => router.setParams({ [GOAL_URL.goalSchedule]: selectedCard.goal.id })}
          onSpend={() => {
            setSpendGoal(selectedCard.goal);
            clearParams(GOAL_URL.goal);
          }}
          onAllocate={() => router.setParams({ [GOAL_URL.allocate]: selectedCard.goal.id })}
        />
      ) : null}

      {scheduleGoal && snapshot ? (
        <GoalScheduleSheet goal={scheduleGoal} snapshot={snapshot} repo={repo} onClose={() => clearParams(GOAL_URL.goalSchedule)} />
      ) : null}

      {spendGoal && snapshot ? (
        <SpendFromGoalSheet
          goal={spendGoal}
          snapshot={snapshot}
          onClose={() => setSpendGoal(null)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.spendFromGoal(spendGoal.id, input);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            toast.show(t('goals.spendSaved'));
            setSpendGoal(null);
          }}
        />
      ) : null}
    </AppFrame>
  );
}

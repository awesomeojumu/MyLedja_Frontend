import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, InlineError, Placeholder, SegmentedControl, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import type { Goal } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { GoalCardView } from './GoalCard';
import { GoalPanel } from './GoalPanel';
import { AddGoalSheet, AllocateSheet, GoalScheduleSheet, SpendFromGoalSheet } from './goalSheets';
import { activeGoals, completedGoals, goalCards, gridColumns } from './helpers';

const sp = tokens.spacing;

type ListTab = 'active' | 'completed';

export function GoalsScreen() {
  const { snapshot, repo } = useWorkspace();
  const size = useSizeClass();
  const cols = gridColumns(size);
  const todayStr = today();

  const [listTab, setListTab] = useState<ListTab>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [allocateGoal, setAllocateGoal] = useState<Goal | null>(null);
  const [scheduleGoal, setScheduleGoal] = useState<Goal | null>(null);
  const [spendGoal, setSpendGoal] = useState<Goal | null>(null);
  const [starterName, setStarterName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();

  const cards = useMemo(() => (snapshot ? goalCards(snapshot, todayStr) : []), [snapshot, todayStr]);
  const visible = listTab === 'completed' ? completedGoals(cards) : activeGoals(cards);
  const selectedCard = selected && snapshot ? cards.find((c) => c.goal.id === selected.id) : null;

  const openAdd = (name?: string) => {
    setStarterName(name ?? null);
    setAddOpen(true);
  };

  return (
    <AppFrame title={t('goals.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center', marginBottom: sp['spacing-md'] }}>
        <SegmentedControl
          testID="goals-toggle"
          label={t('goals.viewToggle')}
          value={listTab}
          onChange={setListTab}
          options={[
            { value: 'active', label: t('goals.inProgress') },
            { value: 'completed', label: t('goals.completed') },
          ]}
        />
        <Button testID="goals-add" label={t('goals.add')} onPress={() => openAdd()} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!snapshot ? (
        <Placeholder height={120} />
      ) : visible.length === 0 ? (
        <View style={{ gap: sp['spacing-md'], alignItems: 'center', padding: sp['spacing-xl'] }}>
          <Text variant="heading-sm">{t('goals.emptyTitle')}</Text>
          <Text tone="textSecondary" style={{ textAlign: 'center' }}>
            {t('goals.emptyBody')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], justifyContent: 'center' }}>
            <Button testID="goals-starter-emergency" kind="secondary" label={t('goals.starterEmergency')} onPress={() => openAdd(t('goals.starterEmergency'))} />
            <Button testID="goals-starter-rent" kind="secondary" label={t('goals.starterRent')} onPress={() => openAdd(t('goals.starterRent'))} />
            <Button testID="goals-starter-school" kind="secondary" label={t('goals.starterSchool')} onPress={() => openAdd(t('goals.starterSchool'))} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
          {visible.map((card) => (
            <View key={card.goal.id} style={{ width: cols === 1 ? '100%' : `${100 / cols - 1}%`, minWidth: cols === 1 ? undefined : 260, flexGrow: 1 }}>
              <GoalCardView
                card={card}
                today={todayStr}
                onOpen={() => setSelected(card.goal)}
                onAllocate={() => setAllocateGoal(card.goal)}
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
            setAddOpen(false);
            setEditGoal(null);
            setStarterName(null);
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
              });
              setAddOpen(false);
              setEditGoal(null);
              return;
            }
            const r = await repo.addGoal({ ...input, name: starterName ?? input.name });
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            setAddOpen(false);
            setStarterName(null);
          }}
        />
      ) : null}

      {allocateGoal && snapshot ? (
        <AllocateSheet
          goal={allocateGoal}
          snapshot={snapshot}
          onClose={() => setAllocateGoal(null)}
          onSave={async (amount, date, fromAccountId) => {
            setError(null);
            const r = await repo.allocateToGoal(allocateGoal.id, { amount, date, fromAccountId });
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            if (r.value.completed) toast.show(t('goals.reached'));
            setAllocateGoal(null);
          }}
        />
      ) : null}

      {selectedCard && snapshot ? (
        <GoalPanel
          card={selectedCard}
          snapshot={snapshot}
          repo={repo}
          today={todayStr}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditGoal(selectedCard.goal);
            setSelected(null);
            setAddOpen(true);
          }}
          onSchedule={() => {
            setScheduleGoal(selectedCard.goal);
          }}
          onSpend={() => {
            setSpendGoal(selectedCard.goal);
            setSelected(null);
          }}
          onAllocate={() => {
            setAllocateGoal(selectedCard.goal);
          }}
        />
      ) : null}

      {scheduleGoal ? (
        <GoalScheduleSheet goal={scheduleGoal} repo={repo} onClose={() => setScheduleGoal(null)} />
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
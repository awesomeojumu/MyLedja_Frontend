import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  InlineError,
  Placeholder,
  Select,
  Sheet,
  StatusPill,
  Text,
  TextInput,
  AmountInput,
  formatDay,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Goal } from '@/data/workspace/model';
import type { Snapshot, WorkspaceRepository } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { activeGoals, completedGoals, goalCards, type GoalCard } from './helpers';

const sp = tokens.spacing;

export function GoalsScreen() {
  const { snapshot, repo } = useWorkspace();
  const [showCompleted, setShowCompleted] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [allocateGoal, setAllocateGoal] = useState<Goal | null>(null);
  const [spendGoal, setSpendGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const cards = useMemo(() => (snapshot ? goalCards(snapshot, today()) : []), [snapshot]);
  const visible = showCompleted ? completedGoals(cards) : activeGoals(cards);

  return (
    <AppFrame title={t('goals.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center', marginBottom: sp['spacing-md'] }}>
        <Button
          testID="goals-toggle"
          kind="secondary"
          label={showCompleted ? t('goals.inProgress') : t('goals.completed')}
          onPress={() => setShowCompleted((v) => !v)}
        />
        <Button testID="goals-add" label={t('goals.add')} onPress={() => setAddOpen(true)} />
      </View>
      {error ? <InlineError message={error} /> : null}
      {!snapshot ? (
        <Placeholder height={120} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('goals.emptyTitle')}
          body={t('goals.emptyBody')}
          actionLabel={t('goals.starterEmergency')}
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
          {visible.map((card) => (
            <GoalCardView key={card.goal.id} card={card} onOpen={() => setSelected(card.goal)} onAllocate={() => setAllocateGoal(card.goal)} />
          ))}
        </ScrollView>
      )}
      {addOpen && snapshot ? (
        <AddGoalSheet
          snapshot={snapshot}
          onClose={() => setAddOpen(false)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.addGoal(input);
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            setAddOpen(false);
          }}
        />
      ) : null}
      {allocateGoal && snapshot ? (
        <AllocateSheet
          goal={allocateGoal}
          snapshot={snapshot}
          onClose={() => setAllocateGoal(null)}
          onSave={async (amount, fromAccountId) => {
            setError(null);
            const r = await repo.allocateToGoal(allocateGoal.id, { amount, date: today(), fromAccountId });
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            if (r.value.completed) toast.show(t('goals.reached'));
            setAllocateGoal(null);
          }}
        />
      ) : null}
      {selected && snapshot ? (
        <GoalDetailSheet
          goal={selected}
          snapshot={snapshot}
          repo={repo}
          onClose={() => setSelected(null)}
          saved={goalCards(snapshot, today()).find((c) => c.goal.id === selected.id)!}
          onSpend={() => {
            setSpendGoal(selected);
            setSelected(null);
          }}
        />
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

function GoalCardView({ card, onOpen, onAllocate }: { card: GoalCard; onOpen: () => void; onAllocate: () => void }) {
  const theme = useTheme();
  const done = card.goal.status === 'completed';
  return (
    <Card testID={`goal-${card.goal.id}`} style={{ gap: sp['spacing-sm'] }}>
      <Pressable accessibilityRole="button" onPress={onOpen}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading-sm">{card.goal.name}</Text>
          <StatusPill label={done ? t('goals.done') : t('goals.onTrack')} kind={done ? 'done' : 'pending'} />
        </View>
        <Text tone="textSecondary">
          <Amount minor={card.saved} variant="caption" /> {t('goals.of')} <Amount minor={card.target} variant="caption" />
        </Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden', marginVertical: sp['spacing-xs'] }}>
          <View style={{ height: 8, width: `${Math.round(card.progress * 100)}%`, backgroundColor: theme.primaryFill }} />
        </View>
        {card.goal.targetDate ? (
          <Text variant="caption" tone="textSecondary">
            {t('goals.byDate', { date: formatDay(card.goal.targetDate) })}
            {card.monthly ? ` · ${t('goals.perMonth', { amount: formatNaira(card.monthly) })}` : ''}
          </Text>
        ) : null}
        <Text variant="caption" tone="textSecondary">
          {t('goals.inAccount', { name: card.accountName })}
        </Text>
      </Pressable>
      {done ? null : (
        <Button testID={`goal-allocate-${card.goal.id}`} kind="secondary" label={t('goals.addMoney')} onPress={onAllocate} />
      )}
    </Card>
  );
}

function AddGoalSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (input: { name: string; targetMinor: bigint; accountId: string; targetDate?: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

  return (
    <Sheet
      visible
      title={t('goals.addTitle')}
      onClose={onClose}
      testID="goal-add-sheet"
      footer={
        <Button
          testID="goal-save"
          label={t('panel.save')}
          disabled={!name.trim() || !accountId || amountMinor === null || amountMinor <= 0n}
          onPress={() => void onSave({ name, targetMinor: amountMinor!, accountId, targetDate: targetDate || undefined })}
        />
      }
    >
      <TextInput testID="goal-name" label={t('goals.name')} value={name} onChangeText={setName} />
      <AmountInput testID="goal-target" label={t('goals.target')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="goal-account" label={t('goals.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <TextInput testID="goal-date" label={t('goals.targetDate')} value={targetDate} onChangeText={setTargetDate} />
    </Sheet>
  );
}

function AllocateSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;
  onClose: () => void;
  onSave: (amount: bigint, fromAccountId?: string) => Promise<void>;
}) {
  const toast = useToast();
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [fromId, setFromId] = useState(goal.accountId);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));

  return (
    <Sheet
      visible
      title={t('goals.allocateTitle')}
      onClose={onClose}
      testID="goal-allocate-sheet"
      footer={
        <Button
          testID="goal-allocate-save"
          label={t('goals.addMoney')}
          disabled={amountMinor === null || amountMinor <= 0n}
          onPress={async () => {
            await onSave(amountMinor!, fromId === goal.accountId ? undefined : fromId);
            toast.show(t('goals.allocateSaved'));
          }}
        />
      }
    >
      <Text tone="textSecondary">{t('goals.allocateCaption')}</Text>
      <AmountInput testID="goal-allocate-amount" label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="goal-from-account" label={t('goals.fromAccount')} options={accounts} value={fromId} onChange={setFromId} />
    </Sheet>
  );
}

function GoalDetailSheet({
  goal,
  snapshot,
  repo,
  saved,
  onClose,
  onSpend,
}: {
  goal: Goal;
  snapshot: Snapshot;
  repo: WorkspaceRepository;
  saved: GoalCard;
  onClose: () => void;
  onSpend: () => void;
}) {
  const toast = useToast();
  const [scheduleAmount, setScheduleAmount] = useState(goal.scheduleAmountMinor ? formatNaira(BigInt(goal.scheduleAmountMinor)) : '');
  const [scheduleMinor, setScheduleMinor] = useState<bigint | null>(goal.scheduleAmountMinor ? BigInt(goal.scheduleAmountMinor) : null);
  const [scheduleDay, setScheduleDay] = useState(goal.scheduleDayOfMonth ? String(goal.scheduleDayOfMonth) : '');
  const list = snapshot.allocations.filter((a) => a.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Sheet
      visible
      title={goal.name}
      onClose={onClose}
      testID="goal-detail-sheet"
      footer={
        goal.status === 'active' ? (
          <Button testID="goal-spend" kind="secondary" label={t('goals.spendFromGoal')} onPress={onSpend} />
        ) : undefined
      }
    >
      <Amount minor={saved.saved} /> {t('goals.of')} <Amount minor={saved.target} />
      {goal.scheduleAmountMinor ? (
        <Text variant="caption" tone="textSecondary">
          {t('goals.scheduleTitle')}: {formatNaira(BigInt(goal.scheduleAmountMinor))} · {t('goals.scheduleDay')} {goal.scheduleDayOfMonth}
        </Text>
      ) : null}
      {list.map((a) => (
        <Text key={a.id} variant="caption" tone="textSecondary">
          {formatDay(a.date)} · {a.kind === 'spend' ? '-' : ''}
          <Amount minor={BigInt(a.amountMinor)} variant="caption" />
        </Text>
      ))}
      {goal.status === 'active' ? (
        <>
          <Text variant="heading-sm">{t('goals.scheduleTitle')}</Text>
          <AmountInput
            testID="goal-schedule-amount"
            label={t('goals.scheduleAmount')}
            value={scheduleAmount}
            onChange={(text, minor) => {
              setScheduleAmount(text);
              setScheduleMinor(minor);
            }}
          />
          <TextInput testID="goal-schedule-day" label={t('goals.scheduleDay')} value={scheduleDay} onChangeText={setScheduleDay} keyboardType="number-pad" />
          <Button
            testID="goal-schedule-save"
            kind="secondary"
            label={t('panel.save')}
            onPress={() =>
              void repo
                .updateGoal({
                  ...goal,
                  scheduleAmountMinor: scheduleMinor && scheduleMinor > 0n ? scheduleMinor.toString() : undefined,
                  scheduleDayOfMonth: scheduleDay ? Math.min(31, Math.max(1, Number(scheduleDay))) : undefined,
                })
                .then(() => toast.show(t('goals.scheduleSaved')))
            }
          />
        </>
      ) : null}
    </Sheet>
  );
}

function SpendFromGoalSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: { accountId: string; categoryId: string; amount: bigint; date: string }) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [accountId, setAccountId] = useState(goal.accountId);
  const [categoryId, setCategoryId] = useState(snapshot.categories.find((c) => c.kind === 'expense')?.id ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense').map((c) => ({ value: c.id, label: c.name }));

  return (
    <Sheet
      visible
      title={t('goals.spendTitle')}
      onClose={onClose}
      testID="goal-spend-sheet"
      footer={
        <Button
          testID="goal-spend-save"
          label={t('panel.save')}
          disabled={amountMinor === null || amountMinor <= 0n || !categoryId}
          onPress={() => void onSave({ accountId, categoryId, amount: amountMinor!, date: today() })}
        />
      }
    >
      <Text tone="textSecondary">{t('goals.spendCaption')}</Text>
      <AmountInput testID="goal-spend-amount" label={t('add.amount')} value={amountText} onChange={(text, minor) => { setAmountText(text); setAmountMinor(minor); }} />
      <Select testID="goal-spend-category" label={t('goals.spendCategory')} options={categories} value={categoryId} onChange={setCategoryId} />
      <Select testID="goal-spend-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}
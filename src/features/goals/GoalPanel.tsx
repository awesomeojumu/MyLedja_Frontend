import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';

import { Amount, Button, Confirm, Icon, LineChart, Menu, Panel, StatusPill, Text, formatDay, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import type { Snapshot, WorkspaceRepository } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { type GoalCard, goalProgressPoints, goalStatusKind, statusPillFor } from './helpers';

const sp = tokens.spacing;

export function GoalPanel({
  card,
  snapshot,
  repo,
  today,
  onClose,
  onEdit,
  onSchedule,
  onSpend,
  onAllocate,
}: {
  card: GoalCard;
  snapshot: Snapshot;
  repo: WorkspaceRepository;
  today: string;
  onClose: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onSpend: () => void;
  onAllocate: () => void;
}) {
  const theme = useTheme();
  const toast = useToast();
  const { goal } = card;
  const category = goal.categoryId ? snapshot.categories.find((c) => c.id === goal.categoryId)?.name : undefined;
  const allocations = snapshot.allocations.filter((a) => a.goalId === goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const progress = goalProgressPoints(goal.id, snapshot, today);
  const pct = Math.round(card.progress * 100);
  const kind = goalStatusKind(card, today);
  const pill = statusPillFor(kind);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const menuItems = [
    { key: 'edit', label: t('goals.editGoal'), onPress: onEdit },
    goal.status === 'paused'
      ? { key: 'resume', label: t('goals.resumeGoal'), onPress: () => void repo.updateGoal({ ...goal, status: 'active' }) }
      : { key: 'pause', label: t('goals.pauseGoal'), onPress: () => void repo.updateGoal({ ...goal, status: 'paused' }) },
    goal.status === 'active'
      ? {
          key: 'done',
          label: t('goals.markDone'),
          onPress: () => void repo.updateGoal({ ...goal, status: 'completed', completedAt: new Date().toISOString() }),
        }
      : null,
    { key: 'schedule', label: goal.scheduleAmountMinor ? t('goals.editSchedule') : t('goals.addSchedule'), onPress: onSchedule },
    { key: 'delete', label: t('goals.deleteGoal'), onPress: () => setDeleteOpen(true) },
  ].filter(Boolean) as { key: string; label: string; onPress: () => void }[];

  return (
    <>
      <Panel visible title={goal.name} onClose={onClose} testID="goal-detail-panel">
        <View style={{ gap: sp['spacing-lg'] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: sp['spacing-xs'], flex: 1 }}>
              <StatusPill label={t(pill.labelKey)} kind={pill.pill} />
              <Text variant="heading-sm">
                <Amount minor={card.saved} variant="heading-sm" /> {t('goals.of')} <Amount minor={card.target} variant="heading-sm" />
              </Text>
              <Text variant="caption" tone="textSecondary">
                {t('goals.percentProgress', { percent: String(pct) })}
              </Text>
              {goal.targetDate && card.monthly ? (
                <Text testID="goal-panel-needed" variant="caption" tone="textSecondary">
                  {t('goals.neededLine', { date: formatDay(goal.targetDate), amount: formatNaira(card.monthly) })}
                </Text>
              ) : null}
            </View>
            <Menu
              testID="goal-panel-menu"
              trigger={(open) => (
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.options')} onPress={open} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={MoreHorizontal} size="nav" color={theme.textSecondary} />
                </Pressable>
              )}
              items={menuItems}
            />
          </View>

          {progress.length > 1 || (progress.length === 1 && progress[0]!.value > 0n) ? (
            <LineChart testID="goal-progress-chart" title={t('goals.panelProgress')} columns={[t('goals.panelProgressDate'), t('goals.panelProgressSaved')]} rows={progress} />
          ) : null}

          <View style={{ gap: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{t('goals.panelAllocations')}</Text>
            {allocations.length === 0 ? (
              <Text tone="textSecondary">{t('goals.noAllocations')}</Text>
            ) : (
              allocations.map((a) => (
                <Text key={a.id} variant="caption" tone="textSecondary">
                  {formatDay(a.date)} · {a.kind === 'spend' ? '−' : '+'}
                  {formatNaira(BigInt(a.amountMinor))}
                </Text>
              ))
            )}
          </View>

          <View style={{ gap: sp['spacing-xs'] }}>
            <Text variant="heading-sm">{t('goals.scheduleTitle')}</Text>
            {goal.scheduleAmountMinor && goal.scheduleDayOfMonth ? (
              <Text tone="textSecondary">{t('goals.scheduleCaption', { amount: formatNaira(BigInt(goal.scheduleAmountMinor)), day: String(goal.scheduleDayOfMonth) })}</Text>
            ) : (
              <Text tone="textSecondary">{t('goals.scheduleEmpty')}</Text>
            )}
            <Button testID="goal-panel-schedule" kind="secondary" label={goal.scheduleAmountMinor ? t('goals.editSchedule') : t('goals.addSchedule')} onPress={onSchedule} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-md'] }}>
            <Text tone="textSecondary">{t('goals.linkedCategory')}</Text>
            <Text style={{ flexShrink: 1, textAlign: 'right' }}>{category ?? t('goals.noCategory')}</Text>
          </View>

          {goal.notes ? (
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text variant="heading-sm">{t('goals.notesOptional')}</Text>
              <Text tone="textSecondary">{goal.notes}</Text>
            </View>
          ) : null}

          <Text tone="textSecondary">{t('goals.inAccount', { name: card.accountName })}</Text>

          {goal.status === 'active' || goal.status === 'paused' ? (
            <View style={{ gap: sp['spacing-sm'] }}>
              <Button testID="goal-panel-allocate" label={t('goals.addMoney')} onPress={onAllocate} />
              <Button testID="goal-spend" kind="secondary" label={t('goals.spendFromGoal')} onPress={onSpend} />
            </View>
          ) : null}
        </View>
      </Panel>
      <Confirm
        visible={deleteOpen}
        title={t('goals.deleteTitle', { name: goal.name })}
        body={t('goals.deleteBody', { amount: formatNaira(card.saved), account: card.accountName })}
        confirmLabel={t('goals.deleteConfirm')}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void repo.deleteGoal(goal.id).then((r) => {
            if (r.ok) {
              toast.show(t('goals.deleteConfirm'));
              onClose();
            }
          });
          setDeleteOpen(false);
        }}
      />
    </>
  );
}

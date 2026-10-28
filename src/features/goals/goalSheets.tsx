import { useMemo, useState } from 'react';

import {
  AmountInput,
  Button,
  DatePicker,
  Select,
  Sheet,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import type { Goal } from '@/data/workspace/model';
import type { Snapshot, WorkspaceRepository } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { goalProgress, goalSaved } from './helpers';

type SnapshotNonNull = NonNullable<ReturnType<typeof useWorkspace>['snapshot']>;

export function AddGoalSheet({
  snapshot,
  existing,
  initialName,
  onClose,
  onSave,
}: {
  snapshot: SnapshotNonNull;
  existing?: Goal;
  initialName?: string;
  onClose: () => void;
  onSave: (input: { name: string; targetMinor: bigint; accountId: string; targetDate?: string; categoryId?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? initialName ?? '');
  const [amountText, setAmountText] = useState(existing ? formatNaira(BigInt(existing.targetMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(existing ? BigInt(existing.targetMinor) : null);
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const categories = snapshot.categories.filter((c) => c.kind === 'expense' && !c.deleted).map((c) => ({ value: c.id, label: c.name }));
  const categoryOptions = [{ value: '__none__' as const, label: t('goals.noCategory') }, ...categories];

  return (
    <Sheet
      visible
      title={existing ? t('goals.editTitle') : t('goals.addTitle')}
      onClose={onClose}
      testID="goal-add-sheet"
      footer={
        <Button
          testID="goal-save"
          label={t('panel.save')}
          disabled={!name.trim() || !accountId || amountMinor === null || amountMinor <= 0n}
          onPress={() =>
            void onSave({
              name,
              targetMinor: amountMinor!,
              accountId,
              targetDate: targetDate || undefined,
              categoryId: categoryId && categoryId !== '__none__' ? categoryId : undefined,
            })
          }
        />
      }
    >
      <TextInput testID="goal-name" label={t('goals.name')} value={name} onChangeText={setName} />
      <AmountInput
        testID="goal-target"
        label={t('goals.target')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <Select testID="goal-account" label={t('goals.account')} options={accounts} value={accountId} onChange={setAccountId} />
      <Select
        testID="goal-category"
        label={t('goals.budgetCategory')}
        options={categoryOptions}
        value={categoryId || '__none__'}
        onChange={(v) => setCategoryId(v === '__none__' ? '' : v)}
      />
      <TextInput testID="goal-date" label={t('goals.targetDate')} value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" />
    </Sheet>
  );
}

export function AllocateSheet({
  goal,
  snapshot,
  onClose,
  onSave,
}: {
  goal: Goal;
  snapshot: SnapshotNonNull;
  onClose: () => void;
  onSave: (amount: bigint, date: string, fromAccountId?: string) => Promise<void>;
}) {
  const toast = useToast();
  const [amountText, setAmountText] = useState('');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromId, setFromId] = useState(goal.accountId);
  const accounts = snapshot.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }));
  const saved = goalSaved(goal.id, snapshot);
  const target = BigInt(goal.targetMinor);
  const preview = useMemo(() => {
    if (amountMinor === null || amountMinor <= 0n) return null;
    const next = saved + amountMinor;
    return Math.round(goalProgress(next, target) * 100);
  }, [amountMinor, saved, target]);

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
            await onSave(amountMinor!, date, fromId === goal.accountId ? undefined : fromId);
            toast.show(t('goals.allocateSaved'));
          }}
        />
      }
    >
      <Text tone="textSecondary">{t('goals.allocateCaption')}</Text>
      <AmountInput
        testID="goal-allocate-amount"
        label={t('add.amount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <DatePicker testID="goal-allocate-date" label={t('add.date')} value={date} onChange={setDate} />
      <Select testID="goal-from-account" label={t('goals.fromAccount')} options={accounts} value={fromId} onChange={setFromId} />
      {preview !== null ? (
        <Text variant="caption" tone="textSecondary" testID="goal-allocate-preview">
          {t('goals.allocatePreview', { percent: String(preview) })}
        </Text>
      ) : null}
    </Sheet>
  );
}

/** DESIGN popup #33 — monthly schedule, separate from the goal panel. */
export function GoalScheduleSheet({
  goal,
  repo,
  onClose,
}: {
  goal: Goal;
  repo: WorkspaceRepository;
  onClose: () => void;
}) {
  const toast = useToast();
  const [amountText, setAmountText] = useState(goal.scheduleAmountMinor ? formatNaira(BigInt(goal.scheduleAmountMinor)) : '');
  const [amountMinor, setAmountMinor] = useState<bigint | null>(goal.scheduleAmountMinor ? BigInt(goal.scheduleAmountMinor) : null);
  const [day, setDay] = useState(goal.scheduleDayOfMonth ? String(goal.scheduleDayOfMonth) : '28');
  const caption =
    amountMinor && amountMinor > 0n && day
      ? t('goals.scheduleCaption', { amount: formatNaira(amountMinor), day })
      : t('goals.scheduleHint');

  return (
    <Sheet
      visible
      title={t('goals.schedulePopupTitle')}
      onClose={onClose}
      testID="goal-schedule-sheet"
      footer={
        <Button
          testID="goal-schedule-save"
          label={t('panel.save')}
          disabled={amountMinor === null || amountMinor <= 0n || !day.trim()}
          onPress={() =>
            void repo
              .updateGoal({
                ...goal,
                scheduleAmountMinor: amountMinor!.toString(),
                scheduleDayOfMonth: Math.min(31, Math.max(1, Number(day))),
              })
              .then(() => {
                toast.show(t('goals.scheduleSaved'));
                onClose();
              })
          }
        />
      }
    >
      <Text tone="textSecondary">{caption}</Text>
      <AmountInput
        testID="goal-schedule-amount"
        label={t('goals.scheduleAmount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <TextInput testID="goal-schedule-day" label={t('goals.scheduleDay')} value={day} onChangeText={setDay} keyboardType="number-pad" />
    </Sheet>
  );
}

export function SpendFromGoalSheet({
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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
          onPress={() => void onSave({ accountId, categoryId, amount: amountMinor!, date })}
        />
      }
    >
      <Text tone="textSecondary">{t('goals.spendCaption')}</Text>
      <AmountInput
        testID="goal-spend-amount"
        label={t('add.amount')}
        value={amountText}
        onChange={(text, minor) => {
          setAmountText(text);
          setAmountMinor(minor);
        }}
      />
      <DatePicker testID="goal-spend-date" label={t('add.date')} value={date} onChange={setDate} />
      <Select testID="goal-spend-category" label={t('goals.spendCategory')} options={categories} value={categoryId} onChange={setCategoryId} />
      <Select testID="goal-spend-account" label={t('add.account')} options={accounts} value={accountId} onChange={setAccountId} />
    </Sheet>
  );
}
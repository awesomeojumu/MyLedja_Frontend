import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Category } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira, toInputText } from '@/money';

import {
  assignNoteOf,
  assignedOf,
  prevMonth,
  templateAmountForCategory,
  threeMonthAverage,
} from './helpers';

const sp = tokens.spacing;

export function EditAmountSheet({
  visible,
  categoryId,
  category,
  month,
  snapshot,
  categoryOrder,
  onClose,
  onSave,
  onNext,
}: {
  visible: boolean;
  categoryId: string | null;
  category: Category | undefined;
  month: string;
  snapshot: Snapshot;
  /** Flat category ids in display order for Next (#7). */
  categoryOrder: string[];
  onClose: () => void;
  onSave: (amount: bigint, opts: { carryOver: boolean; note: string }) => Promise<void>;
  onNext?: (nextId: string) => void;
}) {
  const [editText, setEditText] = useState('');
  const [editMinor, setEditMinor] = useState<bigint | null>(null);
  const [carryOver, setCarryOver] = useState(false);
  const [note, setNote] = useState('');

  // Fill the form each time it opens for a category and month (not on every snapshot refresh).
  const openKey = visible && categoryId ? `${categoryId}:${month}` : null;
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey && categoryId) {
      const assigned = assignedOf(snapshot, categoryId, month);
      setEditText(toInputText(assigned));
      setEditMinor(assigned);
      setCarryOver(category?.carryOver ?? false);
      setNote(assignNoteOf(snapshot, categoryId, month));
    }
  }

  const templateAmount = useMemo(
    () => (categoryId ? templateAmountForCategory(snapshot, categoryId, month) : null),
    [snapshot, categoryId, month],
  );

  const nextId = useMemo(() => {
    if (!categoryId) return null;
    const i = categoryOrder.indexOf(categoryId);
    if (i < 0 || i >= categoryOrder.length - 1) return null;
    return categoryOrder[i + 1] ?? null;
  }, [categoryId, categoryOrder]);

  const save = async () => {
    if (editMinor === null || editMinor < 0n) return;
    await onSave(editMinor, { carryOver, note });
  };

  const saveAndNext = async () => {
    await save();
    if (nextId && onNext) onNext(nextId);
  };

  return (
    <Sheet
      visible={visible && categoryId !== null}
      title={t('budget.editAmount', { name: category?.name ?? '' })}
      onClose={onClose}
      testID="budget-edit-sheet"
      footer={
        <View style={{ gap: sp['spacing-sm'] }}>
          <Button testID="budget-edit-save" label={t('budget.save')} onPress={() => void save()} disabled={editMinor === null || editMinor < 0n} />
          {nextId ? (
            <Button testID="budget-edit-next" kind="secondary" label={t('budget.editNext')} onPress={() => void saveAndNext()} disabled={editMinor === null || editMinor < 0n} />
          ) : null}
        </View>
      }
    >
      <AmountInput label={t('budget.col.planned')} value={editText} onChange={(text, minor) => { setEditText(text); setEditMinor(minor); }} testID="budget-edit-amount" />
      {categoryId ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <Button
            kind="link"
            label={t('budget.quickLastMonth', { amount: formatNaira(assignedOf(snapshot, categoryId, prevMonth(month))) })}
            onPress={() => {
              const v = assignedOf(snapshot, categoryId, prevMonth(month));
              setEditMinor(v);
              setEditText(toInputText(v));
            }}
          />
          <Button
            kind="link"
            label={t('budget.quickThreeMonthAvg', { amount: formatNaira(threeMonthAverage(snapshot, categoryId, month)) })}
            onPress={() => {
              const v = threeMonthAverage(snapshot, categoryId, month);
              setEditMinor(v);
              setEditText(toInputText(v));
            }}
          />
          {templateAmount !== null ? (
            <Button
              testID="budget-edit-template-pick"
              kind="link"
              label={t('budget.quickTemplate', { amount: formatNaira(templateAmount) })}
              onPress={() => {
                setEditMinor(templateAmount);
                setEditText(toInputText(templateAmount));
              }}
            />
          ) : null}
        </View>
      ) : null}
      {snapshot.settings.budgetStyle === 'tracking' ? (
        <Switch testID="budget-edit-carry" label={t('budget.carryOverSwitch')} value={carryOver} onChange={setCarryOver} />
      ) : (
        <Text variant="caption" tone="textSecondary">
          {t('budget.carryOverEnvelopeHint')}
        </Text>
      )}
      <TextInput testID="budget-edit-note" label={t('budget.planNote')} value={note} onChangeText={setNote} multiline />
    </Sheet>
  );
}

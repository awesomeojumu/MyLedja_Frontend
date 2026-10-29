import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AmountInput, Button, Confirm, Footer, Popover, Sheet, Switch, Text, TextInput } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { useSizeClass } from '@/design/size';
import type { Category } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira, toInputText } from '@/money';

import {
  assignNoteOf,
  assignedOf,
  prevMonth,
  rowFor,
  templateAmountForCategory,
  threeMonthAverage,
} from './helpers';
import { warningHaptic } from './haptics';

const sp = tokens.spacing;

function Chip({
  testID,
  label,
  onPress,
}: {
  testID?: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: sp['spacing-md'],
        paddingVertical: sp['spacing-sm'],
        borderRadius: tokens.radius['rounded-md'],
        borderWidth: 1,
        borderColor: theme.border,
        minHeight: 44,
        justifyContent: 'center',
      }}
    >
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

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
  categoryOrder: string[];
  onClose: () => void;
  onSave: (amount: bigint, opts: { carryOver: boolean; note: string }) => Promise<void>;
  onNext?: (nextId: string) => void;
}) {
  const phone = useSizeClass() === 'phone';
  const [editText, setEditText] = useState('');
  const [editMinor, setEditMinor] = useState<bigint | null>(null);
  const [carryOver, setCarryOver] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
      setBusy(false);
    }
  }

  const initialAssigned = categoryId ? assignedOf(snapshot, categoryId, month) : 0n;
  const initialNote = categoryId ? assignNoteOf(snapshot, categoryId, month) : '';
  const dirty =
    (editMinor ?? 0n) !== initialAssigned ||
    note !== initialNote ||
    carryOver !== (category?.carryOver ?? false);

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

  // Envelope: always (addendum). Tracking: always so carry can be turned on (existing P06-12).
  const showCarry = true;

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const save = async (andNext: boolean) => {
    if (editMinor === null || editMinor < 0n || busy || !categoryId) return;
    setBusy(true);
    try {
      const row = rowFor(snapshot, month, categoryId);
      const plan = editMinor;
      if (plan < row.activity && phone) warningHaptic();
      await onSave(editMinor, { carryOver, note });
      if (andNext && nextId && onNext) onNext(nextId);
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <View style={{ gap: sp['spacing-md'] }}>
      <AmountInput
        label={t('budget.plannedFor', { name: category?.name ?? '' })}
        value={editText}
        onChange={(text, minor) => {
          setEditText(text);
          setEditMinor(minor);
        }}
        testID="budget-edit-amount"
      />
      {categoryId ? (
        <View testID="budget-edit-quick-picks" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
          <Chip
            label={t('budget.quickLastMonth', { amount: formatNaira(assignedOf(snapshot, categoryId, prevMonth(month))) })}
            onPress={() => {
              const v = assignedOf(snapshot, categoryId, prevMonth(month));
              setEditMinor(v);
              setEditText(toInputText(v));
            }}
          />
          <Chip
            label={t('budget.quickThreeMonthAvg', { amount: formatNaira(threeMonthAverage(snapshot, categoryId, month)) })}
            onPress={() => {
              const v = threeMonthAverage(snapshot, categoryId, month);
              setEditMinor(v);
              setEditText(toInputText(v));
            }}
          />
          {templateAmount !== null ? (
            <Chip
              testID="budget-edit-template-pick"
              label={t('budget.quickTemplate', { amount: formatNaira(templateAmount) })}
              onPress={() => {
                setEditMinor(templateAmount);
                setEditText(toInputText(templateAmount));
              }}
            />
          ) : null}
        </View>
      ) : null}
      {showCarry ? (
        <Switch testID="budget-edit-carry" label={t('budget.carryOverSwitch')} value={carryOver} onChange={setCarryOver} />
      ) : null}
      <TextInput
        testID="budget-edit-note"
        label={t('budget.notesOptional')}
        value={note}
        onChangeText={setNote}
        multiline
        // Web: Enter in amount is handled via Save; Tab moves via Next.
        onSubmitEditing={() => void save(false)}
      />
      <Footer>
        <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} disabled={busy} />
        <Button
          testID="budget-edit-save"
          label={phone ? t('budget.editDone') : t('budget.savePlan')}
          onPress={() => void save(false)}
          disabled={editMinor === null || editMinor < 0n || busy}
        />
      </Footer>
      {nextId ? (
        <Button
          testID="budget-edit-next"
          kind="secondary"
          label={t('budget.editNext')}
          onPress={() => void save(true)}
          disabled={editMinor === null || editMinor < 0n || busy}
        />
      ) : null}
    </View>
  );

  return (
    <>
      {phone ? (
        <Sheet
          visible={visible && categoryId !== null}
          title={t('budget.editAmount', { name: category?.name ?? '' })}
          onClose={requestClose}
          testID="budget-edit-sheet"
          width={480}
        >
          {body}
        </Sheet>
      ) : (
        <Popover visible={visible && categoryId !== null} onClose={requestClose} testID="budget-edit-sheet">
          <Text variant="heading-sm">{t('budget.editAmount', { name: category?.name ?? '' })}</Text>
          {body}
        </Popover>
      )}
      <Confirm
        visible={confirmDiscard}
        title={t('common.discardTitle')}
        body={t('common.discardBody')}
        confirmLabel={t('common.discardConfirm')}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

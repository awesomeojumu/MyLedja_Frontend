import { useState } from 'react';
import { View } from 'react-native';

import { AmountInput, Button, Confirm, Footer, InlineError, Select, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { budgetCategories, rowFor } from './helpers';

const sp = tokens.spacing;

export function MoveMoneySheet({
  visible,
  month,
  snapshot,
  fromCategoryId,
  onClose,
  onSave,
}: {
  visible: boolean;
  month: string;
  snapshot: Snapshot;
  fromCategoryId?: string | null;
  onClose: () => void;
  onSave: (fromId: string, toId: string, amount: bigint) => Promise<void>;
}) {
  const cats = budgetCategories(snapshot);
  const withAvailable = cats.filter((c) => rowFor(snapshot, month, c.id).available > 0n);
  const defaultFrom = fromCategoryId && withAvailable.some((c) => c.id === fromCategoryId) ? fromCategoryId : withAvailable[0]?.id ?? '';
  const [fromId, setFromId] = useState(defaultFrom);
  const [toId, setToId] = useState(cats.find((c) => c.id !== defaultFrom)?.id ?? '');
  const [text, setText] = useState('');
  const [minor, setMinor] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [filledFor, setFilledFor] = useState<string | null>(null);

  const openKey = visible ? `${fromCategoryId ?? ''}:${month}` : null;
  if (openKey !== filledFor) {
    setFilledFor(openKey);
    if (openKey) {
      const from = fromCategoryId && withAvailable.some((c) => c.id === fromCategoryId) ? fromCategoryId : withAvailable[0]?.id ?? '';
      setFromId(from);
      setToId(cats.find((c) => c.id !== from)?.id ?? '');
      setText('');
      setMinor(null);
      setFieldError(null);
      setBusy(false);
    }
  }

  const fromRow = fromId ? rowFor(snapshot, month, fromId) : null;
  const toRow = toId ? rowFor(snapshot, month, toId) : null;
  const fromCat = cats.find((c) => c.id === fromId);
  const toCat = cats.find((c) => c.id === toId);
  const fromOptions = withAvailable.map((c) => ({ value: c.id, label: c.name }));
  const toOptions = cats.filter((c) => c.id !== fromId).map((c) => ({ value: c.id, label: c.name }));
  const dirty = text !== '' || (fromCategoryId ? fromId !== fromCategoryId : false);
  const sameCategory = Boolean(fromId && toId && fromId === toId);
  const overAvailable = fromRow !== null && minor !== null && minor > fromRow.available;
  const valid = Boolean(fromId && toId && !sameCategory && minor !== null && minor > 0n && !overAvailable);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const save = async () => {
    if (!valid || busy || minor === null) return;
    if (sameCategory) {
      setFieldError(t('budget.moveDifferentCategory'));
      return;
    }
    if (overAvailable && fromCat && fromRow) {
      setFieldError(t('budget.moveOnlyAvailable', { name: fromCat.name, amount: formatNaira(fromRow.available) }));
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      await onSave(fromId, toId, minor);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        title={t('budget.moveMoney')}
        onClose={requestClose}
        testID="budget-move-sheet"
        width={480}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} disabled={busy} />
            <Button testID="budget-move-save" label={t('budget.moveSave')} disabled={!valid || busy} onPress={() => void save()} />
          </Footer>
        }
      >
        <Select
          testID="budget-move-from"
          label={t('budget.moveFrom')}
          options={fromOptions}
          value={fromId}
          onChange={(v) => {
            setFromId(v);
            setFieldError(null);
            if (toId === v) setToId(cats.find((c) => c.id !== v)?.id ?? '');
          }}
        />
        {fromRow && fromCat ? (
          <Text variant="caption" tone="textSecondary">
            {t('budget.moveRemaining', { amount: formatNaira(fromRow.available) })}
          </Text>
        ) : null}
        <Select
          testID="budget-move-to"
          label={t('budget.moveTo')}
          options={toOptions}
          value={toId}
          onChange={(v) => {
            setToId(v);
            setFieldError(null);
          }}
        />
        <AmountInput
          label={t('budget.moveAmount')}
          value={text}
          onChange={(v, m) => {
            setText(v);
            setMinor(m);
            setFieldError(null);
          }}
          testID="budget-move-amount"
        />
        {sameCategory ? <InlineError message={t('budget.moveDifferentCategory')} /> : null}
        {overAvailable && fromCat && fromRow ? (
          <InlineError message={t('budget.moveOnlyAvailable', { name: fromCat.name, amount: formatNaira(fromRow.available) })} />
        ) : null}
        {fieldError ? <InlineError message={fieldError} /> : null}
        {fromRow && toRow && fromCat && toCat && minor !== null && minor > 0n ? (
          <View testID="budget-move-preview" style={{ gap: sp['spacing-xs'] }}>
            <Text variant="caption">
              {t('budget.movePreviewLine', {
                fromName: fromCat.name,
                fromBefore: formatNaira(fromRow.assigned),
                fromAfter: formatNaira(fromRow.assigned - minor),
                toName: toCat.name,
                toBefore: formatNaira(toRow.assigned),
                toAfter: formatNaira(toRow.assigned + minor),
              })}
            </Text>
          </View>
        ) : null}
      </Sheet>
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

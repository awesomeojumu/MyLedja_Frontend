import { useState } from 'react';
import { View } from 'react-native';

import { Button, Confirm, Footer, InlineError, Select, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { WorkspaceRepository, type Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { budgetCategories, budgetForMonth, overspentCategories, rowFor } from './helpers';

const sp = tokens.spacing;
const LEFT = WorkspaceRepository.LEFT_TO_PLAN;

export function CoverSheet({
  visible,
  month,
  snapshot,
  onClose,
  onSave,
}: {
  visible: boolean;
  month: string;
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (covers: { overspentId: string; fromId: string; amount: bigint }[]) => Promise<void>;
}) {
  const overspent = overspentCategories(snapshot, month);
  const leftToPlan = budgetForMonth(snapshot, month).leftToPlan;
  const sources = budgetCategories(snapshot).filter((c) => !overspent.some((o) => o.category.id === c.id) && rowFor(snapshot, month, c.id).available > 0n);
  const sourceOptions = [
    ...(snapshot.settings.budgetStyle === 'envelope' && leftToPlan > 0n
      ? [{ value: LEFT, label: t('budget.coverLeftToPlan'), available: leftToPlan }]
      : []),
    ...sources.map((s) => ({ value: s.id, label: s.name, available: rowFor(snapshot, month, s.id).available })),
  ];

  const richest = () =>
    sourceOptions.reduce<{ value: string; available: bigint } | null>((best, s) => {
      if (!best || s.available > best.available) return { value: s.value, available: s.available };
      return best;
    }, null)?.value ?? '';

  const [fromBy, setFromBy] = useState<Record<string, string>>(() =>
    Object.fromEntries(overspent.map((o) => [o.category.id, richest()])),
  );
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledFor, setFilledFor] = useState(false);

  if (visible && !filledFor) {
    setFilledFor(true);
    setFromBy(Object.fromEntries(overspent.map((o) => [o.category.id, richest()])));
    setError(null);
    setBusy(false);
  }
  if (!visible && filledFor) setFilledFor(false);

  const capacityError = overspent
    .map((o) => {
      const fromId = fromBy[o.category.id];
      if (!fromId) return null;
      const src = sourceOptions.find((s) => s.value === fromId);
      if (!src) return null;
      if (src.available < o.over) return t('budget.coverSourceShort', { name: src.label, amount: formatNaira(src.available) });
      return null;
    })
    .find(Boolean);

  const valid =
    overspent.length > 0 &&
    overspent.every((o) => fromBy[o.category.id]) &&
    !capacityError &&
    // Same source can't give more than it has across rows
    (() => {
      const used = new Map<string, bigint>();
      for (const o of overspent) {
        const fromId = fromBy[o.category.id]!;
        used.set(fromId, (used.get(fromId) ?? 0n) + o.over);
      }
      for (const [id, amt] of used) {
        const src = sourceOptions.find((s) => s.value === id);
        if (!src || src.available < amt) return false;
      }
      return true;
    })();

  const dirty = overspent.some((o) => fromBy[o.category.id] !== richest());
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onClose());

  const coverAll = () => {
    const pick = richest();
    setFromBy(Object.fromEntries(overspent.map((o) => [o.category.id, pick])));
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(
        overspent.map((o) => ({
          overspentId: o.category.id,
          fromId: fromBy[o.category.id]!,
          amount: o.over,
        })),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        visible={visible}
        title={t('budget.coverTitle')}
        onClose={requestClose}
        testID="budget-cover-sheet"
        width={480}
        footer={
          <View style={{ gap: sp['spacing-sm'] }}>
            <Button testID="budget-cover-all" kind="link" label={t('budget.coverAll')} onPress={coverAll} disabled={overspent.length === 0 || busy} />
            <Footer>
              <Button kind="secondary" label={t('common.cancel')} onPress={requestClose} disabled={busy} />
              <Button testID="budget-cover-save" label={t('budget.coverSave')} disabled={!valid || busy} onPress={() => void save()} />
            </Footer>
          </View>
        }
      >
        {overspent.length === 0 ? (
          <Text tone="textSecondary">{t('budget.coverNone')}</Text>
        ) : (
          overspent.map((o) => (
            <View key={o.category.id} testID={`cover-row-${o.category.id}`} style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
              <Text>{t('budget.coverRowOver', { name: o.category.name, amount: formatNaira(o.over) })}</Text>
              <Select
                testID={`cover-from-${o.category.id}`}
                label={t('budget.coverFrom')}
                options={sourceOptions.map((s) => ({ value: s.value, label: s.label }))}
                value={fromBy[o.category.id] ?? ''}
                onChange={(v) => setFromBy((prev) => ({ ...prev, [o.category.id]: v }))}
              />
            </View>
          ))
        )}
        {capacityError ? <InlineError message={capacityError} /> : null}
        {error ? <InlineError message={error} /> : null}
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

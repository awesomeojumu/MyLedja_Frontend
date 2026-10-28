import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Checkbox, Select, Sheet, Text } from '@/design/components';
import type { Payee } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { t } from '@/i18n';

import { mergeTransactionCount } from './helpers';

export function MergePayeesSheet({
  snapshot,
  payees,
  onClose,
  onMerge,
}: {
  snapshot: Snapshot;
  payees: Payee[];
  onClose: () => void;
  onMerge: (keepId: string, mergeIds: string[]) => Promise<void>;
}) {
  const [keepId, setKeepId] = useState(payees[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const options = payees.map((p) => ({ value: p.id, label: p.name }));

  const mergeIds = useMemo(() => [...selected].filter((id) => id !== keepId), [selected, keepId]);
  const moveCount = mergeTransactionCount(snapshot, mergeIds);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Sheet
      visible
      title={t('payees.mergeTitle')}
      onClose={onClose}
      testID="payees-merge-sheet"
      footer={
        <Button
          testID="payees-merge-save"
          label={t('payees.mergeConfirm')}
          disabled={!keepId || mergeIds.length === 0}
          onPress={() => void onMerge(keepId, mergeIds)}
        />
      }
    >
      <Text tone="textSecondary">{t('payees.mergeBody')}</Text>
      <Select testID="payees-merge-keep" label={t('payees.mergeKeep')} options={options} value={keepId} onChange={setKeepId} />
      <Text variant="heading-sm">{t('payees.mergePick')}</Text>
      {payees
        .filter((p) => p.id !== keepId)
        .map((p) => (
          <Checkbox key={p.id} testID={`payees-merge-${p.id}`} label={p.name} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
        ))}
      {mergeIds.length ? (
        <View>
          <Text tone="textSecondary">{t('payees.mergeMoveCount', { count: moveCount })}</Text>
          <Text variant="caption" tone="textSecondary">
            {t('payees.mergeUndoHint')}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

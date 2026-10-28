import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Select, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { duplicateTransferPairs } from './transferMatch';

const sp = tokens.spacing;

/** Popup #21 — pair duplicate transfer imports (DESIGN page 11). */
export function TransferMatchSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const candidates = useMemo(() => duplicateTransferPairs(snapshot).slice(0, 20), [snapshot]);

  const [selected, setSelected] = useState<string | null>(null);
  const pair = candidates.find((p) => `${p.a.id}:${p.b.id}` === selected);

  return (
    <Sheet
      visible
      testID="tx-transfer-match"
      title={t('tx.transferMatchTitle')}
      onClose={onClose}
      footer={
        pair ? (
          <Button
            testID="tx-transfer-delete-dup"
            kind="secondary"
            label={t('tx.transferMatchRemove')}
            onPress={() => {
              void repo.deleteTransaction(pair.b.id, pair.b.date).then(onClose);
            }}
          />
        ) : undefined
      }
    >
      <Text tone="textSecondary">{t('tx.transferMatchBody')}</Text>
      {candidates.length === 0 ? (
        <Text style={{ marginTop: sp['spacing-md'] }}>{t('tx.transferMatchEmpty')}</Text>
      ) : (
        <View style={{ marginTop: sp['spacing-md'], gap: sp['spacing-sm'] }}>
          <Select
            testID="tx-transfer-pair"
            label={t('tx.transferMatchPick')}
            options={candidates.map((p) => ({
              value: `${p.a.id}:${p.b.id}`,
              label: `${p.a.date} · ${t('tx.transferMatchPairLabel')}`,
            }))}
            value={selected}
            onChange={setSelected}
          />
          {pair ? (
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text>{t('tx.transferMatchAmount')}</Text>
              <Amount minor={pair.amount} />
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

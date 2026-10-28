import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Select, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

const sp = tokens.spacing;

function transferAmount(snapshot: Snapshot, e: TxEvent): bigint {
  const accounts = new Set(snapshot.accounts.map((a) => a.id));
  return e.lines.find((l) => accounts.has(l.ledgerAccountId) && l.amountMinor > 0n)?.amountMinor ?? 0n;
}

/** Popup #21 — pair duplicate transfer imports (DESIGN page 11). */
export function TransferMatchSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const candidates = useMemo(() => {
    const transfers = snapshot.events.filter((e) => e.status === 'posted' && e.type === 'transfer');
    const pairs: { a: TxEvent; b: TxEvent; amount: bigint }[] = [];
    for (let i = 0; i < transfers.length; i += 1) {
      for (let j = i + 1; j < transfers.length; j += 1) {
        const a = transfers[i]!;
        const b = transfers[j]!;
        if (a.date !== b.date) continue;
        const amtA = transferAmount(snapshot, a);
        const amtB = transferAmount(snapshot, b);
        if (amtA > 0n && amtA === amtB) pairs.push({ a, b, amount: amtA });
      }
    }
    return pairs.slice(0, 20);
  }, [snapshot]);

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

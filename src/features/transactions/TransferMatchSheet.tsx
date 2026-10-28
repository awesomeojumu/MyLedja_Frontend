import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Footer, Select, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { pairKey, transferMatchCandidates, type TransferMatchPair } from './transferMatch';
import { rowsFor } from './helpers';

const sp = tokens.spacing;

/** Popup #21 — link opposite legs as a transfer, or dismiss (DESIGN page 11 / P11-09). */
export function TransferMatchSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void repo.transferDismissals().then(setDismissed);
  }, [repo, snapshot]);

  const candidates = useMemo(() => transferMatchCandidates(snapshot, dismissed).slice(0, 20), [snapshot, dismissed]);
  const pair = candidates.find((p) => pairKey(p.out.id, p.in.id) === selected);
  const labels = useMemo(() => labelMap(snapshot), [snapshot]);

  const link = async (p: TransferMatchPair) => {
    setBusy(true);
    setError(null);
    const r = await repo.linkAsTransfer(p.out.id, p.in.id);
    setBusy(false);
    if (!r.ok) {
      setError(t(`ledger.error.${r.error}` as 'ledger.error.missing_lines'));
      return;
    }
    onClose();
  };

  const dismiss = async (p: TransferMatchPair) => {
    setBusy(true);
    await repo.dismissTransferMatch(p.out.id, p.in.id);
    setBusy(false);
    setDismissed(new Set([...dismissed, pairKey(p.out.id, p.in.id)]));
    setSelected(null);
  };

  return (
    <Sheet
      visible
      testID="tx-transfer-match"
      title={t('tx.transferMatchTitle')}
      onClose={onClose}
      footer={
        pair ? (
          <Footer>
            <Button
              testID="tx-transfer-dismiss"
              kind="secondary"
              label={t('tx.transferMatchDismiss')}
              disabled={busy}
              onPress={() => void dismiss(pair)}
            />
            <Button testID="tx-transfer-link" label={t('tx.transferMatchLink')} disabled={busy} onPress={() => void link(pair)} />
          </Footer>
        ) : undefined
      }
    >
      <Text tone="textSecondary">{t('tx.transferMatchBody')}</Text>
      {error ? (
        <Text tone="textSecondary" style={{ marginTop: sp['spacing-sm'] }}>
          {error}
        </Text>
      ) : null}
      {candidates.length === 0 ? (
        <Text style={{ marginTop: sp['spacing-md'] }}>{t('tx.transferMatchEmpty')}</Text>
      ) : (
        <View style={{ marginTop: sp['spacing-md'], gap: sp['spacing-sm'] }}>
          <Select
            testID="tx-transfer-pair"
            label={t('tx.transferMatchPick')}
            options={candidates.map((p) => ({
              value: pairKey(p.out.id, p.in.id),
              label: t('tx.transferMatchPairLabel', {
                out: labels.get(p.out.id) ?? p.out.id,
                in: labels.get(p.in.id) ?? p.in.id,
              }),
            }))}
            value={selected}
            onChange={setSelected}
          />
          {pair ? (
            <View style={{ gap: sp['spacing-xs'] }}>
              <Text>{t('tx.transferMatchAmount')}</Text>
              <Amount minor={pair.amount} />
              <Text variant="caption" tone="textSecondary">
                {t('tx.transferMatchDays', { days: pair.daysApart })}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}

function labelMap(snapshot: Snapshot): Map<string, string> {
  const rows = rowsFor(snapshot);
  return new Map(rows.map((r) => [r.event.id, `${r.event.date} · ${r.title}`]));
}

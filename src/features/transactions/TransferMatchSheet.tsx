import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Footer, Sheet, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { pairKey, transferMatchCandidates, type TransferMatchPair } from './transferMatch';
import { rowsFor } from './helpers';

const sp = tokens.spacing;

/** Popup #21 — link opposite legs as a transfer, or dismiss (addendum PU-21). */
export function TransferMatchSheet({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const { repo } = useWorkspace();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void repo.transferDismissals().then(setDismissed);
  }, [repo, snapshot]);

  const candidates = useMemo(() => transferMatchCandidates(snapshot, dismissed).slice(0, 20), [snapshot, dismissed]);
  const labels = useMemo(() => labelMap(snapshot), [snapshot]);

  useEffect(() => {
    if (candidates.length === 0 && dismissed.size > 0) onClose();
  }, [candidates.length, dismissed.size, onClose]);

  const link = async (p: TransferMatchPair) => {
    setBusy(true);
    setError(null);
    const r = await repo.linkAsTransfer(p.out.id, p.in.id);
    setBusy(false);
    if (!r.ok) {
      setError(t(`ledger.error.${r.error}` as 'ledger.error.missing_lines'));
      return;
    }
    toast.show(t('tx.transferLinked'));
    if (candidates.length <= 1) onClose();
  };

  const dismiss = async (p: TransferMatchPair) => {
    setBusy(true);
    await repo.dismissTransferMatch(p.out.id, p.in.id);
    setBusy(false);
    setDismissed(new Set([...dismissed, pairKey(p.out.id, p.in.id)]));
  };

  return (
    <Sheet visible testID="tx-transfer-match" title={t('tx.transferMatchTitle')} onClose={onClose} width={640}>
      <Text tone="textSecondary">{t('tx.transferMatchBody')}</Text>
      {error ? (
        <Text tone="textSecondary" style={{ marginTop: sp['spacing-sm'] }}>
          {error}
        </Text>
      ) : null}
      {candidates.length === 0 ? (
        <Text style={{ marginTop: sp['spacing-md'] }}>{t('tx.transferMatchEmpty')}</Text>
      ) : (
        <View style={{ marginTop: sp['spacing-md'], gap: sp['spacing-lg'] }}>
          {candidates.map((p) => (
            <View
              key={pairKey(p.out.id, p.in.id)}
              testID={`tx-transfer-pair-${pairKey(p.out.id, p.in.id)}`}
              style={{ gap: sp['spacing-sm'], borderWidth: 1, borderColor: 'transparent' }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
                <View style={{ flex: 1, minWidth: 160, gap: sp['spacing-xxs'] }}>
                  <Text variant="caption" tone="textSecondary">
                    {t('tx.transferMatchOut')}
                  </Text>
                  <Text>{labels.get(p.out.id) ?? p.out.id}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: sp['spacing-xxs'] }}>
                  <Text variant="caption" tone="textSecondary">
                    {t('tx.transferMatchIn')}
                  </Text>
                  <Text>{labels.get(p.in.id) ?? p.in.id}</Text>
                </View>
              </View>
              <Amount minor={p.amount} />
              <Text variant="caption" tone="textSecondary">
                {t('tx.transferMatchDays', { days: p.daysApart })}
              </Text>
              <Footer>
                <Button
                  testID={`tx-transfer-dismiss-${pairKey(p.out.id, p.in.id)}`}
                  kind="secondary"
                  label={t('tx.transferMatchDismiss')}
                  disabled={busy}
                  onPress={() => void dismiss(p)}
                />
                <Button
                  testID={`tx-transfer-link-${pairKey(p.out.id, p.in.id)}`}
                  label={t('tx.transferMatchLink')}
                  disabled={busy}
                  onPress={() => void link(p)}
                />
              </Footer>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

function labelMap(snapshot: Snapshot): Map<string, string> {
  const rows = rowsFor(snapshot);
  return new Map(rows.map((r) => [r.event.id, `${r.event.date} · ${r.title}`]));
}

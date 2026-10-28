import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Amount, Button, Card, InlineError, Sheet, Text, formatDay } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { billMatchCandidates, type BillMatchCandidate } from './match';
import type { BillRow } from './recurrence';

const sp = tokens.spacing;

/** DESIGN popup #26 — Mark paid / match (page 12). */
export function MarkPaidMatchSheet({
  row,
  snapshot,
  visible,
  onClose,
  onDone,
}: {
  row: BillRow | null;
  snapshot: Snapshot;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { repo } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(() => {
    if (!row || row.recurring.kind === 'income') return [];
    return billMatchCandidates(snapshot, row);
  }, [snapshot, row]);

  if (!row) return null;

  const matchExisting = async (c: BillMatchCandidate) => {
    setError(null);
    const r = await repo.matchBillToEvent(row.recurring.id, row.dueDate, c.eventId);
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      onDone();
      onClose();
    }
  };

  const createNew = async () => {
    setError(null);
    if (row.recurring.kind === 'income') {
      const streamId = row.recurring.id.startsWith('stream:') ? row.recurring.id.slice(7) : row.recurring.id;
      const r = await repo.recordIncomeReceived(streamId, {
        accountId: row.recurring.accountId,
        amount: BigInt(row.recurring.amountMinor),
        date: today(),
      });
      if (!r.ok) setError(ledgerMessage(r.error));
      else {
        onDone();
        onClose();
      }
      return;
    }
    const categoryId = row.recurring.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id;
    const r = await repo.markBillPaid(row.recurring.id, row.dueDate, {
      accountId: row.recurring.accountId,
      categoryId,
      amount: BigInt(row.recurring.amountMinor),
      date: today(),
      payeeId: row.recurring.payeeId,
    });
    if (!r.ok) setError(ledgerMessage(r.error));
    else {
      onDone();
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      title={t('plan.matchTitle', { name: row.recurring.name })}
      onClose={onClose}
      testID="plan-match-sheet"
      footer={
        <Button
          testID="plan-match-create"
          kind="secondary"
          label={row.recurring.kind === 'income' ? t('plan.markReceived') : t('plan.matchCreateNew')}
          onPress={() => void createNew()}
        />
      }
    >
      <Text tone="textSecondary">
        {t('plan.matchDue', { date: formatDay(row.dueDate) })} · <Amount minor={BigInt(row.recurring.amountMinor)} variant="caption" />
      </Text>
      {error ? <InlineError message={error} /> : null}
      {candidates.length === 0 ? (
        <Text tone="textSecondary">{t('plan.matchNone')}</Text>
      ) : (
        <View style={{ gap: sp['spacing-sm'] }}>
          <Text variant="heading-sm">{t('plan.matchSuggestions')}</Text>
          {candidates.map((c) => (
            <Card key={c.eventId} style={{ gap: sp['spacing-xs'] }}>
              <Text>{c.title}</Text>
              <Text variant="caption" tone="textSecondary">
                {formatDay(c.date)} · <Amount minor={c.amount} variant="caption" />
              </Text>
              {c.amountNote ? (
                <Text variant="caption" tone="textSecondary">
                  {c.amountNote}
                </Text>
              ) : null}
              <Button testID={`plan-match-pick-${c.eventId}`} kind="secondary" label={t('plan.matchUse')} onPress={() => void matchExisting(c)} />
            </Card>
          ))}
        </View>
      )}
    </Sheet>
  );
}

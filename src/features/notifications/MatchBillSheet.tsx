import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Amount, Button, EmptyState, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { AppNotification } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';
import { formatDay } from '@/design/components/overlays';
import { t } from '@/i18n';

import { matchCandidates } from './helpers';

const sp = tokens.spacing;

export function MatchBillSheet({
  notification,
  snapshot,
  today,
  onClose,
  onMatch,
}: {
  notification: AppNotification;
  snapshot: Snapshot;
  today: string;
  onClose: () => void;
  onMatch: (eventId: string) => Promise<void>;
}) {
  const candidates = useMemo(
    () => matchCandidates(snapshot, notification.amountMinor, today),
    [snapshot, notification.amountMinor, today],
  );
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));

  return (
    <Sheet visible title={t('notifications.match')} onClose={onClose} testID="notification-match-sheet">
      <Text tone="textSecondary">{notification.title}</Text>
      {candidates.length === 0 ? (
        <EmptyState title={t('tx.noMatches')} body={t('plan.schedulesEmpty')} actionLabel={t('common.close')} onAction={onClose} />
      ) : (
        <View style={{ gap: sp['spacing-sm'] }}>
          {candidates.map((event) => {
            const accountIds = new Set(snapshot.accounts.map((a) => a.id));
            const amount = event.lines.filter((l) => accountIds.has(l.ledgerAccountId)).reduce((s, l) => s + l.amountMinor, 0n);
            const label = event.payeeId ? payees.get(event.payeeId) : undefined;
            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                testID={`match-candidate-${event.id}`}
                onPress={() => void onMatch(event.id)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: sp['spacing-sm'] }}
              >
                <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
                  <Text variant="heading-sm">{label ?? formatDay(event.date)}</Text>
                  <Text variant="caption" tone="textSecondary">
                    {formatDay(event.date)}
                  </Text>
                </View>
                <Amount minor={amount} variant="caption" />
              </Pressable>
            );
          })}
        </View>
      )}
      <Button kind="link" label={t('common.close')} onPress={onClose} />
    </Sheet>
  );
}

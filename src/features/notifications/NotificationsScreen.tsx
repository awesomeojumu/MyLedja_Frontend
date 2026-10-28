import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, InlineError, Placeholder, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { NotificationCategory } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { addDays, ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { filterNotifications, groupNotifications } from './helpers';

const sp = tokens.spacing;
const FILTERS: (NotificationCategory | 'all')[] = ['all', 'bills', 'budget', 'goals', 'debts', 'income', 'security'];

export function NotificationsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void repo.refreshBillNotifications();
  }, [repo]);

  const items = useMemo(() => {
    if (!snapshot) return null;
    return filterNotifications(snapshot.notifications, filter);
  }, [snapshot, filter]);

  const groups = items ? groupNotifications(items, today()) : null;

  return (
    <AppFrame title={t('notifications.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], alignItems: 'center' }}>
        <Button testID="notifications-mark-all" kind="secondary" label={t('notifications.markAllRead')} onPress={() => void repo.markAllNotificationsRead()} />
        <Button testID="notifications-settings" kind="link" label={t('notifications.settingsLink')} onPress={() => router.push('/settings/general')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-md'] }}>
        {FILTERS.map((f) => (
          <Button key={f} testID={`notifications-filter-${f}`} kind={filter === f ? 'primary-pill' : 'secondary'} size="sm" label={t(`notifications.filter.${f}`)} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>
      {error ? <InlineError message={error} /> : null}
      {!groups ? (
        <Placeholder height={120} />
      ) : items!.length === 0 ? (
        <EmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} actionLabel={t('notifications.markAllRead')} onAction={() => void repo.markAllNotificationsRead()} />
      ) : (
        <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
          {(['today', 'week', 'earlier'] as const).map((key) => {
            const rows = groups[key];
            if (rows.length === 0) return null;
            return (
              <View key={key} style={{ gap: sp['spacing-sm'] }}>
                <Text variant="heading-sm">{t(`notifications.group.${key}`)}</Text>
                {rows.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkPaid={async () => {
                      setError(null);
                      if (!n.recurringId || !n.dueDate || !snapshot) return;
                      const bill = snapshot.recurring.find((r) => r.id === n.recurringId);
                      if (!bill) return;
                      const categoryId = bill.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id;
                      const r = await repo.markBillPaid(n.recurringId, n.dueDate, {
                        accountId: bill.accountId,
                        categoryId,
                        amount: BigInt(bill.amountMinor),
                        date: today(),
                      });
                      if (!r.ok) setError(ledgerMessage(r.error));
                      else await repo.markNotificationRead(n.id);
                    }}
                    onRemindTomorrow={() => void repo.snoozeNotification(n.id, addDays(today(), 1))}
                    onOpen={async () => {
                      if (n.debtId) router.push(`/debts/${n.debtId}`);
                      else router.push('/plan');
                      await repo.markNotificationRead(n.id);
                    }}
                    onDismiss={() => void repo.markNotificationRead(n.id)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </AppFrame>
  );
}

function NotificationRow({
  notification: n,
  onMarkPaid,
  onRemindTomorrow,
  onOpen,
  onDismiss,
}: {
  notification: import('@/data/workspace/model').AppNotification;
  onMarkPaid: () => Promise<void>;
  onRemindTomorrow: () => void;
  onOpen: () => Promise<void>;
  onDismiss: () => void;
}) {
  return (
    <Card testID={`notification-${n.id}`} style={{ gap: tokens.spacing['spacing-xs'], opacity: n.read ? 0.85 : 1 }}>
      <Pressable accessibilityRole="button" onPress={onDismiss}>
        <Text variant="heading-sm">{n.title}</Text>
        {n.body ? (
          <Text tone="textSecondary" variant="caption">
            {n.body}
          </Text>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: tokens.spacing['spacing-sm'], flexWrap: 'wrap' }}>
        {n.action === 'mark_paid' ? (
          <>
            <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('plan.markPaid')} onPress={() => void onMarkPaid()} />
            <Button testID={`notification-snooze-${n.id}`} kind="link" size="sm" label={t('notifications.remindTomorrow')} onPress={onRemindTomorrow} />
          </>
        ) : null}
        {n.action === 'record_payment' ? (
          <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('debts.recordPayment')} onPress={() => void onOpen()} />
        ) : null}
      </View>
    </Card>
  );
}

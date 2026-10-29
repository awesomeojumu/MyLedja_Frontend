import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Settings } from 'lucide-react-native';

import { Button, EmptyState, InlineError, Placeholder, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification, NotificationCategory } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { debtRows } from '@/features/debts/helpers';
import { AppFrame } from '@/features/frame/AppFrame';
import { addDays, ledgerMessage, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import {
  filterNotifications,
  groupNotifications,
  mergeDerivedNotifications,
  visibleNotifications,
} from './helpers';
import { MatchBillSheet } from './MatchBillSheet';
import { NotificationRow } from './NotificationRow';
import { RecordDebtPaymentSheet } from './RecordDebtPaymentSheet';

const sp = tokens.spacing;
const FILTERS: (NotificationCategory | 'all')[] = ['all', 'bills', 'budget', 'goals', 'debts', 'income', 'security'];

function filterFromParam(raw: string | string[] | undefined): NotificationCategory | 'all' {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return FILTERS.includes(v as NotificationCategory | 'all') ? (v as NotificationCategory | 'all') : 'all';
}

function emptyCopy(filter: NotificationCategory | 'all'): { title: TextKey; body: TextKey } {
  if (filter === 'all') return { title: 'notifications.emptyTitle', body: 'notifications.emptyBody' };
  return { title: `notifications.empty.${filter}` as TextKey, body: 'notifications.emptyBodyFiltered' };
}

export function NotificationsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const toast = useToast();
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const filter = filterFromParam(params.tab);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [matchTarget, setMatchTarget] = useState<AppNotification | null>(null);
  const [debtPayTarget, setDebtPayTarget] = useState<{ notificationId: string; debtId: string; max: bigint } | null>(null);
  const day = today();

  const setFilter = (next: NotificationCategory | 'all') => {
    router.setParams({ tab: next === 'all' ? undefined : next });
  };

  const reload = useCallback(async () => {
    await repo.refreshBillNotifications();
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const items = useMemo(() => {
    if (!snapshot) return null;
    const merged = mergeDerivedNotifications(snapshot, snapshot.notifications, day);
    return filterNotifications(visibleNotifications(merged, day), filter);
  }, [snapshot, filter, day]);

  const groups = items ? groupNotifications(items, day) : null;
  const empty = emptyCopy(filter);

  const debtBalance = (debtId: string) => {
    if (!snapshot) return 0n;
    return debtRows(snapshot, 'all', day).find((r) => r.debt.id === debtId)?.balance ?? 0n;
  };

  return (
    <AppFrame title={t('notifications.title')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], marginBottom: sp['spacing-md'], alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          testID="notifications-mark-all"
          kind="secondary"
          label={t('notifications.markAllRead')}
          onPress={() => void repo.markAllNotificationsRead(filter)}
        />
        <Pressable
          testID="notifications-settings"
          accessibilityRole="button"
          accessibilityLabel={t('notifications.settingsLink')}
          onPress={() => router.push('/settings/notifications')}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Settings size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-md'] }}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            testID={`notifications-filter-${f}`}
            kind={filter === f ? 'primary-pill' : 'secondary'}
            size="sm"
            label={t(`notifications.filter.${f}`)}
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
      {error ? <InlineError message={error} /> : null}
      {!groups ? (
        <Placeholder height={120} />
      ) : items!.length === 0 ? (
        <EmptyState
          title={t(empty.title)}
          body={t(empty.body)}
          actionLabel={t('notifications.markAllRead')}
          onAction={() => void repo.markAllNotificationsRead(filter)}
        />
      ) : (
        <ScrollView
          refreshControl={phone ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}
          contentContainerStyle={{ gap: sp['spacing-lg'] }}
        >
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
                    today={day}
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
                        date: day,
                      });
                      if (!r.ok) setError(ledgerMessage(r.error));
                      else await repo.markNotificationRead(n.id);
                    }}
                    onMatch={() => setMatchTarget(n)}
                    onRemindTomorrow={() => void repo.snoozeNotification(n.id, addDays(day, 1))}
                    onSeeBudget={() => {
                      void repo.markNotificationRead(n.id);
                      router.push('/budget');
                    }}
                    onRecordPayment={() => {
                      if (!n.debtId) {
                        router.push('/debts');
                        return;
                      }
                      setDebtPayTarget({ notificationId: n.id, debtId: n.debtId, max: debtBalance(n.debtId) });
                    }}
                    onSecurityYes={() => void repo.markNotificationRead(n.id)}
                    onSecurityNo={() => {
                      toast.show(t('notifications.securityAck'));
                      void repo.markNotificationRead(n.id);
                    }}
                    onDismiss={() => void repo.markNotificationRead(n.id)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
      {matchTarget && snapshot ? (
        <MatchBillSheet
          notification={matchTarget}
          snapshot={snapshot}
          today={day}
          onClose={() => setMatchTarget(null)}
          onMatch={async (eventId) => {
            if (!matchTarget.recurringId || !matchTarget.dueDate) return;
            setError(null);
            const r = await repo.matchBillToEvent(matchTarget.recurringId, matchTarget.dueDate, eventId);
            if (!r.ok) setError(ledgerMessage(r.error));
            else {
              await repo.markNotificationRead(matchTarget.id);
              setMatchTarget(null);
            }
          }}
        />
      ) : null}
      {debtPayTarget && snapshot ? (
        <RecordDebtPaymentSheet
          max={debtPayTarget.max}
          snapshot={snapshot}
          onClose={() => setDebtPayTarget(null)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.recordDebtPayment(debtPayTarget.debtId, {
              accountId: input.accountId,
              amount: input.principal,
              date: 'date' in input && typeof input.date === 'string' ? input.date : day,
              interest: input.interest,
              overpayment: 'overpayment' in input ? input.overpayment : undefined,
            });
            if (!r.ok) setError(ledgerMessage(r.error));
            else {
              await repo.markNotificationRead(debtPayTarget.notificationId);
              setDebtPayTarget(null);
            }
          }}
        />
      ) : null}
    </AppFrame>
  );
}

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import type { AppNotification } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  RedesignIcon,
  RedesignInlineError,
  RedesignSkeleton,
  RedesignStackFrame,
  RedesignText,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { useSizeClass } from '@/design/size';
import { debtRows } from '@/features/debts/helpers';
import { ChangePasswordSheet, useSecurityApi } from '@/features/settings/SecuritySheets';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { useToast } from '@/design/components';
import { t } from '@/i18n';

import {
  groupNotifications,
  mergeDerivedNotifications,
  visibleNotifications,
} from './helpers';
import { syncLocalBillReminder } from './localPush';
import { MatchBillSheet } from './MatchBillSheet';
import { RedesignNotificationRow } from './RedesignNotificationRow';
import { RecordDebtPaymentSheet } from './RecordDebtPaymentSheet';
import { redesignEmptyCopy, redesignGroupLabel } from './redesignHelpers';

const sp = tokens.space;
const shape = tokens.shape;
const size = tokens.size;

/**
 * Page 27 Notifications redesign (Figma Mobile Phone / Notifications `2:1140`,
 * Empty `13:6410`). Flagged via EXPO_PUBLIC_REDESIGN. No filter chips (absent in Figma phone).
 */
export function RedesignNotificationsScreen() {
  const { snapshot, repo } = useWorkspace();
  const router = useRouter();
  const toast = useToast();
  const security = useSecurityApi();
  const phone = useSizeClass() === 'phone';
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [matchTarget, setMatchTarget] = useState<AppNotification | null>(null);
  const [debtPayTarget, setDebtPayTarget] = useState<{ notificationId: string; debtId: string; max: bigint } | null>(
    null,
  );
  const [passwordOpen, setPasswordOpen] = useState(false);
  const day = today();

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
    return visibleNotifications(merged, day);
  }, [snapshot, day]);

  useEffect(() => {
    if (!items) return;
    for (const n of items) void syncLocalBillReminder(n);
  }, [items]);

  const groups = items ? groupNotifications(items, day) : null;
  const empty = redesignEmptyCopy();

  const debtBalance = (debtId: string) => {
    if (!snapshot) return 0n;
    return debtRows(snapshot, 'all', day).find((r) => r.debt.id === debtId)?.balance ?? 0n;
  };

  const onSecurityNo = async (n: AppNotification) => {
    try {
      await security.signOutOthers();
      toast.show(t('notifications.securityRevoked'));
      setPasswordOpen(true);
    } catch {
      toast.show(t('notifications.securityRevoked'));
      setPasswordOpen(true);
    }
    await repo.markNotificationRead(n.id);
  };

  const runPrimary = async (n: AppNotification) => {
    setError(null);
    switch (n.action) {
      case 'mark_paid': {
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
        return;
      }
      case 'mark_received': {
        await repo.markNotificationRead(n.id);
        if (n.recurringId) router.push(`/income?occurrence=${n.recurringId}`);
        else router.push('/income');
        return;
      }
      case 'match':
        setMatchTarget(n);
        return;
      case 'see_budget':
        await repo.markNotificationRead(n.id);
        router.push('/budget');
        return;
      case 'record_payment': {
        if (!n.debtId) {
          router.push('/debts');
          return;
        }
        setDebtPayTarget({ notificationId: n.id, debtId: n.debtId, max: debtBalance(n.debtId) });
        return;
      }
      default:
        await repo.markNotificationRead(n.id);
    }
  };

  const markAllRead = () => void repo.markAllNotificationsRead();

  const trailing =
    items && items.length > 0 ? (
      <Pressable
        testID="notifications-mark-all"
        accessibilityRole="button"
        accessibilityLabel={t('notifications.redesign.markAllRead')}
        onPress={markAllRead}
        style={{
          minHeight: tokens.density.touch.minTarget,
          paddingHorizontal: sp.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RedesignText variant="label" tone="primary" style={{ textDecorationLine: 'underline' }}>
          {t('notifications.redesign.markAllRead')}
        </RedesignText>
      </Pressable>
    ) : (
      <View style={{ width: tokens.density.touch.minTarget }} />
    );

  const listBody = !groups ? (
    <RedesignSkeleton height={120} testID="notifications-redesign-skeleton" />
  ) : items!.length === 0 ? (
    <View
      testID="notifications-redesign-empty"
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        padding: sp.xl,
        alignItems: 'center',
        gap: sp.md,
      }}
    >
      <View
        style={{
          width: size.avatar,
          height: size.avatar,
          borderRadius: size.avatar / 2,
          backgroundColor: theme.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RedesignIcon name="bell" size={28} color={theme.text} />
      </View>
      <RedesignText variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {t(empty.title)}
      </RedesignText>
      <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
        {t(empty.body)}
      </RedesignText>
    </View>
  ) : (
    <ScrollView
      testID="notifications-redesign-list"
      refreshControl={phone ? <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} /> : undefined}
      contentContainerStyle={{ gap: sp.lg, paddingBottom: sp.xxl }}
    >
      {(['today', 'week', 'earlier'] as const).map((key) => {
        const rows = groups[key];
        if (rows.length === 0) return null;
        return (
          <View key={key} style={{ gap: sp.sm }}>
            <RedesignText variant="label" tone="textSecondary">
              {t(redesignGroupLabel(key))}
            </RedesignText>
            {rows.map((n) => (
              <RedesignNotificationRow
                key={n.id}
                notification={n}
                today={day}
                onPrimary={() => void runPrimary(n)}
                onSecurityYes={() => void repo.markNotificationRead(n.id)}
                onSecurityNo={() => void onSecurityNo(n)}
                onDismiss={() => void repo.markNotificationRead(n.id)}
              />
            ))}
          </View>
        );
      })}
      <Pressable
        testID="notifications-settings"
        accessibilityRole="link"
        accessibilityLabel={t('notifications.settingsLink')}
        onPress={() => router.push('/settings/notifications')}
        style={{
          minHeight: tokens.density.touch.minTarget,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          paddingHorizontal: sp.md,
        }}
      >
        <RedesignText variant="label" tone="primary" style={{ textDecorationLine: 'underline' }}>
          {t('notifications.settingsLink')}
        </RedesignText>
      </Pressable>
    </ScrollView>
  );

  return (
    <RedesignStackFrame
      testID="redesign-notifications"
      title={t('notifications.title')}
      onBack={() => router.back()}
      trailing={trailing}
    >
      {error ? <InlineErrorPad message={error} /> : null}
      {listBody}
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
          debtId={debtPayTarget.debtId}
          onClose={() => setDebtPayTarget(null)}
          onSave={async (input) => {
            setError(null);
            const r = await repo.recordDebtPayment(debtPayTarget.debtId, {
              accountId: input.accountId,
              amount: input.principal,
              date: input.date,
              interest: input.interest,
              overpayment: input.overpayment,
            });
            if (!r.ok) setError(ledgerMessage(r.error));
            else {
              await repo.markNotificationRead(debtPayTarget.notificationId);
              setDebtPayTarget(null);
            }
          }}
        />
      ) : null}
      <ChangePasswordSheet
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        guard={async (action) => {
          await action();
        }}
      />
    </RedesignStackFrame>
  );
}

function InlineErrorPad({ message }: { message: string }) {
  return (
    <View style={{ marginBottom: sp.md }}>
      <RedesignInlineError message={message} />
    </View>
  );
}

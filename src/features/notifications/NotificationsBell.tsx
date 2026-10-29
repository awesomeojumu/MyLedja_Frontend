import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { Amount, Button, Popover, Text, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { debtRows } from '@/features/debts/helpers';
import { ChangePasswordSheet, useSecurityApi } from '@/features/settings/SecuritySheets';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';

import { formatNotificationWhen, unreadCount } from './helpers';
import { MatchBillSheet } from './MatchBillSheet';
import { RecordDebtPaymentSheet } from './RecordDebtPaymentSheet';

const sp = tokens.spacing;
const c = tokens.color;

/** DESIGN.md page 27 + PU-05: web preview (360 wide); phone opens inbox. */
export function NotificationsBell({ items }: { items: AppNotification[] }) {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { snapshot, repo } = useWorkspace();
  const security = useSecurityApi();
  const phone = useSizeClass() === 'phone';
  const [open, setOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<AppNotification | null>(null);
  const [debtPayTarget, setDebtPayTarget] = useState<{ notificationId: string; debtId: string; max: bigint } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const unread = unreadCount(items);
  const latest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const day = today();

  const onPress = () => {
    if (phone) router.push('/notifications');
    else setOpen((v) => !v);
  };

  const markPaid = async (n: AppNotification) => {
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
    if (!r.ok) toast.show(ledgerMessage(r.error));
    else {
      await repo.markNotificationRead(n.id);
      toast.show(t('notifications.markedPaid'));
    }
  };

  const onSecurityNo = async (n: AppNotification) => {
    try {
      await security.signOutOthers();
    } catch {
      /* still prompt password change */
    }
    toast.show(t('notifications.securityRevoked'));
    setPasswordOpen(true);
    await repo.markNotificationRead(n.id);
  };

  const primaryAction = (n: AppNotification) => {
    if (n.action === 'mark_paid') {
      return (
        <Button
          testID={`preview-action-${n.id}`}
          kind="secondary"
          size="sm"
          label={t('plan.markPaid')}
          onPress={() => void markPaid(n)}
        />
      );
    }
    if (n.action === 'see_budget') {
      return (
        <Button
          testID={`preview-action-${n.id}`}
          kind="secondary"
          size="sm"
          label={t('notifications.seeBudget')}
          onPress={() => {
            void repo.markNotificationRead(n.id);
            setOpen(false);
            router.push('/budget');
          }}
        />
      );
    }
    if (n.action === 'match') {
      return (
        <Button
          testID={`preview-action-${n.id}`}
          kind="secondary"
          size="sm"
          label={t('notifications.match')}
          onPress={() => setMatchTarget(n)}
        />
      );
    }
    if (n.action === 'record_payment') {
      return (
        <Button
          testID={`preview-action-${n.id}`}
          kind="secondary"
          size="sm"
          label={t('debts.recordPayment')}
          onPress={() => {
            if (!n.debtId || !snapshot) {
              setOpen(false);
              router.push('/debts');
              return;
            }
            const max = debtRows(snapshot, 'all', day).find((r) => r.debt.id === n.debtId)?.balance ?? 0n;
            setDebtPayTarget({ notificationId: n.id, debtId: n.debtId, max });
          }}
        />
      );
    }
    if (n.category === 'security') {
      return (
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
          <Button
            testID={`preview-action-${n.id}`}
            kind="secondary"
            size="sm"
            label={t('notifications.securityYes')}
            onPress={() => void repo.markNotificationRead(n.id)}
          />
          <Button
            testID={`preview-security-no-${n.id}`}
            kind="link"
            size="sm"
            label={t('notifications.securityNo')}
            onPress={() => void onSecurityNo(n)}
          />
        </View>
      );
    }
    return null;
  };

  return (
    <View>
      <Pressable
        testID="notifications-bell"
        accessibilityRole="button"
        accessibilityLabel={t('nav.notifications')}
        onPress={onPress}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={18} color={theme.textSecondary} />
        {unread > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.primaryFill,
            }}
          />
        ) : null}
      </Pressable>
      {!phone ? (
        <Popover visible={open} onClose={() => setOpen(false)} testID="notifications-preview">
          <View style={{ gap: sp['spacing-sm'], width: 360, maxWidth: 360 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading-sm">{t('nav.notifications')}</Text>
              {latest.length > 0 ? (
                <Button
                  testID="notifications-preview-mark-all"
                  kind="link"
                  size="sm"
                  label={t('notifications.markAllRead')}
                  onPress={() => void repo.markAllNotificationsRead()}
                />
              ) : null}
            </View>
            {latest.length === 0 ? (
              <Text tone="textSecondary">{t('notifications.emptyPreview')}</Text>
            ) : (
              latest.map((n) => (
                <View
                  key={n.id}
                  testID={`notifications-preview-row-${n.id}`}
                  style={{
                    gap: sp['spacing-xs'],
                    backgroundColor: n.read ? undefined : c['primary-bg-subdued-hover'],
                    borderRadius: tokens.radius['rounded-xs'],
                    padding: sp['spacing-xs'],
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'flex-start' }}>
                    {!n.read ? (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primaryFill, marginTop: 6 }} />
                    ) : (
                      <View style={{ width: 6, marginTop: 6 }} />
                    )}
                    <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
                      <Text variant="caption" tone={n.read ? 'textSecondary' : 'text'}>
                        {n.title}
                      </Text>
                      {n.amountMinor ? <Amount minor={BigInt(n.amountMinor)} variant="caption" /> : null}
                    </View>
                    <Text variant="caption" tone="textSecondary">
                      {formatNotificationWhen(n.createdAt, day)}
                    </Text>
                  </View>
                  {primaryAction(n)}
                </View>
              ))
            )}
            <Button
              testID="notifications-see-all"
              kind="link"
              label={t('notifications.seeAll')}
              onPress={() => {
                setOpen(false);
                router.push('/notifications');
              }}
            />
          </View>
        </Popover>
      ) : null}
      {matchTarget && snapshot ? (
        <MatchBillSheet
          notification={matchTarget}
          snapshot={snapshot}
          today={day}
          onClose={() => setMatchTarget(null)}
          onMatch={async (eventId) => {
            if (!matchTarget.recurringId || !matchTarget.dueDate) return;
            const r = await repo.matchBillToEvent(matchTarget.recurringId, matchTarget.dueDate, eventId);
            if (!r.ok) toast.show(ledgerMessage(r.error));
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
            const r = await repo.recordDebtPayment(debtPayTarget.debtId, {
              accountId: input.accountId,
              amount: input.principal,
              date: day,
              interest: input.interest,
            });
            if (!r.ok) toast.show(ledgerMessage(r.error));
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
    </View>
  );
}

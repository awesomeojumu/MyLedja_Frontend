import { useMemo, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { AlertTriangle, Check, CircleDot, Lock, MoreHorizontal, X } from 'lucide-react-native';

import { Amount, Button, Card, Icon, Menu, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification } from '@/data/workspace/model';
import { t } from '@/i18n';

import { formatNotificationWhen, notificationIcon } from './helpers';

const sp = tokens.spacing;
const c = tokens.color;

const ICONS = {
  due: AlertTriangle,
  missed: X,
  budget: CircleDot,
  goal: Check,
  security: Lock,
  default: CircleDot,
} as const;

/** Phone: swipe left to dismiss (D27-08). Web keeps the ⋯ menu. */
function PhoneSwipe({
  enabled,
  onDismiss,
  children,
}: {
  enabled: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          enabled && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) setDx(Math.max(g.dx, -160));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -72) onDismiss();
          setDx(0);
        },
        onPanResponderTerminate: () => setDx(0),
      }).panHandlers,
    [enabled, onDismiss],
  );

  if (!enabled) return <>{children}</>;
  return (
    <View
      testID="notification-swipe"
      collapsable={false}
      style={{ transform: [{ translateX: dx }] }}
      {...panHandlers}
    >
      {children}
    </View>
  );
}

export function NotificationRow({
  notification: n,
  today,
  selected,
  onSelect,
  onMarkPaid,
  onMarkReceived,
  onMatch,
  onRemindTomorrow,
  onSeeBudget,
  onRecordPayment,
  onSecurityYes,
  onSecurityNo,
  onDismiss,
}: {
  notification: AppNotification;
  today: string;
  selected?: boolean;
  onSelect?: () => void;
  onMarkPaid: () => Promise<void>;
  onMarkReceived: () => void;
  onMatch: () => void;
  onRemindTomorrow: () => void;
  onSeeBudget: () => void;
  onRecordPayment: () => void;
  onSecurityYes: () => void;
  onSecurityNo: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const iconKey = notificationIcon(n);
  const Glyph = ICONS[iconKey];
  const when = formatNotificationWhen(n.createdAt, today);
  const unread = !n.read;
  const canSwipe = phone && n.category !== 'security';

  const body = (
    <Card
      testID={`notification-${n.id}`}
      style={{
        gap: sp['spacing-sm'],
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: unread || selected ? c['primary-bg-subdued-hover'] : undefined,
        opacity: n.read && !selected ? 0.92 : 1,
        borderWidth: selected ? 1 : undefined,
        borderColor: selected ? theme.primaryFill : undefined,
      }}
    >
      <View style={{ paddingTop: 2, width: 20, alignItems: 'center' }}>
        {unread ? (
          <View
            accessibilityElementsHidden
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primaryFill, marginBottom: sp['spacing-xxs'] }}
          />
        ) : (
          <View style={{ width: 8, height: 8, marginBottom: sp['spacing-xxs'] }} />
        )}
        <Icon icon={Glyph} size="row" color={iconKey === 'missed' ? theme.error : theme.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: sp['spacing-xxs'] }}>
            <Text variant="heading-sm">{n.title}</Text>
            {n.amountMinor && n.category === 'bills' ? (
              <Text variant="caption" tone="textSecondary">
                <Amount minor={BigInt(n.amountMinor)} variant="caption" />
              </Text>
            ) : null}
            {n.body ? (
              <Text tone="textSecondary" variant="caption">
                {n.body}
              </Text>
            ) : null}
          </View>
          <Text variant="caption" tone="textSecondary" style={{ fontVariant: ['tabular-nums'] }}>
            {when}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap', alignItems: 'center' }}>
          {n.action === 'mark_paid' ? (
            <>
              <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('plan.markPaid')} onPress={() => void onMarkPaid()} />
              <Button testID={`notification-snooze-${n.id}`} kind="link" size="sm" label={t('notifications.remindTomorrow')} onPress={onRemindTomorrow} />
            </>
          ) : null}
          {n.action === 'mark_received' ? (
            <>
              <Button
                testID={`notification-action-${n.id}`}
                kind="secondary"
                size="sm"
                label={t('notifications.markReceived')}
                onPress={onMarkReceived}
              />
              <Button testID={`notification-snooze-${n.id}`} kind="link" size="sm" label={t('notifications.remindTomorrow')} onPress={onRemindTomorrow} />
            </>
          ) : null}
          {n.action === 'match' ? (
            <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('notifications.match')} onPress={onMatch} />
          ) : null}
          {n.action === 'see_budget' ? (
            <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('notifications.seeBudget')} onPress={onSeeBudget} />
          ) : null}
          {n.action === 'record_payment' ? (
            <Button testID={`notification-action-${n.id}`} kind="secondary" size="sm" label={t('debts.recordPayment')} onPress={onRecordPayment} />
          ) : null}
          {n.category === 'security' ? (
            <>
              <Button testID={`notification-security-yes-${n.id}`} kind="secondary" size="sm" label={t('notifications.securityYes')} onPress={onSecurityYes} />
              <Button testID={`notification-security-no-${n.id}`} kind="link" size="sm" label={t('notifications.securityNo')} onPress={onSecurityNo} />
            </>
          ) : null}
          {n.category !== 'security' ? (
            <Menu
              testID={`notification-menu-${n.id}`}
              trigger={(open) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('notifications.more')}
                  onPress={open}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon icon={MoreHorizontal} size="nav" color={theme.textSecondary} />
                </Pressable>
              )}
              items={[{ key: 'dismiss', label: t('notifications.dismiss'), onPress: onDismiss }]}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );

  const selectable = onSelect ? (
    <Pressable accessibilityRole="button" onPress={onSelect}>
      {body}
    </Pressable>
  ) : (
    body
  );

  return (
    <PhoneSwipe enabled={canSwipe} onDismiss={onDismiss}>
      {selectable}
    </PhoneSwipe>
  );
}

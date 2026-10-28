import { Pressable, View } from 'react-native';
import { AlertTriangle, Check, CircleDot, Lock, MoreHorizontal, X } from 'lucide-react-native';

import { Amount, Button, Card, Icon, Menu, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
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

export function NotificationRow({
  notification: n,
  today,
  onMarkPaid,
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
  onMarkPaid: () => Promise<void>;
  onMatch: () => void;
  onRemindTomorrow: () => void;
  onSeeBudget: () => void;
  onRecordPayment: () => void;
  onSecurityYes: () => void;
  onSecurityNo: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const iconKey = notificationIcon(n);
  const Glyph = ICONS[iconKey];
  const when = formatNotificationWhen(n.createdAt, today);
  const unread = !n.read;

  return (
    <Card
      testID={`notification-${n.id}`}
      style={{
        gap: sp['spacing-sm'],
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: unread ? c['primary-bg-subdued-hover'] : undefined,
        opacity: n.read ? 0.92 : 1,
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
}

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { Amount, Button, Popover, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification } from '@/data/workspace/model';
import { t } from '@/i18n';

import { formatNotificationWhen, unreadCount } from './helpers';

const sp = tokens.spacing;
const c = tokens.color;

/** DESIGN.md page 27 + popup #5: web preview; phone opens inbox. */
export function NotificationsBell({ items }: { items: AppNotification[] }) {
  const theme = useTheme();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const [open, setOpen] = useState(false);
  const unread = unreadCount(items);
  const latest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  const onPress = () => {
    if (phone) router.push('/notifications');
    else setOpen((v) => !v);
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
          <View style={{ gap: sp['spacing-sm'], maxWidth: 320 }}>
            {latest.length === 0 ? (
              <Text tone="textSecondary">{t('notifications.emptyPreview')}</Text>
            ) : (
              latest.map((n) => (
                <View
                  key={n.id}
                  style={{
                    flexDirection: 'row',
                    gap: sp['spacing-sm'],
                    alignItems: 'flex-start',
                    backgroundColor: n.read ? undefined : c['primary-bg-subdued-hover'],
                    borderRadius: tokens.radius['rounded-xs'],
                    padding: sp['spacing-xs'],
                  }}
                >
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
                    {formatNotificationWhen(n.createdAt, today)}
                  </Text>
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
    </View>
  );
}

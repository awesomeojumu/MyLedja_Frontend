import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { Button, Popover, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification } from '@/data/workspace/model';
import { t } from '@/i18n';

import { unreadCount } from './helpers';

const sp = tokens.spacing;

/** DESIGN.md page 27 + popup #5: web preview; phone opens inbox. */
export function NotificationsBell({ items }: { items: AppNotification[] }) {
  const theme = useTheme();
  const router = useRouter();
  const phone = useSizeClass() === 'phone';
  const [open, setOpen] = useState(false);
  const unread = unreadCount(items);
  const latest = items.slice(0, 5);

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
                <Text key={n.id} variant="caption" tone={n.read ? 'textSecondary' : 'text'}>
                  {n.title}
                </Text>
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

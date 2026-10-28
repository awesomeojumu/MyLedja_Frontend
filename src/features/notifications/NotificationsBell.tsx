import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { useTheme } from '@/design/ThemeProvider';
import type { AppNotification } from '@/data/workspace/model';
import { t } from '@/i18n';

import { unreadCount } from './helpers';

export function NotificationsBell({ items }: { items: AppNotification[] }) {
  const theme = useTheme();
  const router = useRouter();
  const unread = unreadCount(items);

  return (
    <Pressable
      testID="notifications-bell"
      accessibilityRole="button"
      accessibilityLabel={t('nav.notifications')}
      onPress={() => router.push('/notifications')}
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
  );
}

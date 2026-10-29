import { Linking, Platform } from 'react-native';

import type { AppNotification } from '@/data/workspace/model';

type NotificationsModule = typeof import('expo-notifications');

let notifications: NotificationsModule | null | undefined;

async function mod(): Promise<NotificationsModule | null> {
  if (notifications !== undefined) return notifications;
  if (Platform.OS === 'web') {
    notifications = null;
    return null;
  }
  try {
    notifications = await import('expo-notifications');
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    return notifications;
  } catch {
    notifications = null;
    return null;
  }
}

function lockBody(n: AppNotification): string {
  if (n.hideAmount !== false && n.amountMinor) {
    return n.body?.replace(/\d[\d,]*/g, '•••') ?? n.title;
  }
  return n.body ?? n.title;
}

/** Schedule / refresh a local OS notification (P27-05 / F2.5). No-op on web. */
export async function syncLocalBillReminder(notification: AppNotification): Promise<void> {
  const n = await mod();
  if (!n) return;
  const { status } = await n.getPermissionsAsync();
  if (status !== 'granted') {
    const asked = await n.requestPermissionsAsync();
    if (asked.status !== 'granted') return;
  }
  const id = `notif:${notification.id}`;
  await n.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (notification.read || notification.dismissed || notification.category === 'security') return;
  await n.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: notification.title,
      body: lockBody(notification),
      data: { notificationId: notification.id, url: `/notifications` },
      sound: false,
    },
    trigger: null,
  });
}

/** Keep the app icon badge equal to unread inbox count (DESIGN page 27). */
export async function setUnreadBadge(count: number): Promise<void> {
  const n = await mod();
  if (!n) return;
  await n.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}

/** Open the inbox when the person taps a system notification. */
export function listenForNotificationResponse(): () => void {
  let sub: { remove: () => void } | undefined;
  void mod().then((n) => {
    if (!n) return;
    sub = n.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { url?: string; notificationId?: string };
      const url = data?.url ?? (data?.notificationId ? `/notifications` : null);
      if (url) void Linking.openURL(url);
    });
  });
  return () => sub?.remove();
}

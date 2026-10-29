import { Platform } from 'react-native';

import type { AppNotification } from '@/data/workspace/model';
import { DEFAULT_NOTIFICATION_PREFS } from '@/data/workspace/model';
import { formatNaira } from '@/money';

export const BILLS_CHANNEL_ID = 'bills';
export const BILL_CATEGORY_ID = 'bill_reminder';
export const ACTION_MARK_PAID = 'mark_paid';
export const ACTION_REMIND_TOMORROW = 'remind_tomorrow';

type NotificationsModule = typeof import('expo-notifications');

let handlersAttached = false;

export type LocalPushHandlers = {
  onMarkPaid: (notification: AppNotification) => void | Promise<void>;
  onRemindTomorrow: (notification: AppNotification) => void | Promise<void>;
  onOpen: (notification: AppNotification) => void;
};

let handlers: LocalPushHandlers | null = null;

function notificationsMod(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

export function attachLocalPushHandlers(next: LocalPushHandlers): void {
  handlers = next;
}

/** Exposed for tests — clear module-level listener flag. */
export function __resetLocalPushForTests(): void {
  handlersAttached = false;
  handlers = null;
}

export function shouldHideAmountOnLock(
  notification: AppNotification,
  prefsHide = DEFAULT_NOTIFICATION_PREFS.hideAmountsOnLockScreen,
): boolean {
  if (notification.hideAmount === false) return false;
  return prefsHide !== false;
}

export function buildLockScreenContent(
  notification: AppNotification,
  prefsHide = DEFAULT_NOTIFICATION_PREFS.hideAmountsOnLockScreen,
): { title: string; body: string } {
  const hide = shouldHideAmountOnLock(notification, prefsHide);
  const amount =
    !hide && notification.amountMinor
      ? formatNaira(BigInt(notification.amountMinor))
      : null;
  const bodyParts = [notification.body, amount].filter(Boolean);
  return {
    title: notification.title,
    body: bodyParts.join(' · ') || notification.title,
  };
}

/** Morning (08:00) fire time in the workspace TZ for a calendar day (P12-07). */
export function atMorningInWorkspace(isoDay: string, timeZone = 'Africa/Lagos'): Date {
  const localNoon = new Date(`${isoDay}T12:00:00Z`);
  const hourInTz = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(localNoon),
  );
  const offsetHours = hourInTz - 12;
  const fire = new Date(`${isoDay}T08:00:00Z`);
  fire.setUTCHours(fire.getUTCHours() - offsetHours);
  return fire;
}

export function reminderFireDay(dueDate: string, daysBefore: number): string {
  const d = new Date(`${dueDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().slice(0, 10);
}

async function ensureAndroidChannel(mod: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await mod.setNotificationChannelAsync(BILLS_CHANNEL_ID, {
    name: 'Bills',
    importance: mod.AndroidImportance.DEFAULT,
  });
}

async function ensureIosCategory(mod: NotificationsModule): Promise<void> {
  await mod.setNotificationCategoryAsync(BILL_CATEGORY_ID, [
    {
      identifier: ACTION_MARK_PAID,
      buttonTitle: 'Mark paid',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_REMIND_TOMORROW,
      buttonTitle: 'Remind me tomorrow',
      options: { opensAppToForeground: false },
    },
  ]);
}

function parseData(data: Record<string, unknown> | undefined): AppNotification | null {
  if (!data || typeof data.id !== 'string') return null;
  return {
    id: data.id,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    title: typeof data.title === 'string' ? data.title : '',
    body: typeof data.body === 'string' ? data.body : undefined,
    category: 'bills',
    read: false,
    action: typeof data.action === 'string' ? (data.action as AppNotification['action']) : 'mark_paid',
    recurringId: typeof data.recurringId === 'string' ? data.recurringId : undefined,
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : undefined,
    amountMinor: typeof data.amountMinor === 'string' ? data.amountMinor : undefined,
    hideAmount: data.hideAmount !== false,
  };
}

export async function ensureLocalPushReady(): Promise<boolean> {
  const mod = notificationsMod();
  if (!mod) return false;
  await ensureAndroidChannel(mod);
  await ensureIosCategory(mod);
  if (!handlersAttached) {
    handlersAttached = true;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    mod.addNotificationResponseReceivedListener((response) => {
      const n = parseData(response.notification.request.content.data as Record<string, unknown>);
      if (!n || !handlers) return;
      const action = response.actionIdentifier;
      if (action === ACTION_MARK_PAID) void handlers.onMarkPaid(n);
      else if (action === ACTION_REMIND_TOMORROW) void handlers.onRemindTomorrow(n);
      else handlers.onOpen(n);
    });
  }
  return true;
}

export async function syncLocalBillReminder(
  notification: AppNotification,
  opts?: { daysBefore?: number; prefsHideAmounts?: boolean; timeZone?: string },
): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = notificationsMod();
  if (!mod) return;
  await ensureLocalPushReady();
  const id = notification.id;
  await mod.cancelScheduledNotificationAsync(id).catch(() => undefined);
  if (notification.read || !notification.dueDate) return;
  const daysBefore = opts?.daysBefore ?? 1;
  const fireDay = reminderFireDay(notification.dueDate, daysBefore);
  const when = atMorningInWorkspace(fireDay, opts?.timeZone);
  if (when.getTime() <= Date.now()) return;
  const content = buildLockScreenContent(notification, opts?.prefsHideAmounts);
  await mod.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: content.title,
      body: content.body,
      categoryIdentifier: BILL_CATEGORY_ID,
      data: {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        action: notification.action,
        recurringId: notification.recurringId,
        dueDate: notification.dueDate,
        amountMinor: notification.amountMinor,
        hideAmount: notification.hideAmount !== false,
        createdAt: notification.createdAt,
      },
      ...(Platform.OS === 'android' ? { channelId: BILLS_CHANNEL_ID } : {}),
    },
    trigger: {
      type: mod.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: Platform.OS === 'android' ? BILLS_CHANNEL_ID : undefined,
    },
  });
}

export async function cancelLocalBillReminder(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = notificationsMod();
  if (!mod) return;
  await mod.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

export async function syncAppBadge(unread: number): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = notificationsMod();
  if (!mod) return;
  await mod.setBadgeCountAsync(Math.max(0, unread)).catch(() => undefined);
}

/** Keep the app icon badge equal to the unread inbox count (DESIGN page 27). */
export const setUnreadBadge = syncAppBadge;

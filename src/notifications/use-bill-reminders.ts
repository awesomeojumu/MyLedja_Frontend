import { useEffect } from "react";
import { Platform } from "react-native";
import { onMoneyWrite } from "@/lib/after-money";
import { planBillReminders, type ReminderBill } from "@/notifications/bill-reminders";
import { useSession } from "@/state";

type Notifications = typeof import("expo-notifications");

const CHANNEL = "bills";

async function cancelBillReminders(N: Notifications): Promise<void> {
  const scheduled = await N.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if ((item.content.data as { kind?: string } | null)?.kind === "bill") await N.cancelScheduledNotificationAsync(item.identifier);
  }
}

/**
 * Keeps a local reminder scheduled the day before each bill is due. With "Hide lock-screen amounts" on (the default),
 * reminders carry no amount, and on Android the channel is private so a locked phone shows only "Contents hidden".
 * Phones only: the web build has no lock screen to protect.
 */
export function useBillReminders(): void {
  const { session, status, user, workspaces } = useSession();
  const hide = user?.hideLockScreenAmounts !== false;
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;

    if (status === "signedOut") {
      // A signed-out phone keeps nothing from the last user, reminders included.
      void import("expo-notifications").then(cancelBillReminders).catch(() => undefined);
      return;
    }
    if (status !== "signedIn" || !workspaceId) return;

    const sync = async () => {
      const N = await import("expo-notifications");
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
      });
      let { granted, canAskAgain } = await N.getPermissionsAsync();
      if (!granted && canAskAgain) granted = (await N.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;
      if (Platform.OS === "android") {
        await N.setNotificationChannelAsync(CHANNEL, {
          name: "Bill reminders",
          importance: N.AndroidImportance.DEFAULT,
          lockscreenVisibility: hide ? N.AndroidNotificationVisibility.PRIVATE : N.AndroidNotificationVisibility.PUBLIC,
        });
      }
      const res = await session.listCollection(workspaceId, "bills");
      if (cancelled) return;
      const plan = planBillReminders((Array.isArray(res.data) ? res.data : []) as ReminderBill[], hide, new Date());
      await cancelBillReminders(N);
      for (const request of plan) {
        await N.scheduleNotificationAsync({
          identifier: request.id,
          content: { title: request.content.title, body: request.content.body, data: request.data },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: request.at, channelId: CHANNEL },
        });
      }
    };

    void sync().catch(() => undefined);
    const off = onMoneyWrite(() => void sync().catch(() => undefined));
    return () => {
      cancelled = true;
      off();
    };
  }, [hide, session, status, workspaceId]);
}

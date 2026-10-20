import { useCallback } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, EmptyState, Txt, useTheme } from "@/design";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { buildInbox, findNotice, type InboxBill, type InboxBudget, type Notice } from "@/features/notifications/services/inbox";
import { readReminders } from "@/features/notifications/services/prefs";

const NONE: Notice[] = [];

/** The current in-app alerts, for badges elsewhere. */
export function useInbox() {
  const { session, user } = useSession();
  const hideAmounts = user?.hideLockScreenAmounts !== false;
  const load = useCallback(
    async (workspaceId: string) => {
      const [bills, budgets, workspace] = await Promise.all([
        session.listBills(workspaceId),
        session.listBudgets(workspaceId),
        session.getWorkspace(workspaceId),
      ]);
      return buildInbox({
        bills: (bills.data ?? []) as InboxBill[],
        budgets: (budgets.data ?? []) as InboxBudget[],
        prefs: readReminders(workspace.reminders),
        hideAmounts,
        now: new Date(),
      });
    },
    [hideAmounts, session],
  );
  return useLiveQuery(load, NONE, "notices");
}

export function NotificationsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, loading, offline, error, known, refresh } = useInbox();

  return (
    <ScreenShell
      title="Notifications"
      actions={[
        { icon: "settings", label: "Notification settings", onPress: () => router.push("/(tabs)/more/notification-settings") },
        { icon: "smartphone", label: "Lock screen alerts", onPress: () => router.push("/(tabs)/more/lock-screen") },
      ]}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="Nothing needs you right now" icon="bell">
          Bill, budget, and weekly alerts show up here when they are on.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {data.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
              onPress={() => router.push(`/(tabs)/more/notification?id=${encodeURIComponent(item.id)}`)}
              style={{ gap: 4, paddingVertical: t.space.space2 }}
            >
              <Txt variant="label">{item.title}</Txt>
              <Txt variant="bodySm">{item.body}</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {item.when}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function NotificationDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const noticeId = Array.isArray(id) ? id[0] : id;
  const { data, loading, offline, error, known, refresh } = useInbox();
  const item = findNotice(data, noticeId);

  return (
    <ScreenShell title={item?.title ?? "Notification"}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? <DefaultLoading /> : null}
      {!loading && !item ? (
        <EmptyState title="This alert has cleared" icon="bell">
          It is no longer in the next 14 days, or that reminder is off.
        </EmptyState>
      ) : null}
      {item ? (
        <View style={{ gap: t.space.space4 }}>
          <Txt variant="body">{item.body}</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            {item.when}
          </Txt>
          <Button onPress={() => router.push(item.href as "/(tabs)")}>Open</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

import { useCallback, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Card, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { ToggleRow } from "@/features/notifications/components/ToggleRow";
import { lockPreview } from "@/features/notifications/services/lock-preview";
import { DEFAULT_REMINDERS, readReminders, remindersPatch, type ReminderPrefs } from "@/features/notifications/services/prefs";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

export function NotificationSettingsScreen() {
  const t = useTheme();
  const { session, workspaces } = useSession();
  const { busy, error, run } = useSubmit();
  const load = useCallback(
    async (workspaceId: string) => readReminders((await session.getWorkspace(workspaceId)).reminders),
    [session],
  );
  const query = useLiveQuery(load, DEFAULT_REMINDERS, "reminder-prefs");
  const [draft, setDraft] = useState<ReminderPrefs | null>(null);
  const prefs = draft ?? query.data;
  const setFlag = (key: keyof ReminderPrefs, next: boolean) => setDraft({ ...prefs, [key]: next });

  return (
    <ScreenShell
      title="Notification settings"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              await session.patchSetup(workspaceId, remindersPatch(prefs));
              query.refresh();
            })
          }
        >
          Save reminders
        </Button>
      }
    >
      <LiveNotice offline={query.offline} error={query.error} hasData={query.known} onRetry={query.refresh} />
      {error ? <Banner tone="danger" title={error} /> : null}
      {query.loading && !query.known ? (
        <DefaultLoading />
      ) : (
        <View style={{ gap: t.space.space4 }}>
          <ToggleRow title="Bills due" caption="A day before each bill is due" value={prefs.bills} onChange={(next) => setFlag("bills", next)} />
          <ToggleRow title="Budget alerts" caption="When a budget is nearly used or over" value={prefs.budget} onChange={(next) => setFlag("budget", next)} />
          <ToggleRow title="Weekly summary" caption="Sunday evening, what came in and went out" value={prefs.summary} onChange={(next) => setFlag("summary", next)} />
          <ToggleRow title="Security alerts" caption="Always on: new sign-ins and password changes" value onChange={() => {}} disabled />
        </View>
      )}
    </ScreenShell>
  );
}

export function LockScreenAlertsScreen() {
  const t = useTheme();
  const { session, user } = useSession();
  const { busy, error, run } = useSubmit();
  const hide = user?.hideLockScreenAmounts !== false;
  const preview = lockPreview(hide);

  return (
    <ScreenShell title="Lock screen alerts">
      {error ? <Banner tone="danger" title={error} /> : null}
      <ToggleRow
        title="Hide amounts"
        caption={hide ? "A locked phone does not show figures." : "Bill names and amounts can show on a locked phone."}
        value={hide}
        disabled={busy}
        onChange={(next) => run(async () => { await session.patchSettings(next); })}
      />
      <Card title="Preview">
        <Txt variant="label">{preview.title}</Txt>
        <Txt variant="bodySm">{preview.body}</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          {hide ? "On Android a locked phone shows “Contents hidden”." : "This is the text a locked phone can show."}
        </Txt>
      </Card>
    </ScreenShell>
  );
}

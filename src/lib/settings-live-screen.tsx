import { useEffect, useState } from "react";
import { View } from "react-native";
import { EmptyState, Txt, useTheme } from "@/design";
import { SCREEN_TITLES } from "@/lib/screen-catalog";
import { useSession } from "@/state";

export function SettingsLiveScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  const { session, status } = useSession();
  const [sessions, setSessions] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "signedIn") return;
    queueMicrotask(() => setLoading(true));
    void session
      .listSessions()
      .then((res) => setSessions(res.data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [session, status]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd">{title}</Txt>
      {loading ? (
        <EmptyState title="Loading records" icon="clock">
          Waiting for your workspace.
        </EmptyState>
      ) : (
        <Txt variant="body">{sessions.length} active session{sessions.length === 1 ? "" : "s"} on this account.</Txt>
      )}
    </View>
  );
}

export function HelpCopyScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd">{title}</Txt>
      <Txt variant="body">Product help. No balances on this page.</Txt>
    </View>
  );
}

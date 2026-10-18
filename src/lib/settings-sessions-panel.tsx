import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Dialog, formatDateDMY, Txt, useTheme } from "@/design";
import { sessionLine, showSessionCount, type NamedSession } from "@/lib/settings-sessions";
import { useSession } from "@/state";

/** Signed-in devices by name, each with its own Revoke. */
export function SessionsPanel() {
  const t = useTheme();
  const { session, status } = useSession();
  const [sessions, setSessions] = useState<NamedSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    void session
      .listSessions()
      .then((res) => {
        if (cancelled) return;
        setSessions((res.data ?? []) as NamedSession[]);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t load your sessions. Check your connection.");
      });
    return () => {
      cancelled = true;
    };
  }, [session, status]);

  const revoke = (row: NamedSession) => {
    void session
      .revokeSession(row.id)
      .then(() => setSessions((prev) => (prev ?? []).filter((item) => item.id !== row.id)))
      .catch(() => setError("Couldn’t revoke that session. Try again."));
  };

  return (
    <View style={{ gap: t.space.space3 }}>
      <Txt variant="label" style={{ fontWeight: "600" }} accessibilityRole="header">
        Signed-in devices
      </Txt>
      {error ? (
        <Txt variant="caption" color={t.c.danger}>
          {error}
        </Txt>
      ) : null}
      {sessions == null && !error ? (
        <Txt variant="caption" color={t.c.inkMuted}>
          Loading…
        </Txt>
      ) : null}
      {sessions != null && showSessionCount(sessions) ? (
        <Txt variant="body">
          {sessions.length} active session{sessions.length === 1 ? "" : "s"} on this account.
        </Txt>
      ) : null}
      {(sessions ?? []).map((row) => (
        <View key={row.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="body">{sessionLine(row)}</Txt>
            {row.createdAt ? (
              <Txt variant="caption" color={t.c.inkMuted}>
                Since {formatDateDMY(new Date(String(row.createdAt))) || String(row.createdAt).slice(0, 10)}
              </Txt>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Revoke ${row.deviceLabel ?? "session"}`} hitSlop={8} onPress={() => revoke(row)}>
            <Txt variant="label" color={t.c.danger}>
              Revoke
            </Txt>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** Starts account deletion after a confirm, then hands over to the caller to sign out. */
export function DeleteAccountButton({ onDeleted }: { onDeleted: () => void | Promise<void> }) {
  const t = useTheme();
  const { session } = useSession();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ gap: t.space.space2 }}>
      <Button variant="secondary" onPress={() => setConfirm(true)}>
        Delete account
      </Button>
      {error ? (
        <Txt variant="caption" color={t.c.danger}>
          {error}
        </Txt>
      ) : null}
      <Dialog
        title="Delete account"
        open={confirm}
        tone="destructive"
        confirmLabel="Delete and sign out"
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void session
            .startDeletion()
            .then(() => onDeleted())
            .catch(() => setError("Couldn’t start deletion. Check your connection and try again."));
        }}
      >
        <Txt color={t.c.inkMuted}>This starts deletion of your MyLedja account and signs this device out.</Txt>
      </Dialog>
    </View>
  );
}

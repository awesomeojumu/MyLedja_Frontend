import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton, Txt, useTheme } from "@/design";
import { AccountCard } from "@/features/settings-privacy";
import { useSession, useSignOut } from "@/state";

export default function SettingsRoute() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useSession();
  const signOut = useSignOut();
  const [rows, setRows] = useState<{ id: string }[]>([]);

  useEffect(() => {
    void session.listSessions().then((res) => setRows(res.data)).catch(() => setRows([]));
  }, [session]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, gap: t.space.space4 }}>
      <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <Txt variant="titleMd" accessibilityRole="header">
        Settings
      </Txt>
      <AccountCard
        email={user?.email ?? null}
        onSignOut={signOut}
        hideLockScreenAmounts
        onHideAmounts={async (next) => {
          await session.patchSettings(next);
        }}
      />
      {rows.map((row) => (
        <Button
          key={row.id}
          variant="secondary"
          onPress={() => {
            void session.revokeSession(row.id).then(() => {
              setRows((current) => current.filter((item) => item.id !== row.id));
            });
          }}
        >
          Revoke session
        </Button>
      ))}
      <Txt variant="caption">{rows.length} sessions</Txt>
    </View>
  );
}

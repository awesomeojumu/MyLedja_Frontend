import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, SegmentedControl, Txt, useTheme } from "@/design";
import { AccountCard } from "@/features/settings-privacy";
import { DeleteAccountButton, SessionsPanel } from "@/lib/settings-sessions-panel";
import { useScheme, useSession, useSignOut } from "@/state";

export default function SettingsRoute() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, session } = useSession();
  const { scheme, setScheme } = useScheme();
  const signOut = useSignOut();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.space.space3, paddingBottom: insets.bottom + t.space.space6, paddingHorizontal: t.space.space4, gap: t.space.space4 }}
    >
      <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
      <Txt variant="titleMd" accessibilityRole="header">
        Settings
      </Txt>
      <View style={{ gap: t.space.space2 }}>
        <Txt variant="label" style={{ fontWeight: "600" }} accessibilityRole="header">
          Appearance
        </Txt>
        <SegmentedControl
          label="Theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={scheme === "dark" ? "dark" : "light"}
          onChange={(value) => setScheme(value === "dark" ? "dark" : "light")}
        />
      </View>
      <AccountCard
        email={user?.email ?? null}
        onSignOut={signOut}
        hideLockScreenAmounts={user?.hideLockScreenAmounts !== false}
        onHideAmounts={async (next) => {
          await session.patchSettings(next);
        }}
      />
      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, padding: t.space.space4 }}>
        <SessionsPanel />
      </View>
      <View style={{ gap: t.space.space2 }}>
        <Txt variant="label" style={{ fontWeight: "600" }} accessibilityRole="header">
          Delete account
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          Removes your account and records from MyLedja. Export anything you want to keep first.
        </Txt>
        <DeleteAccountButton onDeleted={signOut} />
      </View>
    </ScrollView>
  );
}

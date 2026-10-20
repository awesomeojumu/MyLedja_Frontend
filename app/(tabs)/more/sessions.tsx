import { View } from "react-native";
import { Txt, useTheme } from "@/design";
import { ScreenShell } from "@/lib/screen-shell";
import { SessionsPanel } from "@/lib/settings-sessions-panel";

export default function SessionsRoute() {
  const t = useTheme();
  return (
    <ScreenShell title="Devices and sessions">
      <Txt variant="body" color={t.c.inkMuted}>
        {"Devices signed in to your MyLedja account. Revoke any you don't recognise."}
      </Txt>
      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, padding: t.space.space4 }}>
        <SessionsPanel />
      </View>
    </ScreenShell>
  );
}

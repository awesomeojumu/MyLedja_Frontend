import { View } from "react-native";
import { Txt, useTheme } from "@/design";
import { SCREEN_TITLES } from "@/lib/screen-catalog";
import { DeleteAccountButton, SessionsPanel } from "@/lib/settings-sessions-panel";
import { useSession } from "@/state";

export function SettingsLiveScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  const { session } = useSession();

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd">{title}</Txt>
      <SessionsPanel />
      <DeleteAccountButton onDeleted={() => session.signOut()} />
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

import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Txt, useTheme } from "@/design";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, gap: t.space.space4 }}>
      {onBack ? <IconButton icon="chevron-left" label="Back" onPress={onBack} /> : null}
      <Txt variant="titleMd" accessibilityRole="header">
        Help
      </Txt>
      <Txt variant="body">Add accounts and records from the tabs. MyLedja never sends naira to a bank. Product help only — no balances on this page.</Txt>
    </View>
  );
}

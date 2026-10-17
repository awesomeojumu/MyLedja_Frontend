import { View } from "react-native";
import { EmptyState, useTheme } from "@/design";

export function ScreenPlaceholder({
  id,
  feature,
}: {
  id: string;
  feature: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, justifyContent: "center", padding: t.space.space5 }}>
      <EmptyState title={feature} icon="inbox">
        Screen {id}. Named UI waits on spec §12.
      </EmptyState>
    </View>
  );
}

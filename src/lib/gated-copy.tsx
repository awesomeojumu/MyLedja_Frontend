import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, IconButton, Txt, useTheme } from "@/design";

export function GatedCopy({ title, onBack }: { title: string; onBack?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, gap: t.space.space4 }}>
      {onBack ? <IconButton icon="chevron-left" label="Back" onPress={onBack} /> : null}
      <Txt variant="titleMd" accessibilityRole="header">
        {title}
      </Txt>
      <EmptyState title="Not available yet" icon="ban">
        Savings, investments, and tax filing are not available yet.
      </EmptyState>
    </View>
  );
}

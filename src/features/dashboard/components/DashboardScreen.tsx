import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, maxWidth, Txt, useTheme } from "@/design";

export function DashboardScreen({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + t.space.space4,
          paddingHorizontal: t.space.space5,
          paddingBottom: t.space.space12,
          gap: t.space.space5,
          maxWidth: maxWidth.widthContent,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          <IconButton
            icon="chevron-left"
            label="Back"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)");
            }}
          />
          <Txt variant="titleMd" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </Txt>
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

import type { ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Txt, maxWidth, useTheme } from "@/design";

export function ScreenChrome({
  title,
  onBack,
  children,
  footer,
}: {
  title?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View
        style={{
          paddingTop: insets.top + t.space.space2,
          paddingHorizontal: t.space.space3,
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {onBack ? <IconButton icon="chevron-left" label="Back" onPress={onBack} /> : <View style={{ width: t.size.touchTarget }} />}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: t.space.space5,
          paddingBottom: t.space.space8,
          gap: t.space.space4,
          maxWidth: maxWidth.widthForm,
          width: "100%",
          alignSelf: "center",
          flexGrow: 1,
          justifyContent: Platform.OS === "web" ? "center" : "flex-start",
        }}
      >
        {title ? (
          <Txt variant="titleLg" accessibilityRole="header">
            {title}
          </Txt>
        ) : null}
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: t.space.space5, paddingBottom: Math.max(insets.bottom, t.space.space4) }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

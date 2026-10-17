import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, maxWidth, Txt, useTheme, type IconName } from "@/design";

export function ScreenShell({
  title,
  backLabel = "Back",
  onBack,
  homeHref = "/(tabs)",
  showBack = true,
  demo = true,
  actions,
  footer,
  emptyTitle,
  emptyBody,
  emptyAction,
  errorTitle,
  errorBody,
  children,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  homeHref?: string;
  showBack?: boolean;
  demo?: boolean;
  actions?: { icon: IconName; label: string; onPress: () => void }[];
  footer?: ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: { label: string; icon?: IconName; onPress?: () => void };
  errorTitle?: string;
  errorBody?: string;
  children: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  void demo;
  void emptyTitle;
  void emptyBody;
  void emptyAction;
  void errorTitle;
  void errorBody;
  const goBack =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace(homeHref);
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + t.space.space4,
          paddingHorizontal: t.space.space5,
          paddingBottom: footer ? t.space.space4 : t.space.space12,
          gap: t.space.space5,
          maxWidth: maxWidth.widthContent,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
          {showBack ? <IconButton icon="chevron-left" label={backLabel} onPress={goBack} /> : null}
          <Txt variant="titleMd" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </Txt>
          {actions?.map((action) => (
            <IconButton key={action.label} icon={action.icon} label={action.label} onPress={action.onPress} />
          ))}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: t.space.space5,
            paddingBottom: insets.bottom + t.space.space4,
            paddingTop: t.space.space3,
            maxWidth: maxWidth.widthContent,
            width: "100%",
            alignSelf: "center",
            gap: t.space.space3,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}


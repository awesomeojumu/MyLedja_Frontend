import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { Txt, useTheme } from "@/design";

export function TextLink({
  onPress,
  muted,
  children,
}: {
  onPress: () => void;
  muted?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8}>
      <Txt variant="label" color={muted ? t.c.inkMuted : t.c.primary} style={{ fontWeight: "600" }}>
        {children}
      </Txt>
    </Pressable>
  );
}

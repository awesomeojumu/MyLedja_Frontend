import { Pressable, View } from "react-native";
import { a11yState, Txt, useTheme } from "@/design";

export function ToggleRow({
  title,
  caption,
  value,
  onChange,
  disabled,
}: {
  title: string;
  caption: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" style={{ fontWeight: "600" }}>
          {title}
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          {caption}
        </Txt>
      </View>
      <Pressable
        onPress={disabled ? undefined : () => onChange(!value)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={title}
        {...a11yState({ checked: value, disabled: !!disabled })}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          padding: 3,
          justifyContent: "center",
          backgroundColor: disabled ? t.c.primarySoft : value ? t.c.primary : t.c.border,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: t.c.surface,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </Pressable>
    </View>
  );
}

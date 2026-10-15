import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon, Txt, useTheme } from "../../../design";

export function CheckboxRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: t.space.space3, paddingVertical: 4 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 1,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? t.c.primary : t.c.borderStrong,
          backgroundColor: checked ? t.c.primary : t.c.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Icon name="check" size={14} color={t.c.onPrimary} /> : null}
      </View>
      <Txt style={{ flex: 1 }}>{children}</Txt>
    </Pressable>
  );
}

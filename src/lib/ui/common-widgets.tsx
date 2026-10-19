import { Pressable, View } from "react-native";
import { Icon, Txt, useTheme, type IconName } from "@/design";

export function InfoTip({
  text,
  onPress,
}: {
  text: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Explanation: ${text}`}
      hitSlop={12}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      <Icon name="info" size={16} color={t.c.inkMuted} />
    </Pressable>
  );
}

export function StatusPill({
  label,
  icon,
  tone = "neutral",
}: {
  label: string;
  icon?: IconName;
  tone?: "positive" | "warning" | "danger" | "neutral" | "primary";
}) {
  const t = useTheme();
  const bg =
    tone === "positive"
      ? t.c.positiveSoft
      : tone === "warning"
      ? t.c.warningSoft
      : tone === "danger"
      ? t.c.dangerSoft
      : tone === "primary"
      ? t.c.primarySoft
      : t.c.surfaceAlt;

  const fg =
    tone === "positive"
      ? t.c.positive
      : tone === "warning"
      ? t.c.warning
      : tone === "danger"
      ? t.c.danger
      : tone === "primary"
      ? t.c.primary
      : t.c.inkMuted;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: t.radius.radiusSm,
        backgroundColor: bg,
      }}
    >
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Txt variant="caption" style={{ color: fg, fontWeight: "600" }}>
        {label}
      </Txt>
    </View>
  );
}

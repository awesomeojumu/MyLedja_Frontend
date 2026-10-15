import type { ReactNode } from "react";
import { View } from "react-native";
import { IconButton, Txt, useTheme } from "../../../design";

export function StepHeader({
  label,
  current,
  total,
  onBack,
  topRight,
}: {
  label?: string;
  current?: number;
  total?: number;
  onBack?: () => void;
  topRight?: ReactNode;
}) {
  const t = useTheme();
  const bars = total && current ? Array.from({ length: total }, (_, i) => i < current) : [];
  if (!onBack && !label && !topRight && bars.length === 0) return null;
  return (
    <View style={{ gap: t.space.space3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: t.size.touchTarget, gap: t.space.space2 }}>
        {onBack ? <IconButton icon="chevron-left" label="Back" onPress={onBack} /> : null}
        {label ? (
          <Txt variant="caption" color={t.c.inkMuted} style={{ flex: 1 }}>
            {label}
            {current && total ? ` · step ${current} of ${total}` : ""}
          </Txt>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {topRight}
      </View>
      {bars.length ? (
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: onBack ? t.size.touchTarget : 0 }}>
          {bars.map((filled, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                backgroundColor: filled ? t.c.primary : t.c.border,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

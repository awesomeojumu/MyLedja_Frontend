import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "@/design";
import { paneSplits, sideColumnWidth } from "@/lib/pane-split";

export function WidePane({
  sidebar,
  children,
  tablet = false,
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  /** Split from medium width in landscape, for list-plus-detail screens. */
  tablet?: boolean;
}) {
  const t = useTheme();
  if (!paneSplits(t.widthClass, t.portrait, tablet)) {
    return (
      <View style={{ gap: t.space.space5 }}>
        {sidebar}
        {children}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: t.space.space6, alignItems: "flex-start" }}>
      {sidebar ? <View style={{ width: sideColumnWidth(t.widthClass), flexShrink: 0, gap: t.space.space5 }}>{sidebar}</View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: t.space.space5 }}>{children}</View>
    </View>
  );
}

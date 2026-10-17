import { useEffect } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { Icon, Txt, useBackToClose, useTheme } from "@/design";
import { QUICK_ADD_TILES, type QuickAddTile } from "@/features/dashboard/quick-add-tiles";

export function QuickAddOverlay({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: QuickAddTile["id"]) => void;
}) {
  const t = useTheme();
  const compact = t.widthClass === "compact" || t.portrait;
  useBackToClose(open, onClose);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.c.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: t.space.space5,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: compact ? 340 : 420,
            backgroundColor: t.c.surface,
            borderRadius: t.radius.radiusXl,
            padding: t.space.space5,
            gap: t.space.space4,
          }}
        >
          <Txt variant="titleMd" accessibilityRole="header">
            Quick add
          </Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.space3 }}>
            {QUICK_ADD_TILES.map((tile) => (
              <Pressable
                key={tile.id}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                onPress={() => onPick(tile.id)}
                style={{
                  width: "47%",
                  flexGrow: 1,
                  minHeight: 96,
                  padding: t.space.space4,
                  borderRadius: t.radius.radiusLg,
                  borderWidth: 1,
                  borderColor: t.c.borderStrong,
                  backgroundColor: t.c.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: t.space.space2,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: t.c.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={tile.icon} size={20} color={t.c.onPrimarySoft} />
                </View>
                <Txt variant="label" style={{ fontWeight: "600", textAlign: "center" }}>
                  {tile.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

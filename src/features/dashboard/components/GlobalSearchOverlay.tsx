import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { Amount, EmptyState, Icon, IconButton, TextField, Txt, useBackToClose, useTheme } from "../../../design";
import { HOME_DUMMY, searchDashboard, type SearchHit } from "../dummy-data";

const GROUPS: SearchHit["group"][] = ["Transactions", "Accounts", "Goals"];

export function GlobalSearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const compact = t.widthClass === "compact" || t.portrait;
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchDashboard(query), [query]);
  const close = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);
  useBackToClose(open, close);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const onKey = (event: { key: string }) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.c.scrim,
          alignItems: "center",
          justifyContent: compact ? "flex-start" : "center",
          padding: t.space.space5,
          paddingTop: compact ? 72 : t.space.space5,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: compact ? 560 : 640,
            maxHeight: compact ? "85%" : "80%",
            backgroundColor: t.c.surface,
            borderRadius: t.radius.radiusXl,
            padding: t.space.space5,
            gap: t.space.space4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
            <Txt variant="titleMd" accessibilityRole="header" style={{ flex: 1 }}>
              Search
            </Txt>
            <IconButton icon="x" label="Close search" onPress={close} />
          </View>
          <TextField
            icon="search"
            label="Search"
            placeholder="Transactions, accounts, goals"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: t.space.space4 }}>
            {hits.length === 0 ? (
              <EmptyState title="Nothing matches" icon="search">
                Try Shoprite, GTBank, or Emergency.
              </EmptyState>
            ) : (
              GROUPS.map((group) => {
                const rows = hits.filter((hit) => hit.group === group);
                if (rows.length === 0) return null;
                return (
                  <View key={group} style={{ gap: t.space.space2 }}>
                    <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600" }}>
                      {group}
                    </Txt>
                    {rows.map((hit) => (
                      <SearchRow key={hit.id} hit={hit} />
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SearchRow({ hit }: { hit: SearchHit }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.space.space3,
        minHeight: t.size.touchTarget,
        paddingVertical: t.space.space2,
        borderBottomWidth: 1,
        borderBottomColor: t.c.border,
      }}
    >
      <Icon name={hit.group === "Accounts" ? "landmark" : hit.group === "Goals" ? "target" : "receipt"} size={18} color={t.c.inkMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" style={{ fontWeight: "600" }}>
          {hit.title}
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          {hit.subtitle}
        </Txt>
      </View>
      {hit.amount != null ? <Amount value={hit.amount} currency={HOME_DUMMY.currency} size="sm" /> : null}
    </View>
  );
}

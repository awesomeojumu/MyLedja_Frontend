import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { EmptyState, IconButton, TextField, Txt, useBackToClose, useTheme } from "@/design";
import { flattenSearch, searchHref, type SearchHit } from "@/features/transactions/services/search-hits";
import { LiveNotice } from "@/lib/live-notice";
import { useSession } from "@/state";
import { ApiError } from "@/api/client";

export function GlobalSearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const compact = t.widthClass === "compact" || t.portrait;
  const router = useRouter();
  const { session, workspaces, status } = useSession();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => {
    setQuery("");
    setHits([]);
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

  useEffect(() => {
    if (status !== "signedIn" || !workspaces[0] || query.trim().length < 2) {
      queueMicrotask(() => setHits([]));
      return;
    }
    void session
      .search(workspaces[0].id, query.trim())
      .then((res) => {
        setHits(flattenSearch(res.data));
        setOffline(false);
        setError(null);
      })
      .catch((err: unknown) => {
        setHits([]);
        if (err instanceof ApiError && err.status === 0) {
          setOffline(true);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "Could not search");
        }
      });
  }, [query, session, status, workspaces]);

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
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
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
            label="Find a record"
            placeholder="Transactions, accounts, bills, goals, debts"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: t.space.space4 }}>
            <LiveNotice offline={offline} error={error} hasData={hits.length > 0} />
            {hits.length === 0 ? (
              <EmptyState title="Nothing matches" icon="search">
                Type at least two characters. Results come from your workspace.
              </EmptyState>
            ) : (
              hits.map((hit) => (
                <Pressable
                  key={`${hit.kind}-${hit.id}`}
                  onPress={() => {
                    router.push(searchHref(hit) as never);
                    close();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${hit.label}${hit.kind === "account" ? ", Account" : hit.kind === "transaction" && hit.amount ? `, ${hit.amount}` : ""}`}
                >
                  <Txt variant="label">
                    {hit.label}
                    {hit.kind === "account" ? " · Account" : hit.kind === "transaction" && hit.amount ? ` · ${hit.amount}` : ""}
                  </Txt>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

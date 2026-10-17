import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, IconButton, Txt, useTheme } from "@/design";
import { cacheKey, getSnapshot, putSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useSession } from "@/state";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session, status, workspaces } = useSession();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (status !== "signedIn" || !workspaceId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const key = cacheKey(workspaceId, "reports", "dash");
    const cached = getSnapshot(key);
    if (cached) {
      queueMicrotask(() => {
        setSnapshot(cached);
        setLoading(false);
      });
      return;
    }
    void session
      .dashboard(workspaceId)
      .then((res) => setSnapshot(putSnapshot(key, res.data as unknown as DashboardSnapshot)))
      .finally(() => setLoading(false));
  }, [session, status, workspaceId]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, gap: t.space.space4 }}>
      {onBack ? <IconButton icon="chevron-left" label="Back" onPress={onBack} /> : null}
      <Txt variant="titleMd" accessibilityRole="header">
        Reports
      </Txt>
      {loading ? (
        <EmptyState title="Loading reports" icon="clock">
          Same dashboard snapshot as Home.
        </EmptyState>
      ) : snapshot ? (
        <Txt variant="body">
          Income ₦{snapshot.income.value} · Expense ₦{snapshot.expense.value} · Net ₦{snapshot.netWorth.value}
        </Txt>
      ) : (
        <EmptyState title="No snapshot yet" icon="inbox">
          Add a posted record, then open reports again.
        </EmptyState>
      )}
    </View>
  );
}

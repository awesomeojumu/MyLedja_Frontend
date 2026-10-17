import { useEffect, useState } from "react";
import { View } from "react-native";
import { EmptyState, Txt, useTheme } from "@/design";
import { SCREEN_TITLES } from "@/lib/screen-catalog";
import { cacheKey, getSnapshot, putSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useSession } from "@/state";

export function DashboardSnapshotScreen({ id }: { id: string }) {
  const t = useTheme();
  const title = SCREEN_TITLES[id] ?? id;
  const { session, status, workspaces } = useSession();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (status !== "signedIn" || !workspaceId) return;
    const key = cacheKey(workspaceId, id, "dash");
    const cached = getSnapshot(key);
    if (cached) {
      queueMicrotask(() => setSnapshot(cached));
      return;
    }
    queueMicrotask(() => setLoading(true));
    void session
      .dashboard(workspaceId)
      .then((res) => setSnapshot(putSnapshot(key, res.data as unknown as DashboardSnapshot)))
      .catch(() => setSnapshot(null))
      .finally(() => setLoading(false));
  }, [id, session, status, workspaceId]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg, padding: t.space.space5, gap: t.space.space4 }}>
      <Txt variant="titleMd">{title}</Txt>
      {loading ? (
        <EmptyState title="Loading records" icon="clock">
          Waiting for your workspace.
        </EmptyState>
      ) : snapshot ? (
        <Txt variant="body">
          Income {snapshot.income.value} · Expense {snapshot.expense.value} · Net {snapshot.netWorth.value}
        </Txt>
      ) : (
        <EmptyState title="No snapshot yet" icon="inbox">
          Sign in to load this workspace.
        </EmptyState>
      )}
    </View>
  );
}

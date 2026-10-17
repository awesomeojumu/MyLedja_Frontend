import { useEffect, useState } from "react";
import { View } from "react-native";
import { Amount, Card, EmptyState, Txt, useTheme } from "@/design";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { cacheKey, getSnapshot, putSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useSession } from "@/state";

export function CashFlowScreen() {
  const t = useTheme();
  const { session, status, workspaces } = useSession();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (status !== "signedIn" || !workspaceId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const key = cacheKey(workspaceId, "cash", "flow");
    const cached = getSnapshot(key);
    if (cached) {
      queueMicrotask(() => {
        setSnapshot(cached);
        setLoading(false);
      });
      return;
    }
    void session.dashboard(workspaceId).then((res) => {
      setSnapshot(putSnapshot(key, res.data as unknown as DashboardSnapshot));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session, status, workspaceId]);

  const naira = (value?: string) => Number.parseFloat(value ?? "0") || 0;

  return (
    <DashboardScreen title="Cash flow">
      {loading ? (
        <EmptyState title="Loading cash flow" icon="clock">Loading is not ₦0.</EmptyState>
      ) : snapshot ? (
        <Card>
          <View style={{ gap: t.space.space3 }}>
            <Txt variant="caption" color={t.c.inkMuted}>{snapshot.income.basis}</Txt>
            <Amount value={naira(snapshot.income.value)} currency="NGN" kind="income" />
            <Txt variant="caption" color={t.c.inkMuted}>{snapshot.expense.basis}</Txt>
            <Amount value={naira(snapshot.expense.value)} currency="NGN" kind="expense" />
          </View>
        </Card>
      ) : (
        <EmptyState title="Sign in to load cash flow" icon="inbox">Figures come from GET dashboard.</EmptyState>
      )}
    </DashboardScreen>
  );
}

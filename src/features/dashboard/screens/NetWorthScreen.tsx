import { useEffect, useState } from "react";
import { Card, EmptyState, HeroBalance, Txt } from "@/design";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { cacheKey, getSnapshot, putSnapshot, type DashboardSnapshot } from "@/features/dashboard/services/range-cache";
import { useSession } from "@/state";

export function NetWorthScreen() {
  const { session, status, workspaces } = useSession();
  const [hidden, setHidden] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const workspaceId = workspaces[0]?.id;

  useEffect(() => {
    if (status !== "signedIn" || !workspaceId) return;
    const key = cacheKey(workspaceId, "net", "worth");
    const cached = getSnapshot(key);
    if (cached) {
      queueMicrotask(() => setSnapshot(cached));
      return;
    }
    void session.dashboard(workspaceId).then((res) => {
      setSnapshot(putSnapshot(key, res.data as unknown as DashboardSnapshot));
    });
  }, [session, status, workspaceId]);

  return (
    <DashboardScreen title="Net worth">
      {snapshot ? (
        <>
          <HeroBalance
            label="Net worth"
            value={Number.parseFloat(snapshot.netWorth.value) || 0}
            currency="NGN"
            hidden={hidden}
            onToggleHidden={() => setHidden((prev) => !prev)}
            freshness={snapshot.netWorth.basis}
          />
          <Card>
            <Txt variant="caption">{snapshot.netWorth.basis}</Txt>
          </Card>
        </>
      ) : (
        <EmptyState title="Loading net worth" icon="clock">Goals are ignored. Loading is not ₦0.</EmptyState>
      )}
    </DashboardScreen>
  );
}

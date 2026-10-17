import { useMemo, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Dialog, TransactionRow, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { useSession } from "@/state";
import { pendingBadge } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { TxScreen } from "@/features/transactions/components/TxScreen";

export function SyncQueueScreen() {
  const t = useTheme();
  const { user } = useSession();
  const [signOut, setSignOut] = useState(false);
  const rows = useMemo(() => {
    if (!user) return [];
    return outboxForUser(user.userId)
      .list(user.userId)
      .filter((row) => pendingBadge(row.syncStatus));
  }, [user]);
  return (
    <TxScreen
      title="Sync queue"
      emptyTitle="All synced"
      emptyBody="Nothing is waiting to leave this phone."
      errorTitle="Could not load the queue"
      footer={<Button variant="secondary" fullWidth onPress={() => setSignOut(true)}>Sign out with unsynced</Button>}
    >
      <WidePane
        sidebar={
          <Banner tone="warning" title="Waiting on this phone">
            Failed and pending records retry when you are online.
          </Banner>
        }
      >
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {rows.map((row) => {
            const payload = row.payload as { description?: string; amount?: string; type?: string };
            return (
              <TransactionRow
                key={row.operationId}
                title={payload.description ?? "Saved on this phone"}
                category={row.syncStatus}
                account=""
                amount={Number(payload.amount ?? 0)}
                kind={payload.type === "income" ? "income" : "expense"}
                time=""
                status={row.syncStatus === "failed_temporarily" ? "failed" : "pending"}
              />
            );
          })}
        </View>
      </WidePane>
      <Dialog
        title="Unsynced records"
        open={signOut}
        confirmLabel="Stay signed in"
        onClose={() => setSignOut(false)}
        onConfirm={() => setSignOut(false)}
      >
        Sign out will keep these on this phone until they sync.
      </Dialog>
    </TxScreen>
  );
}

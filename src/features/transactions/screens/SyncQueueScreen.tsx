import { useMemo, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Dialog, TransactionRow, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { useSession } from "@/state";
import { pendingBadge } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { unsyncedSignOutFooter } from "@/features/transactions/services/sync-queue-copy";

const STATUS_WORDS: Record<string, string> = {
  saved_on_device: "Waiting to sync",
  failed_temporarily: "Waiting to sync",
  syncing: "Syncing",
  needs_attention: "Needs your attention",
};

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
      footer={
        unsyncedSignOutFooter(rows.length) ? (
          <Button variant="secondary" fullWidth onPress={() => setSignOut(true)}>
            Sign out with unsynced
          </Button>
        ) : undefined
      }
    >
      <WidePane
        sidebar={
          rows.length > 0 ? (
            <Banner tone="warning" title="Waiting on this phone">
              These records are safe on this phone. They send automatically when you’re back online.
            </Banner>
          ) : (
            <Banner tone="positive" title="All synced">
              Nothing is waiting to leave this phone.
            </Banner>
          )
        }
      >
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {rows.map((row) => {
            const payload = row.payload as { description?: string; amount?: string; type?: string };
            return (
              <TransactionRow
                key={row.operationId}
                title={payload.description ?? "Saved on this phone"}
                category={STATUS_WORDS[row.syncStatus] ?? "Waiting to sync"}
                account=""
                amount={Number(payload.amount ?? 0)}
                kind={payload.type === "income" ? "income" : "expense"}
                time=""
                status={row.syncStatus === "needs_attention" ? "failed" : row.syncStatus === "syncing" ? "syncing" : "pending"}
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
        <Txt color={t.c.inkMuted}>Sign out will keep these on this phone until they sync.</Txt>
      </Dialog>
    </TxScreen>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Dialog, TransactionRow, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { QUEUE_ROWS } from "../dummy-data";

export function SyncQueueScreen() {
  const t = useTheme();
  const [signOut, setSignOut] = useState(false);
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
            Failed and pending records retry when you are online. Use Design state Empty for all synced.
          </Banner>
        }
      >
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {QUEUE_ROWS.map((row) => (
            <TransactionRow key={row.id} title={row.title} category={row.category} account={row.account} amount={row.amount} kind={row.kind} time={row.time} status={row.status} />
          ))}
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

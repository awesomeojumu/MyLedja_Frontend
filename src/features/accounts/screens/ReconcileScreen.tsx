import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AmountInput, Banner, Button, Toast } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { useSession } from "@/state";

export function ReconcileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [statement, setStatement] = useState("0.00");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <AccountScreenShell
      title="Reconcile account"
      emptyTitle="Nothing to match"
      errorTitle="Could not reconcile"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() => {
            const workspaceId = workspaces[0]?.id;
            if (!workspaceId || !id) return;
            setBusy(true);
            void session
              .postCollection(workspaceId, `accounts/${id}/reconcile`, { externalBalance: statement })
              .then(() => setToast("External balance stored. Calculated balance stayed."))
              .catch((err: Error) => setToast(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Compare statement
        </Button>
      }
    >
      <Banner tone="warning" title="External never overwrites calculated">
        We only store the statement figure next to the ledger balance.
      </Banner>
      <AmountInput label="On the statement" value={statement} onChange={setStatement} />
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </AccountScreenShell>
  );
}

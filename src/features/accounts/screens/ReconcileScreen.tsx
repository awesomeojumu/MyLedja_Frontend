import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Amount, AmountInput, Badge, Banner, Button, Toast } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { nairaAmount } from "@/lib/money-map";
import { useSession } from "@/state";

type Compare = { calculated: string; external: string; difference: string; reconciled: boolean };

export function ReconcileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [statement, setStatement] = useState("0.00");
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Compare | null>(null);

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
              .then((res) => {
                setResult(res.data as Compare);
                setToast("External balance stored. Calculated balance stayed.");
              })
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
      {result ? (
        <>
          <Amount value={nairaAmount(result.calculated)} />
          <Amount value={nairaAmount(result.external)} />
          <Amount value={nairaAmount(result.difference)} />
          <Badge tone={result.reconciled ? "positive" : "warning"} icon={false}>
            {result.reconciled ? "Matched" : "Gap"}
          </Badge>
          <Button fullWidth variant="secondary" onPress={() => router.push(`/(tabs)/accounts/history?id=${id}`)}>
            History
          </Button>
        </>
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </AccountScreenShell>
  );
}

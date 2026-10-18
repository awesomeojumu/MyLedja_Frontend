import { useCallback, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Amount, AmountInput, Button, Dialog, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { afterMoneyWrite } from "@/lib/after-money";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const NONE = null as ReturnType<typeof toLedgerAccount> | null;

export function OpeningBalanceScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      if (!id) return null;
      const res = await session.getAccount(workspaceId, id);
      return toLedgerAccount(res.data as ApiAccount);
    },
    [id, session],
  );
  const { data: account } = useLiveQuery(load, NONE, id ? `opening:${id}` : "opening");
  const shown = account ? account.opening.toFixed(2) : "0.00";
  const [opening, setOpening] = useState(shown);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = opening.trim() ? (opening.includes(".") ? opening : `${opening}.00`) : "0.00";

  const save = () => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId || !id) {
      setError("Sign in first.");
      return;
    }
    setBusy(true);
    void session
      .setOpening(workspaceId, id, amount)
      .then(() => {
        afterMoneyWrite();
        setConfirmOpen(false);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <AccountScreenShell title="Opening balance" showBack>
      {account ? (
        <>
          <Amount value={account.opening} />
          <AmountInput
            label="New opening"
            value={opening}
            onChange={setOpening}
            helper="Opening is not income. Posted activity stays."
          />
          <Button fullWidth loading={busy} onPress={() => setConfirmOpen(true)}>
            Correct opening
          </Button>
          {error ? (
            <Txt variant="caption" color={t.c.danger}>
              {error}
            </Txt>
          ) : null}
          <Dialog
            title="Correct this opening?"
            open={confirmOpen}
            confirmLabel="Correct"
            cancelLabel="Cancel"
            onClose={() => setConfirmOpen(false)}
            onConfirm={save}
          >
            <Txt color={t.c.inkMuted}>
              Change opening from ₦{shown} to ₦{amount}? This is not income. Posted activity stays.
            </Txt>
          </Dialog>
        </>
      ) : (
        <Txt variant="body" color={t.c.inkMuted}>
          Open this from an account.
        </Txt>
      )}
    </AccountScreenShell>
  );
}

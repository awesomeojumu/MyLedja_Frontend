import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Amount, AmountInput, Button, Dialog, Sheet, Txt, useTheme } from "@/design";
import type { LedgerAccount } from "@/features/accounts/types/account";
import { afterMoneyWrite } from "@/lib/after-money";
import { useSession } from "@/state";

export function AccountManageSheet({
  account,
  open,
  onClose,
}: {
  account: LedgerAccount;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [opening, setOpening] = useState(account.opening ? account.opening.toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const workspaceId = workspaces[0]?.id;
  const amount = opening.trim() ? (opening.includes(".") ? opening : `${opening}.00`) : "0.00";

  const saveOpening = () => {
    if (!workspaceId) {
      setError("Sign in first.");
      return;
    }
    setBusy(true);
    setError(null);
    void session
      .setOpening(workspaceId, account.id, amount)
      .then(() => {
        afterMoneyWrite();
        onClose();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const archive = () => {
    if (!workspaceId) return;
    setBusy(true);
    void session
      .archiveAccount(workspaceId, account.id)
      .then(() => {
        afterMoneyWrite();
        setArchiveOpen(false);
        onClose();
        router.replace("/(tabs)/accounts");
      })
      .catch((err: Error) => {
        setError(err.message);
        setArchiveOpen(false);
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Sheet title="Manage account" open={open} onClose={onClose}>
        <Txt variant="titleSm">{account.name}</Txt>
        <Amount value={account.balance} size="lg" />
        <Txt variant="caption" color={t.c.inkMuted}>
          {account.kind.charAt(0).toUpperCase() + account.kind.slice(1)} · opening is not income
        </Txt>
        <AmountInput label="Correct opening" value={opening} onChange={setOpening} helper="Replaces the opening figure. Posted activity stays." />
        {error ? (
          <Txt variant="caption" color={t.c.danger}>
            {error}
          </Txt>
        ) : null}
        <Button fullWidth loading={busy} onPress={saveOpening}>
          Save opening
        </Button>
        <View style={{ gap: 8 }}>
          <Button
            fullWidth
            variant="secondary"
            onPress={() => {
              onClose();
              router.push(`/(tabs)/accounts/reconcile?id=${account.id}`);
            }}
          >
            Reconcile statement
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onPress={() => {
              onClose();
              router.push(`/(tabs)/accounts/import?id=${account.id}`);
            }}
          >
            Import statement
          </Button>
          <Button fullWidth variant="destructive" onPress={() => setArchiveOpen(true)}>
            Archive account
          </Button>
        </View>
      </Sheet>
      <Dialog
        title="Archive this account?"
        open={archiveOpen}
        tone="destructive"
        confirmLabel="Archive"
        cancelLabel="Keep"
        onClose={() => setArchiveOpen(false)}
        onConfirm={archive}
      >
        <Txt color={t.c.inkMuted}>
          {account.name} leaves the live list. Activity stays. You can still find it under archived accounts.
        </Txt>
      </Dialog>
    </>
  );
}

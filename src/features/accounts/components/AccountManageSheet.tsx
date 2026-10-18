import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Amount, AmountInput, Button, Dialog, IconButton, SegmentedControl, Sheet, Txt, useTheme } from "@/design";
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
  const shown = account.opening.toFixed(2);
  const [opening, setOpening] = useState(shown);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [editingKind, setEditingKind] = useState(false);
  const [kind, setKind] = useState(account.kind);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const workspaceId = workspaces[0]?.id;
  const amount = opening.trim() ? (opening.includes(".") ? opening : `${opening}.00`) : "0.00";
  const kindLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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
        setConfirmOpen(false);
        setEditing(false);
        onClose();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const saveKind = () => {
    if (!workspaceId) {
      setError("Sign in first.");
      return;
    }
    setBusy(true);
    setError(null);
    void session
      .setAccountKind(workspaceId, account.id, kind)
      .then(() => {
        afterMoneyWrite();
        setKindOpen(false);
        setEditingKind(false);
        onClose();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const restore = () => {
    if (!workspaceId) return;
    setBusy(true);
    void session
      .restoreAccount(workspaceId, account.id)
      .then(() => {
        afterMoneyWrite();
        onClose();
        router.replace("/(tabs)/accounts");
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
        <View style={{ gap: 4 }}>
          <Txt variant="titleSm">{account.name}</Txt>
          <Amount value={account.balance} size="lg" />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              {kindLabel(account.kind)}
            </Txt>
            <IconButton
              icon="pencil"
              label="Change type"
              onPress={() => {
                setKind(account.kind === "wallet" || account.kind === "bank" ? account.kind : "cash");
                setEditingKind(true);
                setError(null);
              }}
            />
          </View>
          {editingKind ? (
            <>
              <SegmentedControl
                label="Type"
                value={kind === "wallet" || kind === "bank" ? kind : "cash"}
                onChange={(value) => {
                  if (value === "bank" || value === "wallet" || value === "cash") setKind(value);
                }}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank" },
                  { value: "wallet", label: "Wallet" },
                ]}
              />
              <Button fullWidth variant="secondary" loading={busy} onPress={() => setKindOpen(true)}>
                Change type
              </Button>
            </>
          ) : null}
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Txt variant="caption" color={t.c.inkMuted}>
                Opening
              </Txt>
              <Amount value={account.opening} />
            </View>
            <IconButton
              icon="pencil"
              label="Correct opening"
              onPress={() => {
                setOpening(shown);
                setEditing(true);
                setError(null);
              }}
            />
          </View>
          {editing ? (
            <>
              <AmountInput label="New opening" value={opening} onChange={setOpening} helper="Opening is not income. Posted activity stays." />
              <Button fullWidth variant="secondary" loading={busy} onPress={() => setConfirmOpen(true)}>
                Correct opening
              </Button>
            </>
          ) : null}
        </View>
        {error ? (
          <Txt variant="caption" color={t.c.danger}>
            {error}
          </Txt>
        ) : null}
        <View style={{ gap: 6 }}>
          {account.archived ? (
            <Button fullWidth loading={busy} onPress={restore}>
              Restore
            </Button>
          ) : (
            <>
              <Button
                fullWidth
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push(`/(tabs)/accounts/edit?id=${account.id}`);
                }}
              >
                Edit account
              </Button>
              <Button
                fullWidth
                variant="secondary"
                onPress={() => {
                  onClose();
                  router.push(`/(tabs)/accounts/opening?id=${account.id}`);
                }}
              >
                Correct opening
              </Button>
              {account.kind === "bank" || account.kind === "wallet" ? (
                <>
                  <Button
                    fullWidth
                    variant="secondary"
                    onPress={() => {
                      onClose();
                      router.push(`/(tabs)/accounts/import?id=${account.id}`);
                    }}
                  >
                    Import bank statement
                  </Button>
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
                </>
              ) : null}
              <Button fullWidth variant="destructive" loading={busy} onPress={() => setArchiveOpen(true)}>
                Archive account
              </Button>
            </>
          )}
        </View>
      </Sheet>
      <Dialog
        title="Correct this opening?"
        open={confirmOpen}
        confirmLabel="Correct"
        cancelLabel="Cancel"
        onClose={() => setConfirmOpen(false)}
        onConfirm={saveOpening}
      >
        <Txt color={t.c.inkMuted}>
          Change opening from ₦{shown} to ₦{amount}? This is not income. Posted activity stays.
        </Txt>
      </Dialog>
      <Dialog
        title="Change this type?"
        open={kindOpen}
        confirmLabel="Change"
        cancelLabel="Cancel"
        onClose={() => setKindOpen(false)}
        onConfirm={saveKind}
      >
        <Txt color={t.c.inkMuted}>
          Change {account.name} from {kindLabel(account.kind)} to {kindLabel(kind)}? Balances stay.
        </Txt>
      </Dialog>
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
          {account.name} leaves the live list. Activity stays.
        </Txt>
      </Dialog>
    </>
  );
}

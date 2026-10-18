import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { afterSetupSave } from "@/features/auth-onboarding/services/setup-progress";
import { AmountInput, Button, Dialog, SegmentedControl, Select, TextField, Toast, Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { afterMoneyWrite } from "@/lib/after-money";
import { toLedgerAccount, type ApiAccount } from "@/lib/money-map";
import { useSession } from "@/state";

export const EditAccountScreen = AddAccountScreen;

export function AddAccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { kind: kindParam, institution: institutionParam, from, id } = useLocalSearchParams<{
    kind?: string;
    institution?: string;
    from?: string;
    id?: string;
  }>();
  const accountId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;
  const editing = Boolean(accountId);
  const { session, workspaces } = useSession();
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kindParam === "bank" || kindParam === "wallet" ? kindParam : "cash");
  const [institutionId, setInstitutionId] = useState(institutionParam ?? "");
  const [institutionName, setInstitutionName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [opening, setOpening] = useState("");
  const [banks, setBanks] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [kindOpen, setKindOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState(kind);
  const needsInstitution = kind === "bank" || kind === "wallet";

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) return;
    void session.listInstitutions(workspaceId).then((res) => {
      const rows = Array.isArray(res.data) ? res.data : [];
      setBanks(rows.map((row) => ({ value: row.id, label: row.name })));
    });
  }, [session, workspaces]);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId || !accountId) return;
    void session.getAccount(workspaceId, accountId).then((res) => {
      const account = toLedgerAccount(res.data as ApiAccount);
      const rec = res.data as ApiAccount;
      setName(account.name);
      setKind(account.kind === "bank" || account.kind === "wallet" ? account.kind : "cash");
      setInstitutionId(rec.institutionId ?? "");
      setInstitutionName(account.institution);
    });
  }, [accountId, session, workspaces]);

  const save = () => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      setToast("Sign in first.");
      return;
    }
    if (editing && accountId) {
      setBusy(true);
      void session
        .renameAccount(workspaceId, accountId, name.trim() || "Account")
        .then(() => {
          afterMoneyWrite();
          setToast("Account saved.");
          router.replace(`/(tabs)/accounts/${accountId}` as never);
        })
        .catch((err: Error) => setToast(err.message))
        .finally(() => setBusy(false));
      return;
    }
    if (needsInstitution && !institutionId) {
      setToast("Pick an institution. It is stored separately from this account.");
      return;
    }
    setBusy(true);
    void session
      .createAccount(workspaceId, {
        name: name.trim() || (kind === "bank" ? "Bank" : kind === "wallet" ? "Wallet" : "Cash"),
        kind,
        institutionId: needsInstitution ? institutionId : null,
        connectionType: "manual",
        currency: "NGN",
        opening: opening.trim() ? (opening.includes(".") ? opening : `${opening}.00`) : "0.00",
        accountNumber: accountNumber.replace(/\D/g, "") || undefined,
      })
      .then(async () => {
        afterMoneyWrite();
        if (from === "setup" || (Array.isArray(from) && from[0] === "setup")) {
          await session.patchSetup(workspaceId, { setupProgress: { firstAccount: true, opening: Boolean(opening.trim()) } });
        }
        setToast("Account saved.");
        router.replace(afterSetupSave(from) as never);
      })
      .catch((err: Error) => setToast(err.message))
      .finally(() => setBusy(false));
  };

  const confirmKind = () => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId || !accountId) return;
    setBusy(true);
    void session
      .setAccountKind(workspaceId, accountId, pendingKind)
      .then(() => {
        afterMoneyWrite();
        setKind(pendingKind);
        setKindOpen(false);
      })
      .catch((err: Error) => setToast(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <AccountScreenShell
      title={editing ? "Edit account" : "Add account"}
      showBack
      footer={<Button fullWidth loading={busy} onPress={save}>{editing ? "Save changes" : "Save account"}</Button>}
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder={kind === "bank" ? "GTBank Current" : kind === "wallet" ? "Opay" : "Cash"} />
      <SegmentedControl
        label="Type"
        value={kind}
        onChange={(value) => {
          if (editing) {
            setPendingKind(value);
            setKindOpen(true);
            return;
          }
          setKind(value);
          if (value === "cash") setInstitutionId("");
        }}
        options={[
          { value: "cash", label: "Cash" },
          { value: "bank", label: "Bank" },
          { value: "wallet", label: "Wallet" },
        ]}
      />
      {editing && institutionName ? (
        <Txt variant="body" color={t.c.inkMuted}>
          Institution {institutionName}
        </Txt>
      ) : null}
      {!editing && needsInstitution ? (
        <Select
          label="Institution"
          placeholder="Choose bank or wallet"
          options={banks}
          value={institutionId}
          onChange={setInstitutionId}
          helper="The institution is stored separately from this account."
        />
      ) : null}
      {!editing && needsInstitution ? (
        <TextField
          label="Account number"
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="number-pad"
          placeholder="10 digits"
          helper="Stored encrypted. Only the last four digits are shown later."
        />
      ) : null}
      {!editing ? (
        <AmountInput
          label="Opening balance"
          value={opening}
          onChange={setOpening}
          helper="Opening is not income. Balance starts here, then posted activity is added."
        />
      ) : null}
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
      <Dialog
        title="Change this type?"
        open={kindOpen}
        confirmLabel="Change"
        cancelLabel="Cancel"
        onClose={() => setKindOpen(false)}
        onConfirm={confirmKind}
      >
        <Txt color={t.c.inkMuted}>
          Change type to {pendingKind}? Balances stay.
        </Txt>
      </Dialog>
    </AccountScreenShell>
  );
}

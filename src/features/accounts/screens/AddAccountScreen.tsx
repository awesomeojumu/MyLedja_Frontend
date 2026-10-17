import { useState } from "react";
import { useRouter } from "expo-router";
import { AmountInput, Button, TextField, Toast } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { afterMoneyWrite } from "@/lib/after-money";
import { useSession } from "@/state";

export const EditAccountScreen = AddAccountScreen;

export function AddAccountScreen() {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      setToast("Sign in first.");
      return;
    }
    setBusy(true);
    void session
      .createAccount(workspaceId, {
        name: name.trim() || "Cash",
        kind: "cash",
        connectionType: "manual",
        currency: "NGN",
        opening: opening.trim() ? (opening.includes(".") ? opening : `${opening}.00`) : "0.00",
      })
      .then(() => {
        afterMoneyWrite();
        setToast("Account saved.");
        router.back();
      })
      .catch((err: Error) => setToast(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <AccountScreenShell
      title="Add account"
      showBack
      footer={<Button fullWidth loading={busy} onPress={save}>Save account</Button>}
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Cash" />
      <AmountInput label="Opening balance" value={opening} onChange={setOpening} />
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </AccountScreenShell>
  );
}

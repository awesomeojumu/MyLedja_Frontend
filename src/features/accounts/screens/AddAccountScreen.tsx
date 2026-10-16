import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AmountInput, Button, SegmentedControl, TextField, Toast } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { accountById } from "../dummy-data";
import { accountDraftIssues, savedAccountMessage } from "../services/account-draft";
import type { AccountKind } from "../types/account";

const KINDS = [
  { value: "bank", label: "Bank" },
  { value: "wallet", label: "Wallet" },
  { value: "cash", label: "Cash" },
];

export function AddAccountScreen({ mode = "add" }: { mode?: "add" | "edit" } = {}) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = mode === "edit" ? accountById(String(id ?? "")) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? "bank");
  const [opening, setOpening] = useState(existing ? String(existing.balance) : "0");
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const title = mode === "edit" ? "Edit account" : "Add account";

  const save = () => {
    const issues = accountDraftIssues({ name, kind, opening });
    if (issues.length > 0) {
      setError(issues[0]?.message);
      return;
    }
    setError(undefined);
    setToast(savedAccountMessage(name.trim()));
  };

  return (
    <AccountScreenShell title={title} emptyTitle="Nothing to save yet" errorTitle="Could not save this account" footer={<Button fullWidth onPress={save}>{mode === "edit" ? "Save account" : "Add account"}</Button>}>
      <SegmentedControl label="Account type" options={KINDS} value={kind} onChange={(value) => setKind(value as AccountKind)} />
      <TextField label="Name" value={name} onChangeText={setName} placeholder={kind === "cash" ? "Cash tin" : "GTBank Current"} error={error} />
      <AmountInput
        label="Opening balance"
        value={opening}
        onChange={setOpening}
        helper="This sets the starting figure. It is not income."
      />
      {toast ? (
        <View>
          <Toast
            message={toast}
            onClose={() => {
              setToast(null);
              router.back();
            }}
          />
        </View>
      ) : null}
    </AccountScreenShell>
  );
}

export function EditAccountScreen() {
  return <AddAccountScreen mode="edit" />;
}

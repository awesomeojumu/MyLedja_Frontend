import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { ApiError } from "../../../api/client";
import { AmountInput, Banner, Button, SegmentedControl, TextField, Toast, formatMoney } from "../../../design";
import { useSession } from "../../../state";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { accountById } from "../dummy-data";
import { accountDraftIssues, savedAccountMessage } from "../services/account-draft";
import type { AccountKind } from "../types/account";

const KINDS = [
  { value: "bank", label: "Bank" },
  { value: "wallet", label: "Wallet" },
  { value: "cash", label: "Cash" },
  { value: "savings", label: "Savings" },
];

export function AddAccountScreen({ mode = "add" }: { mode?: "add" | "edit" } = {}) {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const existing = mode === "edit" ? accountById(String(id ?? "")) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>((existing?.kind ?? (kindParam as AccountKind) ?? "bank") as AccountKind);
  const [opening, setOpening] = useState(existing ? String(existing.balance) : "0");
  const [error, setError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linked, setLinked] = useState<{ institution: string; mask: string; balance: number; currency: string } | null>(null);
  const title = mode === "edit" ? "Edit account" : "Add account";
  const workspaceId = workspaces[0]?.id;

  const save = () => {
    const issues = accountDraftIssues({ name, kind, opening });
    if (issues.length > 0) {
      setError(issues[0]?.message);
      return;
    }
    setError(undefined);
    setToast(savedAccountMessage(name.trim()));
    if (mode === "add") {
      router.push("/(tabs)/accounts/opening");
    }
  };

  const startLink = async () => {
    setError(undefined);
    setLinkBusy(true);
    try {
      const result = await session.startBankLink(workspaceId);
      await Linking.openURL(result.data.monoUrl);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not start bank linking.");
    } finally {
      setLinkBusy(false);
    }
  };

  const finishLink = async () => {
    setError(undefined);
    setLinkBusy(true);
    try {
      const result = await session.completeBankLink(code, workspaceId);
      const data = result.data;
      setLinked({ institution: data.institution, mask: data.mask, balance: data.balance, currency: data.currency });
      setName(data.institution);
      setOpening(String(data.balance));
      setKind("bank");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not finish bank linking.");
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <AccountScreenShell title={title} emptyTitle="Nothing to save yet" errorTitle="Could not save this account" footer={<Button fullWidth onPress={save}>{mode === "edit" ? "Save account" : "Add account"}</Button>}>
      <WidePane>
      <Button variant="tertiary" onPress={() => router.push("/(tabs)/accounts/types")}>
        Change type
      </Button>
      <SegmentedControl label="Account type" options={KINDS} value={kind} onChange={(value) => setKind(value as AccountKind)} />
      {kind === "bank" && mode === "add" ? (
        <View style={{ gap: 12 }}>
          <Button variant="secondary" loading={linkBusy} onPress={() => void startLink()}>
            Link with Mono
          </Button>
          <TextField
            label="Mono code"
            value={code}
            onChangeText={setCode}
            placeholder="Paste the code from Mono"
            autoCapitalize="none"
            helper="Sandbox shows the code after you pick a test bank."
          />
          <Button variant="tertiary" loading={linkBusy} onPress={() => void finishLink()}>
            Finish link
          </Button>
          {linked ? (
            <Banner tone="positive" title={`${linked.institution} · •••• ${linked.mask}`}>
              {`${formatMoney(linked.balance, linked.currency)} on this sandbox link. Nothing was posted as a transaction.`}
            </Banner>
          ) : null}
        </View>
      ) : null}
      <TextField label="Name" value={name} onChangeText={setName} placeholder={kind === "cash" ? "Cash tin" : "GTBank Current"} error={error} />
      <AmountInput
        label="Opening balance"
        value={opening}
        onChange={setOpening}
        helper="This sets the starting figure. It is not income."
      />
      </WidePane>
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

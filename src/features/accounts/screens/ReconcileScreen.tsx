import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount, AmountInput, Banner, Button, Card, Txt, Toast, useTheme } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { accountById } from "../dummy-data";

export function ReconcileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? "gtbank")) ?? accountById("gtbank");
  const book = account?.balance ?? 0;
  const [statement, setStatement] = useState(String(book));
  const [toast, setToast] = useState<string | null>(null);
  const stated = Number(statement) || 0;
  const diff = stated - book;
  const matched = Math.abs(diff) < 0.005;

  return (
    <AccountScreenShell
      title="Reconcile"
      emptyTitle="Nothing to match"
      errorTitle="Could not reconcile"
      footer={<Button fullWidth disabled={!matched} disabledReason={matched ? undefined : "Enter the statement closing balance so both figures match."} onPress={() => setToast(`${account?.name ?? "Account"} is reconciled.`)}>Mark reconciled</Button>}
    >
      <Card>
        <View style={{ gap: t.space.space3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              In MyLedja
            </Txt>
            <Amount value={book} />
          </View>
          <AmountInput label="On the statement" value={statement} onChange={setStatement} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              Difference
            </Txt>
            <Amount value={Math.abs(diff)} kind={matched ? "neutral" : "expense"} />
          </View>
        </View>
      </Card>
      {matched ? (
        <Banner tone="positive" title="Balances match">
          {`${account?.name ?? "This account"} matches the statement.`}
        </Banner>
      ) : (
        <Banner tone="warning" title="Balances do not match">
          Import a statement or add the missing transactions, then try again.
        </Banner>
      )}
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </AccountScreenShell>
  );
}

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Banner, Button, Card, EmptyState, Txt, Toast, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { transactionById } from "../dummy-data";

export function ReceiptScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const row = transactionById(String(id ?? "shoprite")) ?? transactionById("shoprite");
  const [attached, setAttached] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  return (
    <TxScreen
      title="Receipt"
      emptyTitle="No receipt yet"
      emptyBody="Attach a photo of the slip. Dummy files stay on this phone."
      emptyAction={{ label: "Attach receipt", icon: "receipt", onPress: () => setAttached(true) }}
      errorTitle="Could not load this receipt"
      footer={<Button fullWidth onPress={() => setToast(attached ? "Receipt kept on this phone." : "Attach a receipt first.")}>{attached ? "Keep receipt" : "Attach receipt"}</Button>}
    >
      <WidePane
        sidebar={
          <Card>
            <Txt variant="titleSm">{row?.title ?? "This record"}</Txt>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              {row?.account} · {row?.time}
            </Txt>
          </Card>
        }
      >
        {attached ? (
          <Banner tone="positive" title="Receipt attached">
            Dummy image is on this phone only. Nothing was uploaded.
          </Banner>
        ) : (
          <EmptyState title="No receipt yet" icon="receipt" action={{ label: "Attach receipt", onPress: () => setAttached(true) }}>
            Attach a photo of the slip. Dummy files stay on this phone.
          </EmptyState>
        )}
      </WidePane>
      {toast ? (
        <Toast
          message={toast}
          onClose={() => {
            setToast(null);
            router.back();
          }}
        />
      ) : null}
    </TxScreen>
  );
}

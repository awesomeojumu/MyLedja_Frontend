import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Card, Dialog, TransactionRow, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { TRANSACTIONS } from "@/features/transactions/dummy-data";

export function BulkActionsScreen() {
  const t = useTheme();
  const [preview, setPreview] = useState(false);
  const selected = TRANSACTIONS.slice(0, 3);
  return (
    <TxScreen title="Bulk actions" emptyTitle="Nothing selected" errorTitle="Could not change these records" footer={<Button fullWidth onPress={() => setPreview(true)}>Change category</Button>}>
      <WidePane
        sidebar={
          <Card>
            <Txt variant="titleSm">{selected.length} selected</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Dummy records on this phone.
            </Txt>
          </Card>
        }
      >
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {selected.map((row) => (
            <TransactionRow key={row.id} title={row.title} category={row.category} account={row.account} amount={row.amount} kind={row.kind} time={row.time} />
          ))}
        </View>
      </WidePane>
      <Dialog title="3 records will change" open={preview} confirmLabel="Apply Food & groceries" onClose={() => setPreview(false)} onConfirm={() => setPreview(false)}>
        Food & groceries. This is a demo preview.
      </Dialog>
      {preview ? (
        <Banner tone="primary" title="3 records will change category">
          Food & groceries. This is a demo preview.
        </Banner>
      ) : null}
    </TxScreen>
  );
}

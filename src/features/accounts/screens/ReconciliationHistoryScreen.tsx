import { View } from "react-native";
import { Card, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";
import { RECONCILE_HISTORY } from "@/features/accounts/dummy-data";

export function ReconciliationHistoryScreen() {
  const t = useTheme();
  return (
    <AccountScreenShell title="Reconciliation history" emptyTitle="No reconciliations yet" errorTitle="Could not load history">
      <WidePane>
      {RECONCILE_HISTORY.map((row) => (
        <Card key={row.id}>
          <Txt variant="titleSm">{row.account}</Txt>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Txt variant="bodySm" color={t.c.inkMuted}>
              {row.when}
            </Txt>
            <Txt variant="bodySm">{row.result}</Txt>
          </View>
        </Card>
      ))}
      </WidePane>
    </AccountScreenShell>
  );
}

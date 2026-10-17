import { Card, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { CORRECTIONS } from "@/features/transactions/dummy-data";

export function CorrectionHistoryScreen() {
  const t = useTheme();
  return (
    <TxScreen title="Correction history" emptyTitle="No corrections yet" errorTitle="Could not load history">
      <WidePane>
      {CORRECTIONS.map((row) => (
        <Card key={row.id}>
          <Txt variant="titleSm">{row.title}</Txt>
          <Txt variant="bodySm" color={t.c.inkMuted}>
            {row.when} · {row.result}
          </Txt>
        </Card>
      ))}
      </WidePane>
    </TxScreen>
  );
}

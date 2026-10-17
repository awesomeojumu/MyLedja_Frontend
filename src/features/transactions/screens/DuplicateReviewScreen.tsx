import { View } from "react-native";
import { Banner, Button, Card, Txt, useTheme } from "@/design";
import { formatMoney } from "@/design/format";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";
import { DUPLICATE_PAIRS } from "@/features/transactions/dummy-data";

export function DuplicateReviewScreen() {
  const t = useTheme();
  return (
    <TxScreen title="Duplicate review" emptyTitle="No duplicates" errorTitle="Could not load duplicates">
      <WidePane
        sidebar={
          <Banner tone="warning" title="Possible doubles">
            Same merchant and amount on the same day.
          </Banner>
        }
      >
      {DUPLICATE_PAIRS.map((row) => (
        <Card key={row.id}>
          <Txt variant="titleSm">{row.title}</Txt>
          <Txt variant="bodySm" color={t.c.inkMuted}>
            {row.note} · {formatMoney(row.amount, "NGN")}
          </Txt>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary">Keep both</Button>
            <Button variant="tertiary">Skip later</Button>
          </View>
        </Card>
      ))}
      </WidePane>
    </TxScreen>
  );
}

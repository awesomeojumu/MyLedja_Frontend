import { View } from "react-native";
import { Amount, Banner, Card, Txt, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { SPLIT } from "../dummy-data";

export function SplitScreen() {
  const t = useTheme();
  const total = SPLIT.reduce((sum, part) => sum + part.amount, 0);
  return (
    <TxScreen title="Split" emptyTitle="Nothing to split" errorTitle="Could not split this record">
      <Banner tone="primary" title="Parts must sum">
        Shoprite · {total.toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
      </Banner>
      <Card flat>
        {SPLIT.map((part, index) => (
          <View
            key={part.category}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: t.space.space3,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: t.c.border,
            }}
          >
            <Txt variant="label">{part.category}</Txt>
            <Amount value={part.amount} kind="expense" />
          </View>
        ))}
      </Card>
    </TxScreen>
  );
}

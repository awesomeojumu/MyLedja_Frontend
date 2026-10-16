import { View } from "react-native";
import { Amount, Card, Txt, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";
import { RECURRING } from "../dummy-data";

export function RecurringScreen() {
  const t = useTheme();
  return (
    <TxScreen title="Recurring" emptyTitle="No repeating records" emptyBody="Bills and salary you record on a cycle will show here." errorTitle="Could not load recurring records">
      {RECURRING.map((row) => (
        <Card key={row.id}>
          <View style={{ gap: t.space.space2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="titleSm">{row.title}</Txt>
              <Amount value={row.amount} kind="expense" />
            </View>
            <Txt variant="caption" color={t.c.inkMuted}>
              {row.when}
            </Txt>
          </View>
        </Card>
      ))}
    </TxScreen>
  );
}

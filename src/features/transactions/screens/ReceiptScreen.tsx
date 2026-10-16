import { View } from "react-native";
import { Banner, Card, Txt, useTheme } from "../../../design";
import { TxScreen } from "../components/TxScreen";

export function ReceiptScreen() {
  const t = useTheme();
  return (
    <TxScreen title="Receipt" emptyTitle="No receipt yet" emptyBody="Attach a photo of the slip. Dummy preview stays on this phone." errorTitle="Could not open this receipt">
      <Banner tone="primary" title="Shoprite · ₦12,500.50">
        Dummy receipt. Nothing is uploaded yet.
      </Banner>
      <Card>
        <View
          style={{
            minHeight: 220,
            borderRadius: t.radius.radiusMd,
            backgroundColor: t.c.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
            gap: t.space.space2,
          }}
        >
          <Txt variant="titleSm">Receipt photo</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            14:20 · GTBank
          </Txt>
        </View>
      </Card>
    </TxScreen>
  );
}

import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Card, Icon, Txt, useTheme } from "@/design";
import { WidePane } from "@/lib";
import { TxScreen } from "@/features/transactions/components/TxScreen";

const CHOICES = [
  { href: "/(tabs)/transactions/add-expense", title: "Expense", body: "Money that left an account.", icon: "arrow-up-right" as const },
  { href: "/(tabs)/transactions/add-income", title: "Income", body: "Money that arrived.", icon: "arrow-down-left" as const },
  { href: "/(tabs)/accounts/transfer", title: "Transfer", body: "Between your own accounts.", icon: "arrow-left-right" as const },
  { href: "/(tabs)/transactions/refund", title: "Refund", body: "A new refund row. Original stays posted.", icon: "undo-2" as const },
];

export function ChooserScreen() {
  const t = useTheme();
  const router = useRouter();
  return (
    <TxScreen title="Add transaction" emptyTitle="Nothing to add" errorTitle="Could not open add">
      <WidePane>
      {CHOICES.map((choice) => (
        <Pressable key={choice.title} onPress={() => router.push(choice.href)} accessibilityRole="button" accessibilityLabel={choice.title}>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon name={choice.icon} size={20} color={t.c.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="titleSm">{choice.title}</Txt>
                <Txt variant="bodySm" color={t.c.inkMuted}>
                  {choice.body}
                </Txt>
              </View>
              <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
            </View>
          </Card>
        </Pressable>
      ))}
      </WidePane>
    </TxScreen>
  );
}

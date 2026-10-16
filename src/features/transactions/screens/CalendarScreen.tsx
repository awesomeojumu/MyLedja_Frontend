import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Amount, Card, Txt } from "../../../design";
import { WidePane } from "../../../lib";
import { TxScreen } from "../components/TxScreen";
import { CALENDAR_DAYS } from "../dummy-data";

export function CalendarScreen() {
  const router = useRouter();
  return (
    <TxScreen title="Transaction calendar" emptyTitle="No days yet" errorTitle="Could not load calendar">
      <WidePane>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {CALENDAR_DAYS.map((day) => (
            <Pressable key={day.day} onPress={() => router.push("/(tabs)/transactions")} accessibilityRole="button" accessibilityLabel={`October ${day.day}`}>
              <Card style={{ width: 96 }}>
                <Txt variant="titleMd">{day.day}</Txt>
                <Amount value={day.total} size="sm" kind="expense" />
              </Card>
            </Pressable>
          ))}
        </View>
      </WidePane>
    </TxScreen>
  );
}

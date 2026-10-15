import { Pressable, View } from "react-native";
import { Amount, Card, Icon, Txt, useTheme } from "../../../design";
import { DashboardScreen } from "../components/DashboardScreen";
import { HOME_DUMMY, UPCOMING } from "../dummy-data";

export function UpcomingScreen() {
  const t = useTheme();
  return (
    <DashboardScreen title="Upcoming">
      <Card flat>
        {UPCOMING.map((item, index) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.when}, ${item.amount}`}
            onPress={() => undefined}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.space.space3,
              minHeight: t.size.touchTarget,
              paddingVertical: t.space.space3,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: t.c.border,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" style={{ fontWeight: "600" }}>
                {item.title}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {item.when}
              </Txt>
            </View>
            <Amount value={item.amount} currency={HOME_DUMMY.currency} kind="expense" />
            <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
          </Pressable>
        ))}
      </Card>
    </DashboardScreen>
  );
}

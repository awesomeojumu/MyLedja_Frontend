import { View } from "react-native";
import { Amount, Card, ProgressBar, ProgressRing, Txt, useTheme } from "@/design";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { DASHBOARD_GOALS, HOME_DUMMY } from "@/features/dashboard/dummy-data";

export function GoalsPreviewScreen() {
  const t = useTheme();
  const grid = t.widthClass !== "compact" && !t.portrait;
  return (
    <DashboardScreen title="Goals">
      <View
        style={{
          flexDirection: grid ? "row" : "column",
          flexWrap: grid ? "wrap" : "nowrap",
          gap: t.space.space4,
        }}
      >
        {DASHBOARD_GOALS.map((goal) => (
          <View key={goal.id} style={{ flexGrow: 1, flexBasis: grid ? "46%" : "100%", minWidth: grid ? 240 : undefined }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
                <ProgressRing value={goal.saved} max={goal.target} label={goal.name} size={56} tone="primary" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="titleSm">{goal.name}</Txt>
                  <Amount value={goal.saved} currency={HOME_DUMMY.currency} size="sm" />
                </View>
              </View>
              <ProgressBar value={goal.saved} max={goal.target} money currency={HOME_DUMMY.currency} tone="primary" />
            </Card>
          </View>
        ))}
      </View>
    </DashboardScreen>
  );
}

import { Banner, Card } from "@/design";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { DASHBOARD_INSIGHTS } from "@/features/dashboard/dummy-data";

export function InsightsScreen() {
  return (
    <DashboardScreen title="Insights">
      {DASHBOARD_INSIGHTS.map((item) => (
        <Card key={item.id}>
          <Banner
            tone={item.tone}
            title={item.title}
            icon={item.tone === "warning" ? "calendar" : item.tone === "positive" ? "trending-down" : "lightbulb"}
          >
            {item.body}
          </Banner>
        </Card>
      ))}
    </DashboardScreen>
  );
}

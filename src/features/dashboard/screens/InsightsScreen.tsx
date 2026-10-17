import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { PlanLiveList } from "@/lib/plan-live-list";

export function InsightsScreen() {
  return (
    <DashboardScreen title="Insights">
      <PlanLiveList path="budgets" empty="No budget insights yet" />
    </DashboardScreen>
  );
}

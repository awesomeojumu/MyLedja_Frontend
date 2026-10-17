import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { PlanLiveList } from "@/lib/plan-live-list";

export function GoalsPreviewScreen() {
  return (
    <DashboardScreen title="Goals">
      <PlanLiveList path="goals" empty="No goals yet" />
    </DashboardScreen>
  );
}

import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { PlanLiveList } from "@/lib/plan-live-list";

export function UpcomingScreen() {
  return (
    <DashboardScreen title="Upcoming">
      <PlanLiveList path="bills" empty="No upcoming bills" />
    </DashboardScreen>
  );
}

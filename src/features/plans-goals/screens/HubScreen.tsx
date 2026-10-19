import { GoalsListScreen } from "@/features/plans-goals/screens/goal-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <GoalsListScreen />;
}

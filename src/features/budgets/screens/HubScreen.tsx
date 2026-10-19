import { BudgetsListScreen } from "@/features/budgets/screens/budget-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <BudgetsListScreen />;
}

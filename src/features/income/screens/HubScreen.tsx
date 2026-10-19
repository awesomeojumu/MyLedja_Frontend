import { IncomeListScreen } from "@/features/income/screens/income-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <IncomeListScreen />;
}

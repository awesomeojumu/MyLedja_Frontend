import { DebtsListScreen } from "@/features/debts/screens/debt-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <DebtsListScreen />;
}

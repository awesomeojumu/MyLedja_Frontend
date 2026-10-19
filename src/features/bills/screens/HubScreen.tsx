import { BillsListScreen } from "@/features/bills/screens/bill-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <BillsListScreen />;
}

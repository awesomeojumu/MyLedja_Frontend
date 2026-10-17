import { AccountsScreen } from "@/features/accounts/screens/AccountsScreen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  void onBack;
  return <AccountsScreen />;
}

import { AccountsScreen } from "./AccountsScreen";

export function HubScreen({ onBack }: { onBack?: () => void } = {}) {
  void onBack;
  return <AccountsScreen />;
}

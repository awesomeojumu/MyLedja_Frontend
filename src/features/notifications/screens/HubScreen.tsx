import { NotificationsListScreen } from "@/features/notifications/screens/notice-screens";

export function HubScreen({ onBack: _onBack }: { onBack?: () => void } = {}) {
  return <NotificationsListScreen />;
}

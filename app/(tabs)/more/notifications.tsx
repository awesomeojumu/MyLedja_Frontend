import { useRouter } from "expo-router";
import { HubScreen } from "@/features/notifications";

export default function NotificationsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

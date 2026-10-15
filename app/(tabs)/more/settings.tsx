import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/settings-privacy";

export default function SettingsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

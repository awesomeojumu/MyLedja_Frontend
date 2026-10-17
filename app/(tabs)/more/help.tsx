import { useRouter } from "expo-router";
import { HubScreen } from "@/features/help-support";

export default function HelpRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

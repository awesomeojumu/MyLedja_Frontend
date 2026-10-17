import { useRouter } from "expo-router";
import { HubScreen } from "@/features/financial-health";

export default function ReportsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/financial-health";

export default function ReportsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

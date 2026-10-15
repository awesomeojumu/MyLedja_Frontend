import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/investments";

export default function InvestmentsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

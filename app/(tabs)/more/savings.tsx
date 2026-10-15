import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/savings";

export default function SavingsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

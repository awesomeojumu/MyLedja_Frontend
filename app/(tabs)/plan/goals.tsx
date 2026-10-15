import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/plans-goals";

export default function GoalsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

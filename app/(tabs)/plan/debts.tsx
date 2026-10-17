import { useRouter } from "expo-router";
import { HubScreen } from "@/features/debts";

export default function DebtsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

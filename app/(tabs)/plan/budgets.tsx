import { useRouter } from "expo-router";
import { HubScreen } from "@/features/budgets";

export default function BudgetsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

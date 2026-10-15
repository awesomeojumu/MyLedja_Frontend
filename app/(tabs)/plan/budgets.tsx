import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/budgets";

export default function BudgetsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

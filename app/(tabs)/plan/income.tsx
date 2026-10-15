import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/income";

export default function IncomeRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

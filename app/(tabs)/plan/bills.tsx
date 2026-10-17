import { useRouter } from "expo-router";
import { HubScreen } from "@/features/bills";

export default function BillsRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

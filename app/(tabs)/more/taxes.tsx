import { useRouter } from "expo-router";
import { HubScreen } from "@/features/taxes";

export default function TaxesRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}

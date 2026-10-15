import { useRouter } from "expo-router";
import { HubScreen } from "../../../src/features/taxes";

export default function TaxesRoute() {
  const router = useRouter();
  return <HubScreen onBack={() => router.back()} />;
}
